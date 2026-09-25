import Link from "next/link";
import { connection } from "next/server";
import { query } from "@/lib/db";
import { sentInLast24h } from "@/lib/mailer";
import { CATEGORY_GROUPS, REGIONS } from "@/lib/taxonomy";
import { LEAD_STATUSES } from "@/lib/leads";
import { checkRepliesAction, createCampaign } from "@/app/actions";
import { FormAction } from "@/app/components/FormAction";
import { SendNowButton } from "@/app/components/SendNowButton";

type Campaign = {
  id: string;
  name: string;
  status: string;
  template: string;
  sender: string | null;
  total: number;
  sent: number;
  pending: number;
  failed: number;
  replied: number;
  created_at: Date;
};

export default async function CampaignsPage({ searchParams }: PageProps<"/campaigns">) {
  await connection();
  const { replies, checked, error } = await searchParams;
  const campaigns = await query<Campaign>(
    `select c.id, c.name, c.status, c.created_at, t.name as template, a.email as sender,
            count(r.id)::int as total,
            count(r.id) filter (where r.status = 'sent')::int as sent,
            count(r.id) filter (where r.status in ('pending','sending'))::int as pending,
            count(r.id) filter (where r.status = 'failed')::int as failed,
            count(r.id) filter (where r.replied_at is not null)::int as replied
     from campaigns c join templates t on t.id = c.template_id
     left join mail_accounts a on a.id = c.account_id
     left join campaign_recipients r on r.campaign_id = c.id
     group by c.id, t.name, a.email order by c.id desc`,
  );
  const templates = await query<{ id: string; name: string }>(`select id, name from templates order by id desc`);
  const accounts = await query<{ id: string; email: string }>(`select id, email from mail_accounts order by id`);
  const smtp = Boolean(process.env.SMTP_HOST);
  const sent24h = await sentInLast24h();
  const limit = Number(process.env.DAILY_SEND_LIMIT ?? 50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Campaigns</h1>
          <p className="text-sm text-zinc-500">
            Sent in last 24h: <b>{sent24h}</b> / {limit} daily limit. Active campaigns drip-send via <code>/api/cron/send</code>.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SendNowButton />
          <form action={checkRepliesAction.bind(null, "/campaigns")}><button className="btn-ghost">Check replies</button></form>
        </div>
      </div>
      {typeof error === "string" && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</p>}
      {typeof replies === "string" && (
        <p className="card border-green-200 bg-green-50 text-sm text-green-800">
          Checked {checked} sent threads. {replies} new replies. Lead status is now “replied”.
        </p>
      )}

      <section className="card">
        <h2 className="mb-3 font-medium">New campaign</h2>
        {templates.length === 0 ? (
          <p className="text-sm text-zinc-500">Create a <Link className="underline" href="/templates">template</Link> first.</p>
        ) : (
          <FormAction action={createCampaign} className="grid gap-3 sm:grid-cols-6">
            <input name="name" className="input sm:col-span-2" placeholder="Campaign name" required />
            <select name="templateId" className="input sm:col-span-2" required>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select name="accountId" className="input sm:col-span-2" required={!smtp}>
              {accounts.map((a) => <option key={a.id} value={a.id}>Send from {a.email}</option>)}
              {smtp && <option value="">Send via SMTP ({process.env.MAIL_FROM})</option>}
              {!smtp && accounts.length === 0 && <option value="">Connect a Gmail account first</option>}
            </select>
            <select name="country" className="input">
              <option value="">All countries</option>
              {REGIONS.flatMap((r) => r.countries).map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select>
            <select name="category" className="input">
              <option value="">All categories</option>
              {CATEGORY_GROUPS.flatMap((g) => g.categories).map((c) => <option key={c.label}>{c.label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              Lead status
              <select name="status" defaultValue="new" className="input w-auto">
                <option value="">Any</option>
                {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
              <span className="text-xs text-zinc-500">Only leads with an email; unsubscribed/bounced are always excluded.</span>
            </label>
            <button className="btn sm:col-span-2" disabled={!smtp && accounts.length === 0}>Create campaign (as draft)</button>
          </FormAction>
        )}
      </section>

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Campaign</th><th>Template</th><th>Sender</th><th>Status</th><th>Progress</th><th>Replied</th><th>Failed</th><th>Created</th></tr></thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id}>
                <td><Link className="font-medium underline" href={`/campaigns/${c.id}`}>{c.name}</Link></td>
                <td>{c.template}</td>
                <td className="text-zinc-500">{c.sender ?? "SMTP"}</td>
                <td><span className="pill">{c.status}</span></td>
                <td>{c.sent} / {c.total} sent{c.pending ? ` · ${c.pending} queued` : ""}</td>
                <td>{c.replied}</td>
                <td className={c.failed ? "text-red-600" : ""}>{c.failed}</td>
                <td className="text-zinc-500">{c.created_at.toLocaleDateString()}</td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-zinc-500">No campaigns yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}
