import { unsubscribeByToken } from "@/lib/mailer";

// RFC 8058 one-click unsubscribe (mail clients POST here from the List-Unsubscribe header).
export async function POST(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  await unsubscribeByToken(token);
  return new Response("Unsubscribed", { status: 200 });
}
