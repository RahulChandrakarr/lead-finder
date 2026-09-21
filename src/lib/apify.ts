import "server-only";
import { query } from "./db";
import { findCategory } from "./taxonomy";

// Google Maps Scraper: https://apify.com/compass/crawler-google-places
const ACTOR = "compass~crawler-google-places";
const API = "https://api.apify.com/v2";

function token() {
  const t = process.env.APIFY_TOKEN;
  if (!t) throw new Error("APIFY_TOKEN is not set in .env.local");
  return t;
}

async function apify<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Apify ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

type Run = { id: string; status: string; defaultDatasetId: string };

export async function startScrape(opts: {
  country: string;
  city?: string;
  category: string;
  maxResults: number;
  withWebsiteOnly: boolean;
}) {
  const cat = findCategory(opts.category);
  if (!cat) throw new Error(`Unknown category: ${opts.category}`);

  const input = {
    searchStringsArray: [cat.query],
    countryCode: opts.country,
    ...(opts.city ? { city: opts.city } : {}),
    maxCrawledPlacesPerSearch: opts.maxResults,
    language: "en",
    skipClosedPlaces: true,
    scrapeContacts: true, // pulls emails + socials from each business website
    ...(opts.withWebsiteOnly ? { website: "withWebsite" } : {}),
  };

  const { data: run } = await apify<{ data: Run }>(`/acts/${ACTOR}/runs`, {
    method: "POST",
    body: JSON.stringify(input),
  });

  const [job] = await query<{ id: string }>(
    `insert into scrape_jobs (country, city, category, query, max_results, apify_run_id, dataset_id, status)
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
    [opts.country, opts.city || null, cat.label, cat.query, opts.maxResults, run.id, run.defaultDatasetId, run.status],
  );
  return job.id;
}

type Place = {
  placeId?: string;
  title?: string;
  categoryName?: string;
  address?: string;
  city?: string;
  countryCode?: string;
  phone?: string;
  website?: string;
  emails?: string[];
  facebooks?: string[];
  instagrams?: string[];
  linkedIns?: string[];
  twitters?: string[];
  totalScore?: number;
  reviewsCount?: number;
  url?: string;
};

const FINISHED = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

/** Refreshes one job's status from Apify and imports its results once it finishes. */
export async function syncJob(jobId: string) {
  const [job] = await query<{
    id: string;
    apify_run_id: string;
    dataset_id: string;
    status: string;
    category: string;
    country: string;
  }>(`select * from scrape_jobs where id = $1`, [jobId]);
  if (!job || FINISHED.includes(job.status)) return;

  const { data: run } = await apify<{ data: Run }>(`/actor-runs/${job.apify_run_id}`);
  if (!FINISHED.includes(run.status)) {
    await query(`update scrape_jobs set status = $2 where id = $1`, [jobId, run.status]);
    return;
  }
  if (run.status === "FAILED") {
    await query(`update scrape_jobs set status = $2, finished_at = now() where id = $1`, [jobId, run.status]);
    return;
  }
  // SUCCEEDED, or ABORTED / TIMED-OUT: import whatever was collected (partial results are still paid for).

  const places = await apify<Place[]>(`/datasets/${job.dataset_id}/items?clean=true&format=json`);
  const group = findCategory(job.category)?.group ?? null;
  let imported = 0;
  for (const p of places) {
    if (!p.title) continue;
    const emails = [...new Set((p.emails ?? []).map((e) => e.trim().toLowerCase()))];
    const socials = {
      facebook: p.facebooks?.[0],
      instagram: p.instagrams?.[0],
      linkedin: p.linkedIns?.[0],
      twitter: p.twitters?.[0],
    };
    await query(
      `insert into leads (place_id, name, category_group, category, google_category, country, city, address,
                          phone, website, email, emails, socials, rating, reviews_count, maps_url, job_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       on conflict (place_id) do update set
         phone = coalesce(excluded.phone, leads.phone),
         website = coalesce(excluded.website, leads.website),
         email = coalesce(leads.email, excluded.email),
         emails = (select array(select distinct unnest(leads.emails || excluded.emails))),
         socials = leads.socials || excluded.socials,
         rating = excluded.rating,
         reviews_count = excluded.reviews_count,
         updated_at = now()`,
      [
        p.placeId ?? `${p.title}|${p.address}`,
        p.title,
        group,
        job.category,
        p.categoryName ?? null,
        (p.countryCode ?? job.country).toLowerCase(),
        p.city ?? null,
        p.address ?? null,
        p.phone ?? null,
        p.website ?? null,
        emails[0] ?? null,
        emails,
        JSON.stringify(socials),
        p.totalScore ?? null,
        p.reviewsCount ?? null,
        p.url ?? null,
        job.id,
      ],
    );
    imported++;
  }
  await query(
    `update scrape_jobs set status = $3, lead_count = $2, finished_at = now() where id = $1`,
    [jobId, imported, run.status],
  );
}

export async function syncRunningJobs() {
  const jobs = await query<{ id: string }>(
    `select id from scrape_jobs where status not in ('SUCCEEDED','FAILED','ABORTED','TIMED-OUT')`,
  );
  for (const j of jobs) {
    try {
      await syncJob(j.id);
    } catch (e) {
      await query(`update scrape_jobs set error = $2 where id = $1`, [j.id, String(e)]);
    }
  }
  return jobs.length;
}
