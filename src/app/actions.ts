"use server";

// All routes (including these actions) sit behind the basic-auth check in src/proxy.ts.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { query } from "@/lib/db";
import { startScrape, syncRunningJobs } from "@/lib/apify";
import { crawlCampaign } from "@/lib/crawl";
import { deliver, sendBatch, syncReplies } from "@/lib/mailer";
import type { MailAccount } from "@/lib/gmail";
import { leadWhere, LEAD_STATUSES, type LeadFilters } from "@/lib/leads";
import { COUNTRIES, findCategory } from "@/lib/taxonomy";

export type ActionState = { ok?: string; error?: string };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

export async function startScrapeAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const country = str(fd, "country");
  // Picked cities + comma-separated custom ones; none = search the whole country.
  const picked = [...fd.getAll("city").map(String), ...str(fd, "customCity").split(",")].map((c) => c.trim()).filter(Boolean);
  const cities = picked.length ? [...new Set(picked)] : [""];
  const categories = fd.getAll("category").map(String).filter((c) => findCategory(c));
  const maxResults = Math.min(Math.max(Number(fd.get("maxResults")) || 50, 1), 500);

  if (!COUNTRIES.some((c) => c.code === country)) return { error: "Pick a country." };
  if (!categories.length) return { error: "Pick at least one category." };
  const total = cities.length * categories.length;
  if (total > 50) return { error: `That's ${total} searches (cities × categories). Pick fewer — max 50 at once.` };

  let started = 0;
  try {
    for (const city of cities) {
      for (const category of categories) {
        await startScrape({ country, city, category, maxResults, withWebsiteOnly: fd.get("withWebsite") === "on" });
        started++;
      }
    }
  } catch (e) {
    revalidatePath("/");
    return { error: `Started ${started} of ${total}, then: ${e instanceof Error ? e.message : e}` };
  }
  revalidatePath("/");
  return { ok: `Started ${total} search${total > 1 ? "es" : ""}. Results import automatically.` };
}

export async function syncJobsAction() {
  const n = await syncRunningJobs();
  if (n) revalidatePath("/");
  return n;
}

export async function updateLeadStatus(id: string, status: string) {
  if (!LEAD_STATUSES.includes(status)) return;
  await query(`update leads set status = $2, updated_at = now() where id = $1`, [id, status]);
  if (status === "unsubscribed" || status === "bounced") {
    await query(
      `insert into suppressions (email, reason) select lower(email), $2 from leads where id = $1 and email is not null
       on conflict do nothing`,
      [id, status],
    );
  }
  revalidatePath("/leads");
}

export async function deleteLead(id: string) {
  await query(`delete from leads where id = $1`, [id]);
  revalidatePath("/leads");
}

export async function createTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  const subject = str(fd, "subject");
  const body = str(fd, "body");
  if (!name || !subject || !body) return { error: "Name, subject and body are required." };
  await query(`insert into templates (name, subject, body) values ($1, $2, $3)`, [name, subject, body]);
  revalidatePath("/templates");
  return { ok: "Template saved." };
}

export async function deleteTemplate(id: string) {
  const [used] = await query(`select 1 from campaigns where template_id = $1 limit 1`, [id]);
  if (used) return;
  await query(`delete from templates where id = $1`, [id]);
  revalidatePath("/templates");
}

export async function createCampaign(_: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  const templateId = str(fd, "templateId");
  const accountId = str(fd, "accountId") || null; // empty = SMTP from .env.local
  if (!name || !templateId) return { error: "Name and template are required." };

  const filters: LeadFilters = {
    country: str(fd, "country") || undefined,
    category: str(fd, "category") || undefined,
    status: str(fd, "status") || undefined,
    hasEmail: "1",
  };
  const { where, values } = leadWhere(filters);

  const [c] = await query<{ id: string }>(
    `insert into campaigns (name, template_id, account_id) values ($1, $2, $3) returning id`,
    [name, templateId, accountId],
  );
  // One recipient per lead; skips suppressed emails and emails already queued in this campaign.
  const n = values.length;
  await query(
    `insert into campaign_recipients (campaign_id, lead_id, email)
     select distinct on (lower(l.email)) $${n + 1}::bigint, l.id, l.email from leads l
     ${where} ${where ? "and" : "where"} lower(l.email) not in (select email from suppressions)
     order by lower(l.email), l.id
     on conflict do nothing`,
    [...values, c.id],
  );
  redirect(`/campaigns/${c.id}`);
}

export async function setCampaignStatus(id: string, status: "active" | "paused") {
  await query(`update campaigns set status = $2 where id = $1 and status <> 'done'`, [id, status]);
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/campaigns");
}

export async function deleteCampaign(id: string) {
  await query(`delete from campaigns where id = $1`, [id]);
  redirect("/campaigns");
}

export async function retryFailed(id: string) {
  await query(
    `update campaign_recipients set status = 'pending', error = null where campaign_id = $1 and status = 'failed'`,
    [id],
  );
  await query(`update campaigns set status = 'paused' where id = $1 and status = 'done'`, [id]);
  revalidatePath(`/campaigns/${id}`);
}

export async function crawlCampaignAction(id: string) {
  let dest: string;
  try {
    const r = await crawlCampaign(id);
    dest = `/campaigns/${id}?crawled=${r.crawled}&renamed=${r.renamed}`;
  } catch (e) {
    dest = `/campaigns/${id}?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`;
  }
  revalidatePath(`/campaigns/${id}`);
  revalidatePath("/leads");
  redirect(dest);
}

export async function checkRepliesAction(returnTo: string) {
  let dest: string;
  try {
    const r = await syncReplies();
    dest = `${returnTo}?replies=${r.replied}&checked=${r.checked}`;
  } catch (e) {
    dest = `${returnTo}?error=${encodeURIComponent(e instanceof Error ? e.message : String(e))}`;
  }
  revalidatePath("/campaigns", "layout");
  revalidatePath("/leads");
  revalidatePath("/replies");
  redirect(dest);
}

export async function addNotifyEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email").toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Enter a valid email address." };
  await query(`insert into notify_emails (email) values ($1) on conflict do nothing`, [email]);
  revalidatePath("/settings");
  return { ok: `${email} will be notified when a lead replies.` };
}

export async function removeNotifyEmail(email: string) {
  await query(`delete from notify_emails where email = $1`, [email]);
  revalidatePath("/settings");
}

export async function sendNowAction(): Promise<ActionState> {
  try {
    const r = await sendBatch();
    revalidatePath("/campaigns", "layout");
    return { ok: `Sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped}${r.reason ? ` (${r.reason})` : ""}.` };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e) };
  }
}

export async function updateAccountLimit(id: string, fd: FormData) {
  const limit = Math.min(Math.max(Number(fd.get("dailyLimit")) || 0, 1), 2000);
  await query(`update mail_accounts set daily_limit = $2 where id = $1`, [id, limit]);
  revalidatePath("/settings");
}

export async function disconnectAccount(id: string) {
  await query(`update campaigns set status = 'paused' where account_id = $1 and status = 'active'`, [id]);
  await query(`delete from mail_accounts where id = $1`, [id]);
  revalidatePath("/settings");
}

export async function sendTestEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const accountId = str(fd, "accountId");
  const to = str(fd, "to");
  if (!/^\S+@\S+\.\S+$/.test(to)) return { error: "Enter a valid email address." };
  const [account] = accountId
    ? await query<MailAccount>(`select * from mail_accounts where id = $1`, [accountId])
    : [null];
  try {
    await deliver(account ?? null, {
      to,
      subject: "Lead Finder test email",
      text: "If you can read this, sending works.",
      html: "<p>If you can read this, sending works.</p>",
      headers: {},
    });
    return { ok: `Test email sent to ${to} from ${account?.email ?? "SMTP"}.` };
  } catch (e) {
    return { error: String(e instanceof Error ? e.message : e) };
  }
}
