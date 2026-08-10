# Reminders — email and web push

**Date:** 2026-08-10
**Status:** approved, not yet implemented

## Problem

`spec.md` §8 states it plainly: notifications only appear **while the app is open**. For an app
whose entire pitch is "surface it *before* the deadline", that is backwards. Nobody opens a
road-tax tracker in the five months between renewals, so the one alert that matters is the one
the user never sees.

The backend that used to block this already exists. Every deadline in the app is a real `date`
column in Postgres, not a field to be parsed out of a JSON blob. What is missing is a scheduler
and two delivery channels.

Secondary effect, and the reason this is worth doing before anything else: signing in currently
buys you sync, which nobody wakes up wanting. "We will email you a month before your road tax
expires" is a benefit a first-time visitor understands in four seconds. Reminders are the
sign-in pitch, not just a retention feature.

## Scope

**In:** hard deadlines only — records with one real expiry date.

**Out:** monthly money (`commitments`, `ious`) and daily nudges (habits, water). A daily
"minum air!" push is the fastest way to get notifications blocked entirely, which would kill
the road-tax reminder along with it. Deliberate, not deferred-by-accident.

**Out:** signed-out users. They have no email address and no server record. This is inherent to
the device-first design, not a gap to close.

## Sources

Six, all one-off dates. There is no recurring source, so no anniversary arithmetic anywhere.

| Source table | Column | Tool | Filter |
|---|---|---|---|
| `documents` | `expiry_date` | Dokumen | — |
| `contracts` | `end_date` | Sewa & Kontrak | — |
| `assets` | `expiry_date` | Waranti | — |
| `countdown_events` | `target_date` | Countdown | — |
| `vehicle_service_events` | `next_service_date` | Servis Kenderaan | `is not null and not next_done` |
| `home_service_events` | `next_service_date` | Servis Rumah | `is not null and not next_done` |

**`occasions` is excluded.** The Birthdays tool was removed; the table has no descriptor in
`server/tools.ts`, no longer syncs, and its rows are stale. (`spec.md` §2 and §7 are out of date
on this — a separate fix.)

**Service events fire per row, not per asset.** A car legitimately has several open next-service
dates at once — oil change, tyre rotation, aircond — and each is its own reminder. The event's
`title` goes in the reminder line so they read as distinct items. `next_done` is the user's
"dah buat" tick, already wired to the client in migration `006`, and it closes the reminder
without inventing a service record.

## Cadence

**30 / 7 / 1 days before. No day-of ping, no overdue ping.**

30 days is the offset that actually matters: road tax renews two months early, passports take
weeks, insurance needs shopping around. A reminder that lands 3 days out only tells you that you
are already late. 7 is the nudge, 1 is the last call.

There is no "it expired" email, because that mail's real message is that the reminders failed.

## Data

Migration `008_reminders.sql`, three tables. All additive; nothing existing changes.

```sql
create table notification_prefs (
  user_id           uuid primary key references users(id) on delete cascade,
  email_enabled     boolean not null default true,
  push_enabled      boolean not null default false,
  unsubscribe_token text not null default gen_random_uuid()::text,
  updated_at        timestamptz not null default now()
);

-- One row per browser, not per user. Same account on phone + laptop = two rows.
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

-- Dedup ledger. Written only after a successful send, so a failed run retries
-- tomorrow instead of going permanently silent.
create table reminder_sends (
  user_id     uuid not null references users(id) on delete cascade,
  source      text not null,          -- 'document' | 'contract' | 'asset' | ...
  record_id   text not null,
  offset_days int  not null,          -- 30 | 7 | 1
  sent_at     timestamptz not null default now(),
  primary key (user_id, source, record_id, offset_days)
);
```

A user with no `notification_prefs` row is treated as email-on, push-off, so sign-in stays a
single insert and existing users need no backfill.

The scheduler **upserts the prefs row for every user it is about to email**, before sending.
Creating it lazily on first toggle alone would be wrong: a user who never opens Settings would
have no row, therefore no `unsubscribe_token`, and their email would carry a dead unsubscribe
link. Every email must have a working one.

## Server

New module `server/reminders.ts`, mounted alongside the existing `api` sub-app in
`server/app.ts`, following the pattern `server/admin.ts` already uses.

### The query

One `union all` over the six sources, each projecting
`(source, record_id, title, due_date, user_id)`, then filtered:

```sql
where due_date - current_date in (30, 7, 1)
```

and left-joined against `reminder_sends` on
`(user_id, source, record_id, offset_days)` to drop anything already delivered.

No shared reminders store, no per-tool abstraction. `spec.md` §8 proposes one; it is not built
here because six `union all` branches over existing typed columns is smaller than a new store
plus a migration per tool plus a write path in every page.

<!-- ponytail: six-branch union query. Extract a reminders table when a 4th tool needs a
     date shape this query cannot express — recurrence, multiple dates per record, or a
     deadline computed rather than stored. -->

### Trigger

Railway cron → `POST /api/cron/reminders`, `Authorization: Bearer $CRON_SECRET`,
daily at `0 0 * * *` UTC = 08:00 MYT.

An external cron rather than an in-process timer: a `setInterval` dies on every redeploy and
fires twice if the service ever runs two instances. No scheduler dependency either way.

Fails closed — with `CRON_SECRET` unset the route answers 404 for everyone, the same way
`/admin` does with `ADMIN_EMAIL` unset.

### Timezone

Hardcoded `Asia/Kuala_Lumpur`. Single-country app; a per-user timezone column would never hold
a second distinct value.

<!-- ponytail: hardcoded MYT. Add a users.timezone column if the app ships outside Malaysia. -->

## Delivery

**One digest per user per run, per channel** — not one message per record. A user with eight
warranties crossing the 30-day mark gets one email listing eight items. One-per-record is how
you get marked as spam by week three.

Both channels fire when both are enabled. Two independent switches, no precedence logic.

### Email

`fetch()` to the Resend API. No new dependency — it is a JSON POST with a bearer token.

Every email carries an unsubscribe link to `GET /api/unsubscribe?t=<unsubscribe_token>`, which
flips `email_enabled` to false and needs no session — the token *is* the authorisation.

With `RESEND_API_KEY` unset, no email is attempted and nothing else is affected.

### Push

The `web-push` package — **the one new dependency**. Web Push requires ECDH key agreement and
AES-GCM payload encryption per subscription; hand-rolling that is how you ship a bug that fails
silently on one browser. This is a security boundary, so the library wins over a smaller diff.

Requires `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`. A `404` or `410 Gone` from the push service
means the subscription is dead and its row is deleted. Any other error leaves the row alone and
the send unrecorded, so it retries tomorrow.

With the VAPID keys unset, the push toggle reports "not configured" rather than failing on tap.

## Client

### Service worker

A new static `public/push-sw.js` with a `push` handler and a `notificationclick` handler that
focuses an existing tab or opens the record's tool route.

Pulled in via `workbox.importScripts` in `vite.config.ts`. This keeps `registerType: 'autoUpdate'`
and the generated service worker exactly as they are. Converting the setup to `injectManifest`
to accommodate roughly twenty lines would be the expensive way to reach the same place, and it
would put the existing `navigateFallbackDenylist` handling for `/api/*` and `/admin` at risk.

### Settings

Two switches in the existing Settings bottom sheet in `src/components/Layout.tsx`, rendered only
when signed in:

- **Email reminders** — on by default. Toggling writes `notification_prefs`.
- **Push notifications** — off by default; the browser requires a user gesture to grant
  permission. Toggling on calls `Notification.requestPermission()`, subscribes with the VAPID
  public key fetched from the server, and POSTs the subscription.

The VAPID public key is served from an endpoint rather than inlined via a `VITE_` variable, so
rotating it does not require a rebuild.

**iOS:** Web Push only works once the PWA is installed to the home screen. When
`navigator.standalone` is false on iOS, the push toggle says so and points at the existing
install CTA instead of failing silently on a denied permission.

## Environment

Four new variables in `.env.example`, all optional, each failing closed in the manner the file
already establishes for `ADMIN_EMAIL`:

```
RESEND_API_KEY=      # unset -> no email sent
CRON_SECRET=         # unset -> /api/cron/reminders answers 404
VAPID_PUBLIC_KEY=    # unset -> push toggle reports "not configured"
VAPID_PRIVATE_KEY=
```

With all four unset the app boots and behaves exactly as it does today.

## Testing

One server test, in the existing `node --test` style, no framework and no fixtures:

1. Seed a user with records at exactly 30, 7, 1, 45 and 0 days out across at least three sources.
2. Assert the query returns exactly the 30/7/1 records and nothing else.
3. Assert a service event with `next_done = true` is excluded.
4. Run the scheduler twice on the same day; assert the second run sends nothing.

Test 4 is the one that matters — the dedup ledger is the only thing standing between a Railway
retry and a user getting the same email three times.

## Deferred

| Shortcut | Upgrade when |
|---|---|
| Six-branch union query instead of a shared reminders store | a 4th tool needs a date shape the query cannot express |
| Hardcoded `Asia/Kuala_Lumpur` | the app ships outside Malaysia |
| Two channel switches, no per-tool granularity | users ask to mute one tool without muting all |
| No quiet hours | someone actually complains about 08:00 |
| Digest sent even if it repeats yesterday's items at a different offset | never — 30/7/1 are far enough apart |
