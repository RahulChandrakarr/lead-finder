import Link from "next/link";
import { query } from "@/lib/db";
import { countryName } from "@/lib/taxonomy";

type Reply = {
  id: string;
  name: string;
  email: string;
  city: string | null;
  country: string | null;
  website: string | null;
  replied_at: Date;
};

export default async function RepliesPage() {
  const replies = await query<Reply>(
    `select l.id, coalesce(l.site_name, l.name) as name, r.email, l.city, l.country, l.website, r.replied_at
     from campaign_recipients r
     join leads l on l.id = r.lead_id
     where r.replied_at is not null
     order by r.replied_at desc`,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Replies <span className="text-base font-normal text-zinc-500">({replies.length})</span></h1>
        <p className="text-sm text-zinc-500">
          Leads who wrote back. The team is emailed when a new reply is found. Add those addresses under Mail accounts.
        </p>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Business</th><th>Email</th><th>Location</th><th>Replied</th></tr>
          </thead>
          <tbody>
            {replies.map((r) => (
              <tr key={`${r.id}-${r.email}`}>
                <td>
                  <div className="font-medium">{r.name}</div>
                  {r.website && <a className="text-xs text-zinc-500 underline" href={r.website} target="_blank">{r.website.replace(/^https?:\/\/(www\.)?/, "")}</a>}
                </td>
                <td><a className="text-blue-700" href={`mailto:${r.email}`}>{r.email}</a></td>
                <td className="text-xs text-zinc-500">{[r.city, countryName(r.country)].filter(Boolean).join(", ") || "—"}</td>
                <td className="whitespace-nowrap text-zinc-500">{r.replied_at.toLocaleString()}</td>
              </tr>
            ))}
            {replies.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-zinc-500">
                  No replies yet. Reconnect Gmail on <Link className="underline" href="/settings">Mail accounts</Link> so replies can be detected, then use Check replies on a campaign.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
