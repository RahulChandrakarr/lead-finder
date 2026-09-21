import { NextResponse, type NextRequest } from "next/server";

// Password-protects the dashboard with HTTP basic auth (any username, password = APP_PASSWORD).
// Unsubscribe links and the cron endpoint are excluded in `config.matcher` below.
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return new NextResponse("Set APP_PASSWORD in .env.local", { status: 500 });

  const header = request.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const decoded = atob(header.slice(6));
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Lead Finder"' },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|unsubscribe|api/unsubscribe|api/cron).*)"],
};
