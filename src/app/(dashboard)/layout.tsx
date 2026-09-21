import Link from "next/link";

const NAV = [
  { href: "/", label: "Find leads" },
  { href: "/leads", label: "Leads" },
  { href: "/templates", label: "Templates" },
  { href: "/campaigns", label: "Campaigns" },
  { href: "/settings", label: "Mail accounts" },
];

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="border-b border-zinc-200 bg-white">
        <nav className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
          <span className="font-semibold">Lead Finder</span>
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="text-sm text-zinc-600 hover:text-zinc-900">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </>
  );
}
