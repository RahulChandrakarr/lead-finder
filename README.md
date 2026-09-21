# Lead Finder

Find business contacts (Google Maps + website emails via Apify) by country and category, then run drip email campaigns.

## Setup

1. `cp .env.example .env.local` and fill it in (`APIFY_TOKEN`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` or `SMTP_*`, `MAIL_POSTAL_ADDRESS`, `APP_PASSWORD`, `CRON_SECRET`).
2. `npm run db:migrate` — creates tables in `DATABASE_URL` (idempotent).
3. `npm run dev` → http://localhost:3000 (basic auth: any username + `APP_PASSWORD`).

## Flow

- **Find leads** — pick country, city, categories → one Apify run per category; results import automatically.
- **Leads** — filter, change status, export CSV.
- **Templates** — subject/body with `{{business_name}} {{category}} {{city}} {{country}} {{website}}`.
- **Mail accounts** — *Connect Gmail* (OAuth, `gmail.send` scope) for one or more Gmail/Workspace senders, each with its own daily limit. Setup steps are shown on the page.
- **Campaigns** — pick sender + template + lead filter → draft → *Start sending*. Emails go out in batches
  (`BATCH_SIZE`) capped at `DAILY_SEND_LIMIT` per 24h, via *Send next batch now* or a scheduler hitting
  `GET /api/cron/send` with `Authorization: Bearer $CRON_SECRET` (e.g. every 10 min).
- Every email has an unsubscribe link + one-click `List-Unsubscribe` header; unsubscribed/bounced emails are suppressed.
