import Link from "next/link";
import { query } from "@/lib/db";
import { leadWhere, pickFilters, LEAD_STATUSES } from "@/lib/leads";
import { CATEGORY_GROUPS, REGIONS, countryName } from "@/lib/taxonomy";
import { LeadMail } from "@/app/components/LeadMail";
import { LeadStatusSelect } from "@/app/components/LeadStatusSelect";
import { deleteLead } from "@/app/actions";
import { renderTemplate } from "@/lib/mailer";

type Lead = {
  id: string;
  name: string;
  site_name: string | null;
  category: string | null;
  google_category: string | null;
  country: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  email: string | null;
  emails: string[];
  socials: Record<string, string | undefined>;
  rating: string | null;
  reviews_count: number | null;
  maps_url: string | null;
  status: string;
};

const PAGE_SIZE = 50;

export default async function LeadsPage({ searchParams }: PageProps<"/leads">) {
  const sp = await searchParams;
  const filters = pickFilters(sp);
  const page = Math.max(1, Number(sp.page) || 1);
  const { where, values } = leadWhere(filters);

  const [{ total }] = await query<{ total: number }>(`select count(*)::int as total from leads l ${where}`, values);
  const [template] = await query<{ subject: string; body: string }>(
    `select t.subject, t.body from campaigns c join templates t on t.id = c.template_id order by c.id desc limit 1`,
  );
  const leads = await query<Lead>(
    `select * from leads l ${where} order by l.id desc limit ${PAGE_SIZE} offset ${(page - 1) * PAGE_SIZE}`,
    values,
  );
  const qs = new URLSearchParams(Object.entries(filters).filter(([, v]) => v) as [string, string][]);
  const pageHref = (p: number) => `/leads?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(p) })}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-semibold">Leads <span className="text-base font-normal text-zinc-500">({total})</span></h1>
        <div className="flex gap-2">
          <a className="btn-ghost" href={`/api/leads/export?${qs}`}>Export CSV</a>
          <Link className="btn" href="/campaigns">Email these →</Link>
        </div>
      </div>

      <form className="card grid gap-3 sm:grid-cols-6">
        <input name="q" defaultValue={filters.q} placeholder="Search name, city, email" className="input sm:col-span-2" />
        <select name="country" defaultValue={filters.country ?? ""} className="input">
          <option value="">All countries</option>
          {REGIONS.map((r) => (
            <optgroup key={r.name} label={r.name}>
              {r.countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </optgroup>
          ))}
        </select>
        <select name="category" defaultValue={filters.category ?? ""} className="input">
          <option value="">All categories</option>
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.name} label={g.name}>
              {g.categories.map((c) => <option key={c.label}>{c.label}</option>)}
            </optgroup>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="input">
          <option value="">Any status</option>
          {LEAD_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-sm whitespace-nowrap">
            <input type="checkbox" name="hasEmail" value="1" defaultChecked={filters.hasEmail === "1"} /> Has email
          </label>
          <button className="btn">Filter</button>
        </div>
      </form>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead>
            <tr><th>Business</th><th>Location</th><th>Contact</th><th>Email</th><th>Rating</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id}>
                <td className="max-w-xs">
                  <div className="font-medium">{l.site_name || l.name}</div>
                  {l.site_name && l.site_name !== l.name && <div className="text-xs text-zinc-400">Maps: {l.name}</div>}
                  <div className="text-xs text-zinc-500">{l.google_category ?? l.category}</div>
                  <div className="mt-1 flex gap-2 text-xs">
                    {l.maps_url && <a className="underline" href={l.maps_url} target="_blank">Maps</a>}
                    {Object.entries(l.socials).filter(([, v]) => v).map(([k, v]) => (
                      <a key={k} className="underline capitalize" href={v} target="_blank">{k}</a>
                    ))}
                  </div>
                </td>
                <td className="text-xs">
                  <div>{[l.city, countryName(l.country)].filter(Boolean).join(", ")}</div>
                  <div className="text-zinc-500">{l.address}</div>
                </td>
                <td className="text-xs">
                  {l.emails.length > 0 ? l.emails.map((e) => <div key={e}><a className="text-blue-700" href={`mailto:${e}`}>{e}</a></div>) : <div className="text-zinc-400">no email</div>}
                  {l.phone && <div>{l.phone}</div>}
                  {l.website && <a className="block max-w-[14rem] truncate text-zinc-500 underline" href={l.website} target="_blank">{l.website.replace(/^https?:\/\/(www\.)?/, "")}</a>}
                </td>
                <td>
                  <LeadMail
                    subject={template ? renderTemplate(template.subject, l) : ""}
                    body={template ? renderTemplate(template.body, l) : ""}
                  />
                </td>
                <td className="text-xs whitespace-nowrap">{l.rating ? `★ ${l.rating} (${l.reviews_count})` : "—"}</td>
                <td><LeadStatusSelect id={l.id} status={l.status} /></td>
                <td>
                  <form action={deleteLead.bind(null, l.id)}>
                    <button className="text-xs text-zinc-400 hover:text-red-600">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-zinc-500">No leads match. <Link className="underline" href="/">Run a search</Link>.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {total > PAGE_SIZE && (
        <div className="flex items-center justify-center gap-3 text-sm">
          {page > 1 && <Link className="btn-ghost" href={pageHref(page - 1)}>← Prev</Link>}
          <span>Page {page} of {Math.ceil(total / PAGE_SIZE)}</span>
          {page * PAGE_SIZE < total && <Link className="btn-ghost" href={pageHref(page + 1)}>Next →</Link>}
        </div>
      )}
    </div>
  );
}
