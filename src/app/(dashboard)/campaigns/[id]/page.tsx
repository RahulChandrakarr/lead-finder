import Link from "next/link";
import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import { renderTemplate } from "@/lib/mailer";
import { deleteCampaign, retryFailed, setCampaignStatus } from "@/app/actions";
import { SendNowButton } from "@/app/components/SendNowButton";

type Recipient = {
  id: string;
  email: string;
  status: string;
  error: string | null;
  sent_at: Date | null;
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
};

export default async function CampaignPage({ params }: PageProps<"/campaigns/[id]">) {
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const [c] = await query<{ id: string; name: string; status: string; subject: string; body: string; template: string; sender: string | null }>(
    `select c.*, t.subject, t.body, t.name as template, a.email as sender
     from campaigns c join templates t on t.id = c.template_id left join mail_accounts a on a.id = c.account_id
     where c.id = $1`,
    [id],
  );
  if (!c) notFound();
  const recipients = await query<Recipient>(
    `select r.id, r.email, r.status, r.error, r.sent_at, l.name, l.category, l.city, l.country, l.website
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
            From {c.sender ?? "SMTP"} · Template “{c.template}” · {recipients.length} recipients · {count("sent")} sent · {count("pending")} queued · {count("failed")} failed · {count("skipped")} skipped
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.status !== "done" && c.status !== "active" && (
            <form action={setCampaignStatus.bind(null, c.id, "active")}><button className="btn bg-green-700 hover:bg-green-600">Start sending</button></form>
          )}
          {c.status === "active" && (
            <form action={setCampaignStatus.bind(null, c.id, "paused")}><button className="btn-ghost">Pause</button></form>
          )}
          {count("failed") > 0 && (
            <form action={retryFailed.bind(null, c.id)}><button className="btn-ghost">Retry failed</button></form>
          )}
          <form action={deleteCampaign.bind(null, c.id)}><button className="btn-ghost text-red-600">Delete</button></form>
        </div>
      </div>

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
          <thead><tr><th>Business</th><th>Email</th><th>Status</th><th>Sent</th></tr></thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.email}</td>
                <td>
                  <span className="pill">{r.status}</span>
                  {r.error && <p className="mt-1 max-w-md truncate text-xs text-red-600" title={r.error}>{r.error}</p>}
                </td>
                <td className="text-zinc-500">{r.sent_at?.toLocaleString() ?? "—"}</td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-zinc-500">No leads with email matched this campaign’s filters.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
