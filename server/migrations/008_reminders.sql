-- Reminders that fire while the app is closed. Additive only: nothing existing changes, and
-- with the env vars unset none of this is ever read.

create table notification_prefs (
  user_id           uuid primary key references users(id) on delete cascade,
  email_enabled     boolean not null default true,
  push_enabled      boolean not null default false,
  unsubscribe_token text not null default gen_random_uuid()::text,
  updated_at        timestamptz not null default now()
);

-- One row per browser, not per user: the same account on a phone and a laptop is two rows.
create table push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  last_ok_at timestamptz
);

create index push_subscriptions_user_id_idx on push_subscriptions (user_id);

-- Dedup ledger. Written only after a successful send, so a failed run retries tomorrow
-- instead of going permanently silent. No due_date in the key: every source is a one-off
-- date, so a record never fires the same offset twice.
create table reminder_sends (
  user_id     uuid not null references users(id) on delete cascade,
  source      text not null,
  record_id   text not null,
  offset_days int  not null,
  sent_at     timestamptz not null default now(),
  primary key (user_id, source, record_id, offset_days)
);
