-- Lead finder + outreach schema. Idempotent: safe to run repeatedly (npm run db:migrate).

create table if not exists scrape_jobs (
  id            bigserial primary key,
  country       text not null,          -- ISO code, e.g. 'us'
  city          text,
  category      text not null,          -- sub-category label from src/lib/taxonomy.ts
  query         text not null,          -- search term sent to Google Maps
  max_results   int  not null,
  apify_run_id  text,
  dataset_id    text,
  status        text not null default 'PENDING', -- PENDING | READY | RUNNING | SUCCEEDED | FAILED | ABORTED | TIMED-OUT
  lead_count    int  not null default 0,
  error         text,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);

create table if not exists leads (
  id              bigserial primary key,
  place_id        text unique,
  name            text not null,
  category_group  text,
  category        text,
  google_category text,
  country         text,
  city            text,
  address         text,
  phone           text,
  website         text,
  email           text,                 -- primary email (first found)
  emails          text[] not null default '{}',
  socials         jsonb  not null default '{}',
  rating          numeric,
  reviews_count   int,
  maps_url        text,
  status          text not null default 'new', -- new | contacted | replied | bounced | unsubscribed
  notes           text,
  job_id          bigint references scrape_jobs(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists leads_country_idx  on leads (country);
create index if not exists leads_category_idx on leads (category);
create index if not exists leads_email_idx    on leads (lower(email));

create table if not exists templates (
  id         bigserial primary key,
  name       text not null,
  subject    text not null,
  body       text not null,
  created_at timestamptz not null default now()
);

create table if not exists campaigns (
  id          bigserial primary key,
  name        text not null,
  template_id bigint not null references templates(id),
  status      text not null default 'draft', -- draft | active | paused | done
  created_at  timestamptz not null default now()
);

create table if not exists campaign_recipients (
  id          bigserial primary key,
  campaign_id bigint not null references campaigns(id) on delete cascade,
  lead_id     bigint not null references leads(id) on delete cascade,
  email       text not null,
  token       uuid not null default gen_random_uuid(), -- unsubscribe token
  status      text not null default 'pending',        -- pending | sending | sent | failed | skipped
  error       text,
  sent_at     timestamptz,
  unique (campaign_id, lead_id)
);
create index if not exists campaign_recipients_status_idx on campaign_recipients (status);

create table if not exists suppressions (
  email      text primary key,           -- stored lower-case
  reason     text,
  created_at timestamptz not null default now()
);

-- Connected Gmail / Google Workspace senders (OAuth; refresh token is AES-GCM encrypted with ENCRYPTION_KEY).
create table if not exists mail_accounts (
  id                bigserial primary key,
  email             text not null unique,
  from_name         text,
  refresh_token_enc text not null,
  daily_limit       int  not null default 400,  -- Gmail ~500/day, Workspace ~2000/day
  created_at        timestamptz not null default now()
);

alter table campaigns           add column if not exists account_id bigint references mail_accounts(id) on delete set null;
alter table campaign_recipients add column if not exists account_id bigint references mail_accounts(id) on delete set null;
alter table campaign_recipients add column if not exists message_id text;
alter table campaign_recipients add column if not exists thread_id  text;
alter table campaign_recipients add column if not exists replied_at timestamptz;
alter table campaign_recipients add column if not exists reply_notified_at timestamptz;

create table if not exists notify_emails (
  email      text primary key,
  created_at timestamptz not null default now()
);
alter table leads add column if not exists site_name text;
alter table leads add column if not exists crawled_at timestamptz;
