import { connection } from "next/server";
import { query } from "@/lib/db";
import { countryName } from "@/lib/taxonomy";
import { SearchForm } from "@/app/components/SearchForm";
import { AutoSync } from "@/app/components/AutoSync";
import Link from "next/link";

type Job = {
  id: string;
  country: string;
  city: string | null;
  category: string;
  max_results: number;
  status: string;
  lead_count: number;
  error: string | null;
  created_at: Date;
};

const FINISHED = ["SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"];

export default async function Home() {
  await connection();
  const jobs = await query<Job>(`select * from scrape_jobs order by id desc limit 50`);
  const [stats] = await query<{ total: number; with_email: number }>(
    `select count(*)::int as total, count(email)::int as with_email from leads`,
  );
  const running = jobs.some((j) => !FINISHED.includes(j.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Find leads</h1>
          <p className="text-sm text-zinc-500">
            Scrapes Google Maps via Apify, then pulls emails and socials from each business website.
          </p>
        </div>
        <Link href="/leads" className="text-sm text-zinc-600">
          <b className="text-zinc-900">{stats.total}</b> leads · <b className="text-zinc-900">{stats.with_email}</b> with email →
        </Link>
      </div>

      <SearchForm />

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Recent searches</h2>
          <AutoSync active={running} />
        </div>
        {jobs.length === 0 ? (
          <p className="text-sm text-zinc-500">No searches yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr><th>#</th><th>Category</th><th>Location</th><th>Max</th><th>Status</th><th>Leads</th><th>Started</th></tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td className="text-zinc-400">{j.id}</td>
                    <td>{j.category}</td>
                    <td>{[j.city, countryName(j.country)].filter(Boolean).join(", ")}</td>
                    <td>{j.max_results}</td>
                    <td>
                      <span className={`pill ${j.status === "SUCCEEDED" ? "bg-green-100 text-green-800" : FINISHED.includes(j.status) ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>
                        {j.status}
                      </span>
                      {j.error && <p className="mt-1 max-w-xs truncate text-xs text-red-600" title={j.error}>{j.error}</p>}
                    </td>
                    <td>
                      {FINISHED.includes(j.status) && j.status !== "FAILED" ? (
                        <Link className="underline" href={`/leads?category=${encodeURIComponent(j.category)}&country=${j.country}`}>{j.lead_count}</Link>
                      ) : "—"}
                    </td>
                    <td className="whitespace-nowrap text-zinc-500">{j.created_at.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
