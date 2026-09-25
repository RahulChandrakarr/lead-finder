import "server-only";
import { Pool, type QueryResultRow } from "pg";

// Supabase's direct host (db.<ref>.supabase.co) publishes only an IPv6 address.
// Vercel is IPv4-only, so that URL fails at runtime. Rewrite it to the shared
// transaction pooler, which is IPv4. A pooler URL is left unchanged.
function connectionString() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return raw;

  const url = new URL(raw);
  const ref = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
  if (!ref) return raw;

  const region = process.env.SUPABASE_POOLER_REGION || "ap-south-1";
  url.hostname = `aws-0-${region}.pooler.supabase.com`;
  url.port = "6543";
  if (url.username === "postgres") url.username = `postgres.${ref}`;
  return url.toString();
}

// Reuse one pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool =
  globalForDb.pgPool ??
  new Pool({
    connectionString: connectionString(),
    ssl: { rejectUnauthorized: false },
    max: 5,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") globalForDb.pgPool = pool;

export async function query<T extends QueryResultRow>(text: string, params: unknown[] = []) {
  const res = await pool.query<T>(text, params);
  return res.rows;
}
