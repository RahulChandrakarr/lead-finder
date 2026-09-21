import "server-only";

export type LeadFilters = {
  q?: string;
  country?: string;
  category?: string;
  status?: string;
  hasEmail?: string; // "1" = only leads with an email
};

export const LEAD_STATUSES = ["new", "contacted", "replied", "bounced", "unsubscribed"];

/** Builds a parameterised WHERE clause for the leads table (alias `l`). */
export function leadWhere(f: LeadFilters) {
  const clauses: string[] = [];
  const values: unknown[] = [];
  const add = (sql: string, v: unknown) => {
    values.push(v);
    clauses.push(sql.replace("?", `$${values.length}`));
  };
  if (f.q) add(`(l.name ilike ? or l.city ilike $${values.length + 1} or l.email ilike $${values.length + 1})`, `%${f.q}%`);
  if (f.country) add(`l.country = ?`, f.country);
  if (f.category) add(`l.category = ?`, f.category);
  if (f.status) add(`l.status = ?`, f.status);
  if (f.hasEmail === "1") clauses.push(`l.email is not null`);
  return { where: clauses.length ? `where ${clauses.join(" and ")}` : "", values };
}

export function pickFilters(sp: Record<string, string | string[] | undefined>): LeadFilters {
  const s = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  return { q: s("q"), country: s("country"), category: s("category"), status: s("status"), hasEmail: s("hasEmail") };
}
