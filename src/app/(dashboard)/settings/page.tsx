import { query } from "@/lib/db";
import { googleConfigured, redirectUri } from "@/lib/gmail";
import { disconnectAccount, sendTestEmail, updateAccountLimit } from "@/app/actions";
import { FormAction } from "@/app/components/FormAction";

type Account = { id: string; email: string; from_name: string | null; daily_limit: number; sent24h: number; created_at: Date };

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { connected, error } = await searchParams;
  const accounts = await query<Account>(
    `select a.id, a.email, a.from_name, a.daily_limit, a.created_at,
            (select count(*)::int from campaign_recipients r
              where r.account_id = a.id and r.status = 'sent' and r.sent_at > now() - interval '24 hours') as sent24h
     from mail_accounts a order by a.id`,
  );
  const ready = googleConfigured() && Boolean(process.env.ENCRYPTION_KEY);
  const smtp = Boolean(process.env.SMTP_HOST);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Mail accounts</h1>
          <p className="text-sm text-zinc-500">
            Connect Gmail or Google Workspace addresses to send campaigns from. Emails appear in each account’s Sent folder and replies land in its inbox.
          </p>
        </div>
        {ready && <a href="/api/google/connect" className="btn">+ Connect Gmail</a>}
      </div>

      {typeof connected === "string" && <p className="card border-green-200 bg-green-50 text-sm text-green-800">Connected {connected}.</p>}
      {typeof error === "string" && <p className="card border-red-200 bg-red-50 text-sm text-red-700">{error}</p>}

      {!ready && (
        <div className="card space-y-2 text-sm">
          <p className="font-medium">Gmail isn’t set up yet. One-time setup (≈5 min):</p>
          <ol className="list-decimal space-y-1 pl-5 text-zinc-700">
            <li>Go to <a className="underline" href="https://console.cloud.google.com/" target="_blank">Google Cloud Console</a> → create a project → <b>APIs &amp; Services → Library</b> → enable <b>Gmail API</b>.</li>
            <li><b>OAuth consent screen</b>: choose <b>Internal</b> if all senders are in your Workspace, otherwise <b>External</b> and add each sender under <b>Test users</b>.</li>
            <li><b>Credentials → Create credentials → OAuth client ID → Web application</b>. Authorised redirect URI:
              <code className="mt-1 block rounded bg-zinc-100 px-2 py-1">{redirectUri()}</code></li>
            <li>Put <code>GOOGLE_CLIENT_ID</code>, <code>GOOGLE_CLIENT_SECRET</code> and a random <code>ENCRYPTION_KEY</code> in <code>.env.local</code>, then restart the app.</li>
          </ol>
        </div>
      )}

      <section className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>Account</th><th>Sent (24h)</th><th>Daily limit</th><th></th></tr></thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>
                  <div className="font-medium">{a.email}</div>
                  {a.from_name && <div className="text-xs text-zinc-500">Sends as “{a.from_name}”</div>}
                </td>
                <td>{a.sent24h}</td>
                <td>
                  <form action={updateAccountLimit.bind(null, a.id)} className="flex gap-2">
                    <input name="dailyLimit" type="number" min={1} max={2000} defaultValue={a.daily_limit} className="input w-24 py-1" />
                    <button className="btn-ghost">Save</button>
                  </form>
                </td>
                <td className="text-right">
                  <form action={disconnectAccount.bind(null, a.id)}>
                    <button className="text-xs text-zinc-400 hover:text-red-600">Disconnect</button>
                  </form>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr><td colSpan={4} className="py-8 text-center text-zinc-500">No Gmail accounts connected{smtp ? " — campaigns will use SMTP from .env.local." : "."}</td></tr>
            )}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-zinc-500">
        Google’s caps: ~500/day for personal Gmail, ~2,000/day for Workspace. For cold outreach stay well below (start at 30–50/day per new account and ramp up).
        Disconnecting pauses that account’s active campaigns.
      </p>

      {(accounts.length > 0 || smtp) && (
        <section className="card">
          <h2 className="mb-3 font-medium">Send a test email</h2>
          <FormAction action={sendTestEmail} className="flex flex-wrap gap-2">
            <select name="accountId" className="input w-auto">
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.email}</option>)}
              {smtp && <option value="">SMTP ({process.env.MAIL_FROM})</option>}
            </select>
            <input name="to" type="email" placeholder="you@example.com" className="input w-64" required />
            <button className="btn">Send test</button>
          </FormAction>
        </section>
      )}
    </div>
  );
}
