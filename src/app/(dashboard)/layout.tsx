import Link from "next/link";
import { query } from "@/lib/db";

const NAV = [
  { href: "/", label: "Find leads" },
  { href: "/leads", label: "Leads" },
  { href: "/replies", label: "Replies" },
  { href: "/templates", label: "Templates" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/settings", label: "Mail accounts" },
];

export default async function DashboardLayout({ children }: LayoutProps<"/">) {
  const [{ n }] = await query<{ n: number }>(
    `select count(*)::int as n from campaign_recipients where replied_at is not null`,
  );
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Lead Finder</span>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-zinc-600 hover:text-zinc-900">
              {item.label}
              {item.href === "/replies" && n > 0 && <span className="pill ml-1.5">{n}</span>}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
