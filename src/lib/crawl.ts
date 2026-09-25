import "server-only";
import { query } from "./db";
import { chooseBusinessName, nameFromHtml } from "./site-name";

async function fetchSiteName(website: string) {
  let url = website.trim();
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      redirect: "follow",
      headers: {
        Accept: "text/html",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
      },
    });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("html")) return null;
    return nameFromHtml((await res.text()).slice(0, 150_000));
  } catch {
    return null;
  }
}

/** Crawls the business website and stores the name the email should use. */
export async function rememberBusinessName(lead: { id: string; name: string; website: string | null }) {
  const extracted = lead.website ? await fetchSiteName(lead.website) : null;
  const chosen = chooseBusinessName(lead.name, extracted);
  await query(`update leads set site_name = $2, crawled_at = now(), updated_at = now() where id = $1`, [lead.id, chosen]);
  return chosen;
}

/** Crawls the next uncrawled businesses in a campaign. */
export async function crawlCampaign(campaignId: string, limit = 20) {
  const rows = await query<{ id: string; name: string; website: string | null }>(
    `select l.id, l.name, l.website
     from campaign_recipients r
     join leads l on l.id = r.lead_id
     where r.campaign_id = $1 and l.crawled_at is null
     order by l.id
     limit $2`,
    [campaignId, limit],
  );
  let renamed = 0;
  for (const row of rows) {
    const chosen = await rememberBusinessName(row);
    if (chosen.trim().toLowerCase() !== row.name.trim().toLowerCase()) renamed++;
  }
  return { crawled: rows.length, renamed };
}
