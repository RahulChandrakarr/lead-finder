// Lead Finder now lives in the RactroTech admin (Admin → Lead finder), sharing RactroTech's database.
// Setting MOVED_TO_URL (e.g. https://www.ractrotech.com) turns this app into a forwarder:
// pages redirect to the admin, the cron endpoint stops sending, and unsubscribe links from
// emails already sent keep working against RactroTech.

export function movedTo() {
  const url = process.env.MOVED_TO_URL;
  return url ? url.replace(/\/$/, "") : null;
}

const PAGES: Record<string, string> = {
  "/": "/admin/outreach",
  "/leads": "/admin/outreach/leads",
  "/replies": "/admin/outreach/replies",
  "/templates": "/admin/outreach/templates",
  "/campaigns": "/admin/outreach/campaigns",
  "/settings": "/admin/outreach/mail-accounts",
};

/** The RactroTech admin page for an old dashboard path. */
export function movedPath(pathname: string) {
  if (/^\/campaigns\/\d+$/.test(pathname)) return `/admin/outreach${pathname}`;
  return PAGES[pathname] ?? "/admin/outreach";
}
