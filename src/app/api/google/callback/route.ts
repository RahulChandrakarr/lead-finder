import { NextResponse, type NextRequest } from "next/server";
import { connectAccount } from "@/lib/gmail";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const back = (params: Record<string, string>) => {
    const res = NextResponse.redirect(new URL(`/settings?${new URLSearchParams(params)}`, url));
    res.cookies.delete("google_oauth_state");
    return res;
  };

  if (url.searchParams.get("error")) return back({ error: url.searchParams.get("error")! });
  const state = url.searchParams.get("state");
  if (!state || state !== request.cookies.get("google_oauth_state")?.value) {
    return back({ error: "Sign-in expired or was tampered with. Try again." });
  }
  try {
    const email = await connectAccount(url.searchParams.get("code") ?? "");
    return back({ connected: email });
  } catch (e) {
    return back({ error: e instanceof Error ? e.message : String(e) });
  }
}
