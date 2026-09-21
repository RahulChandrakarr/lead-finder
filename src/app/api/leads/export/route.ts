import { query } from "@/lib/db";
import { leadWhere, pickFilters } from "@/lib/leads";
import { countryName } from "@/lib/taxonomy";

const COLUMNS = ["name", "category", "country", "city", "address", "phone", "email", "emails", "website", "rating", "reviews_count", "status", "maps_url"];

function csvCell(v: unknown) {
  const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: Request) {
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const { where, values } = leadWhere(pickFilters(sp));
  const rows = await query<Record<string, unknown>>(
    `select ${COLUMNS.map((c) => `l.${c}`).join(", ")} from leads l ${where} order by l.id desc`,
    values,
  );
  const lines = [
    COLUMNS.join(","),
    ...rows.map((r) => COLUMNS.map((c) => csvCell(c === "country" ? countryName(r[c] as string) : r[c])).join(",")),
  ];
  return new Response(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
