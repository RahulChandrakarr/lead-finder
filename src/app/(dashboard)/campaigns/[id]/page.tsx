import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { renderTemplate } from "@/lib/mailer";
import { checkRepliesAction, crawlCampaignAction, deleteCampaign, retryFailed, setCampaignStatus } from "@/app/actions";
import { SendNowButton } from "@/app/components/SendNowButton";

type Recipient = {
  id: string;
  email: string;
  status: string;
  error: string | null;
  sent_at: Date | null;
  replied_at: Date | null;
  name: string;
  site_name: string | null;
  crawled_at: Date | null;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
};

export default async function CampaignPage({ params, searchParams }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  const { replies, checked, error, crawled, renamed } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const [c] = await query<{ id: string; name: string; status: string; subject: string; body: string; template: string; sender: string | null }>(
    `select c.*, t.subject, t.body, t.name as template, a.email as sender
     from campaigns c join templates t on t.id = c.template_id left join mail_accounts a on a.id = c.account_id
     where c.id = $1`,
    [id],
  );
  if (!c) notFound();
  const recipients = await query<Recipient>(
    `select r.id, r.email, r.status, r.error, r.sent_at, r.replied_at, l.name, l.site_name, l.crawled_at, l.category, l.city, l.country, l.website
     from campaign_recipients r join leads l on l.id = r.lead_id where r.campaign_id = $1 order by r.id`,
    [id],
  );
  const count = (s: string) => recipients.filter((r) => r.status === s).length;
  const sample = recipients[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/campaigns" className="text-sm text-zinc-500">← Campaigns</Link>
          <h1 className="text-2xl font-semibold">{c.name} <span className="pill align-middle">{c.status}</span></h1>
          <p className="text-sm text-zinc-500">
            From {c.sender ?? "SMTP"} · Template “{c.template}” · {recipients.length} recipients · {count("sent")} sent · {recipients.filter((r) => r.replied_at).length} replied · {count("pending")} queued · {recipients.filter((r) => !r.crawled_at).length} not crawled · {count("failed")} failed · {count("skipped")} skipped
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.status !== "done" && c.status !== "active" && (
            <form action={setCampaignStatus.bind(null, c.id, "active")}><button className="btn bg-green-700 hover:bg-green-600">Start sending</button></form>
          )}
          {c.status === "active" && (
            <form action={setCampaignStatus.bind(null, c.id, "paused")}><button className="btn-ghost">Pause</button></form>
          )}
          {recipients.some((r) => !r.crawled_at) && (
            <form action={crawlCampaignAction.bind(null, c.id)}><button className="btn-ghost">Crawl next 20 websites</button></form>
          )}
          <form action={checkRepliesAction.bind(null, `/campaigns/${c.id}`)}><button className="btn-ghost">Check replies</button></form>
          {count("failed") > 0 && (
            <form action={retryFailed.bind(null, c.id)}><button className="btn-ghost">Retry failed</button></form>
          )}
          <form action={deleteCampaign.bind(null, c.id)}><button className="btn-ghost text-red-600">Delete</button></form>
        </div>
      </div>

      {typeof error === "string" && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</p>}
      {typeof replies === "string" && (
        <p className="card border-green-200 bg-green-50 text-sm text-green-800">Checked {checked} threads. {replies} new replies. Those leads are marked replied.</p>
      )}
      {typeof crawled === "string" && (
        <p className="card border-green-200 bg-green-50 text-sm text-green-800">Crawled {crawled} websites. {renamed} emails will use a different business name.</p>
      )}

      {c.status === "active" && <SendNowButton />}

      {sample && (
        <section className="card">
          <h2 className="label">Preview (first recipient: {sample.email})</h2>
          <p className="font-medium">{renderTemplate(c.subject, sample)}</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-sm text-zinc-700">{renderTemplate(c.body, sample)}</pre>
        </section>
      )}

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Business</th><th>Email</th><th>Status</th><th>Sent</th><th>Reply</th></tr></thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id}>
                <td>
                  {r.site_name || r.name}
                  {r.site_name && r.site_name !== r.name && <div className="text-xs text-zinc-400">Maps: {r.name}</div>}
                </td>
                <td>{r.email}</td>
                <td>
                  <span className="pill">{r.status}</span>
                  {r.error && <p className="mt-1 max-w-md truncate text-xs text-red-600" title={r.error}>{r.error}</p>}
                </td>
                <td className="text-zinc-500">{r.sent_at?.toLocaleString() ?? "—"}</td>
                <td className="text-zinc-500">{r.replied_at ? r.replied_at.toLocaleString() : r.error === "bounced" ? "Bounced" : "—"}</td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr><td colSpan={5} className="py-8 text-center text-zinc-500">No leads with email matched this campaign’s filters.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
