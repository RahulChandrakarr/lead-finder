import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { pool, query } from "./db";
import { countryName } from "./taxonomy";
import { sendViaGmail, type MailAccount } from "./gmail";

export const PLACEHOLDERS = ["business_name", "category", "city", "country", "website"] as const;

type LeadFields = {
  name: string;
  category: string | null;
  city: string | null;
  country: string | null;
  website: string | null;
};

export function renderTemplate(text: string, lead: LeadFields) {
  const values: Record<string, string> = {
    business_name: lead.name,
    category: lead.category ?? "",
    city: lead.city ?? "",
    country: countryName(lead.country),
    website: lead.website ?? "",
  };
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => values[key] ?? m);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

let transport: Transporter | undefined;
function getTransport() {
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST is not set in .env.local");
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return transport;
}

export async function sentInLast24h() {
  const [r] = await query<{ n: number }>(
    `select count(*)::int as n from campaign_recipients where status = 'sent' and sent_at > now() - interval '24 hours'`,
  );
  return r.n;
}

type Claimed = LeadFields & {
  id: string;
  email: string;
  token: string;
  campaign_id: string;
  account_id: string | null;
  subject: string;
  body: string;
};

type Message = { to: string; subject: string; text: string; html: string; headers: Record<string, string> };

/** Renders the template for one recipient and adds the unsubscribe footer + headers. */
function buildMessage(r: Claimed): Message {
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  const postal = process.env.MAIL_POSTAL_ADDRESS ?? "";
  const unsubscribeUrl = `${appUrl}/unsubscribe?t=${r.token}`;
  const body = renderTemplate(r.body, r);
  return {
    to: r.email,
    subject: renderTemplate(r.subject, r),
    text: `${body}\n\n--\n${postal}\nDon't want these emails? Unsubscribe: ${unsubscribeUrl}`,
    html:
      `<div>${escapeHtml(body).replace(/\n/g, "<br>")}</div>` +
      `<p style="color:#888;font-size:12px;margin-top:24px">${escapeHtml(postal)}<br>` +
      `<a href="${unsubscribeUrl}">Unsubscribe</a></p>`,
    headers: {
      "List-Unsubscribe": `<${appUrl}/api/unsubscribe?t=${r.token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}

/** Sends via the connected Gmail account, or via SMTP from .env.local when none is set. */
export async function deliver(account: MailAccount | null, msg: Message) {
  if (account) return sendViaGmail(account, msg);
  const info = await getTransport().sendMail({ from: process.env.MAIL_FROM, ...msg });
  return { id: info.messageId as string, threadId: null };
}

/**
 * Sends the next batch of pending emails across all active campaigns, respecting
 * BATCH_SIZE, the global DAILY_SEND_LIMIT and each Gmail account's daily limit.
 * Safe to call concurrently.
 */
export async function sendBatch() {
  const daily = Number(process.env.DAILY_SEND_LIMIT ?? 50);
  const batch = Number(process.env.BATCH_SIZE ?? 10);
  const remaining = daily - (await sentInLast24h());
  if (remaining <= 0) return { sent: 0, failed: 0, skipped: 0, reason: "daily limit reached" };

  // Remaining quota per connected account over the last 24h.
  const accounts = await query<MailAccount & { remaining: number }>(
    `select a.*, a.daily_limit - (select count(*)::int from campaign_recipients r
       where r.account_id = a.id and r.status = 'sent' and r.sent_at > now() - interval '24 hours') as remaining
     from mail_accounts a`,
  );
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const exhausted = accounts.filter((a) => a.remaining <= 0).map((a) => a.id);

  // Claim rows atomically so overlapping runs never double-send.
  const { rows } = await pool.query<Claimed>(
    `with claimed as (
       update campaign_recipients set status = 'sending'
       where id in (
         select r.id from campaign_recipients r
         join campaigns c on c.id = r.campaign_id
         where r.status = 'pending' and c.status = 'active'
           and (c.account_id is null or not (c.account_id = any($2::bigint[])))
         order by r.id
         limit $1
         for update of r skip locked
       )
       returning *
     )
     select cl.id, cl.email, cl.token, cl.campaign_id, c.account_id, t.subject, t.body,
            l.name, l.category, l.city, l.country, l.website
     from claimed cl
     join campaigns c on c.id = cl.campaign_id
     join templates t on t.id = c.template_id
     join leads l on l.id = cl.lead_id`,
    [Math.min(batch, remaining), exhausted],
  );

  let sent = 0, failed = 0, skipped = 0;

  for (const r of rows) {
    const account = r.account_id ? byId.get(r.account_id) ?? null : null;
    if (account && account.remaining <= 0) {
      await query(`update campaign_recipients set status = 'pending' where id = $1`, [r.id]);
      continue;
    }
    const [suppressed] = await query(`select 1 from suppressions where email = lower($1)`, [r.email]);
    if (suppressed) {
      await query(`update campaign_recipients set status = 'skipped', error = 'suppressed' where id = $1`, [r.id]);
      skipped++;
      continue;
    }

    try {
      const res = await deliver(account, buildMessage(r));
      if (account) account.remaining--;
      await query(
        `update campaign_recipients set status = 'sent', sent_at = now(), error = null,
           account_id = $2, message_id = $3, thread_id = $4 where id = $1`,
        [r.id, account?.id ?? null, res.id, res.threadId],
      );
      await query(
        `update leads set status = 'contacted', updated_at = now()
         where id = (select lead_id from campaign_recipients where id = $1) and status = 'new'`,
        [r.id],
      );
      sent++;
    } catch (e) {
      await query(`update campaign_recipients set status = 'failed', error = $2 where id = $1`, [r.id, String(e)]);
      failed++;
    }
    // Space sends out a little; bursts hurt deliverability.
    await new Promise((res) => setTimeout(res, 1500));
  }

  await query(
    `update campaigns c set status = 'done'
     where status = 'active'
       and not exists (select 1 from campaign_recipients r where r.campaign_id = c.id and r.status in ('pending','sending'))`,
  );

  const reason = rows.length ? undefined : exhausted.length ? "nothing pending or sender daily limit reached" : "nothing pending";
  return { sent, failed, skipped, reason };
}

/** Adds the token's email to the suppression list and cancels its pending sends. */
export async function unsubscribeByToken(token: string) {
  if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
  const [r] = await query<{ email: string; lead_id: string }>(
    `select email, lead_id from campaign_recipients where token = $1`,
    [token],
  );
  if (!r) return null;
  await query(
    `insert into suppressions (email, reason) values (lower($1), 'unsubscribed') on conflict do nothing`,
    [r.email],
  );
  await query(`update leads set status = 'unsubscribed', updated_at = now() where id = $1`, [r.lead_id]);
  await query(
    `update campaign_recipients set status = 'skipped', error = 'unsubscribed'
     where lower(email) = lower($1) and status = 'pending'`,
    [r.email],
  );
  return r.email;
}
