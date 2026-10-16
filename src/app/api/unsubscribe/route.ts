import { unsubscribeByToken } from "@/lib/mailer";
import { movedTo } from "@/lib/moved";

// RFC 8058 one-click unsubscribe (mail clients POST here from the List-Unsubscribe header).
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const moved = movedTo();
  if (!moved) {
    await unsubscribeByToken(token);
    return new Response("Unsubscribed", { status: 200 });
  }

  // Moved: record it here as well, so the final data copy into RactroTech can't miss it, then forward.
  await unsubscribeByToken(token).catch(() => null);
  const res = await fetch(`${moved}/api/outreach/unsubscribe?t=${encodeURIComponent(token)}`, {
    method: "POST",
    cache: "no-store",
  }).catch(() => null);
  return new Response(res?.ok ? "Unsubscribed" : "Unsubscribe failed, please try again", { status: res?.ok ? 200 : 502 });
}
