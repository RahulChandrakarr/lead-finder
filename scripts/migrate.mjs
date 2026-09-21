// Applies db/schema.sql to DATABASE_URL. Run with: npm run db:migrate
import { readFileSync } from "node:fs";
import pg from "pg";

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
await client.query(readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8"));
await client.end();
console.log("Schema applied.");
