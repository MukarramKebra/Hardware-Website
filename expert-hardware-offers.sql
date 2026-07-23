-- ═══════════════════════════════════════════════════════════════════════════
--  Expert Hardware — "Subscribe to offers" + email campaigns
--  Run this in the Supabase SQL editor (project ref: qhebhvllkovfbkqrcnmm).
--  Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE throughout.
-- ═══════════════════════════════════════════════════════════════════════════

-- gen_random_uuid() lives in pgcrypto (already enabled on Supabase, but be safe)
create extension if not exists pgcrypto;

-- ── 1. Subscribers ─────────────────────────────────────────────────────────
create table if not exists public.offer_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique,
  consent           boolean not null default false,
  consent_at        timestamptz,
  created_at        timestamptz not null default now(),
  unsubscribed      boolean not null default false,
  unsubscribe_token uuid not null default gen_random_uuid()
);

create index if not exists offer_subscribers_active_idx
  on public.offer_subscribers (unsubscribed) where unsubscribed = false;

-- ── 2. Campaigns (composed + sent/scheduled from the admin panel) ───────────
create table if not exists public.offer_campaigns (
  id           uuid primary key default gen_random_uuid(),
  subject      text not null,
  html         text not null,
  status       text not null default 'draft',   -- draft | scheduled | sending | sent | failed
  scheduled_at timestamptz,                      -- null = send immediately
  created_at   timestamptz not null default now(),
  sent_at      timestamptz,
  sent_count   integer not null default 0,
  error        text,
  created_by   text                              -- admin display name (audit only)
);

create index if not exists offer_campaigns_due_idx
  on public.offer_campaigns (status, scheduled_at);

-- ── 3. Row-Level Security ──────────────────────────────────────────────────
-- The storefront uses the PUBLIC ANON key. It must be able to add a subscriber
-- (and nothing else). It must NEVER read the table (unsubscribe_token is a
-- secret) nor update/delete rows. All campaign + sending logic runs in the
-- Edge Functions under the SERVICE ROLE, which bypasses RLS entirely.

alter table public.offer_subscribers enable row level security;
alter table public.offer_campaigns   enable row level security;

-- anon may INSERT a subscriber, only with real consent recorded.
drop policy if exists offer_sub_insert_anon on public.offer_subscribers;
create policy offer_sub_insert_anon
  on public.offer_subscribers
  for insert
  to anon
  with check (consent = true);

-- No SELECT / UPDATE / DELETE policies for anon on either table => denied.
-- (offer_campaigns has NO anon policies at all => fully locked to the public key.)

-- ═══════════════════════════════════════════════════════════════════════════
--  4. SCHEDULED SENDS — pg_cron + pg_net
--  Runs every minute and asks the send-offers Edge Function to process any
--  campaigns whose scheduled_at has passed. Fill in the two placeholders:
--    <PROJECT_REF>        -> qhebhvllkovfbkqrcnmm
--    <ADMIN_SEND_TOKEN>   -> the same random token you set as the Edge Function
--                            secret (see deploy notes). Keep it out of git.
--  Enable the extensions first (Dashboard → Database → Extensions, or below).
-- ═══════════════════════════════════════════════════════════════════════════
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove any previous copy of the job before (re)creating it.
select cron.unschedule('send-offers-scheduled')
  where exists (select 1 from cron.job where jobname = 'send-offers-scheduled');

select cron.schedule(
  'send-offers-scheduled',
  '* * * * *',   -- every minute; change to '*/5 * * * *' for every 5 min
  $$
  select net.http_post(
    url     := 'https://<PROJECT_REF>.functions.supabase.co/send-offers',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'x-admin-token', '<ADMIN_SEND_TOKEN>'
               ),
    body    := jsonb_build_object('action', 'run_scheduled')
  );
  $$
);

-- To inspect / remove later:
--   select * from cron.job;
--   select cron.unschedule('send-offers-scheduled');
