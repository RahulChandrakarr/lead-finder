import { sendBatch, syncReplies } from "@/lib/mailer";
import { syncRunningJobs } from "@/lib/apify";

// Hit this on a schedule (e.g. every 10 minutes) to drip-send campaigns and import finished scrapes:
//   curl -H "Authorization: Bearer $CRON_SECRET" https://your-app/api/cron/send
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = new URL(request.url);
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? url.searchParams.get("secret");
  if (!secret || given !== secret) return Response.json({ error: "unauthorized" }, { status: 401 });

  const jobsSynced = await syncRunningJobs();
  const mail = await sendBatch();
  const replies = await syncReplies().catch((e: unknown) => ({ error: e instanceof Error ? e.message : String(e) }));
  return Response.json({ jobsSynced, ...mail, replies });
}
