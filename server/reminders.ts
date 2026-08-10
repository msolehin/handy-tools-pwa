// Reminders that fire while the app is closed — the gap spec.md §8 names.
//
// Every deadline in the app is already a real `date` column, so this is one union over six
// tables rather than a shared reminders store plus a write path in every tool page.
//
// `occasions` is deliberately absent: the Birthdays tool was removed, its table has no
// descriptor in tools.ts and no longer syncs. It was also the only recurring source, which
// is why nothing here does anniversary arithmetic.
import { q } from './db.ts';

export type ReminderSource =
  | 'document' | 'contract' | 'asset' | 'countdown' | 'vehicle_service' | 'home_service';

export type DueReminder = {
  userId: string;
  source: ReminderSource;
  recordId: string;
  title: string;
  dueDate: string;      // YYYY-MM-DD
  offsetDays: number;   // 30 | 7 | 1
  href: string;         // the tool route this record lives in
};

/** The only offsets that fire. No day-of, no overdue. */
export const OFFSETS = [30, 7, 1] as const;

// Railway runs UTC. Bare current_date would drift the boundary by 8 hours and fire a "1 day
// left" reminder on the wrong calendar day for the user.
const TODAY_MYT = `(now() at time zone 'Asia/Kuala_Lumpur')::date`;

const DUE_SQL = `
with t as (select ${TODAY_MYT} as today),
due as (
  select user_id, 'document' as source, id as record_id,
         coalesce(nullif(custom_title, ''), type) as title,
         expiry_date as due_date, '/document-expiry' as href
    from documents
  union all
  select user_id, 'contract', id, title, end_date, '/tenancy'
    from contracts
  union all
  select user_id, 'asset', id, name, expiry_date, '/asset-warranty'
    from assets
  union all
  select user_id, 'countdown', id, title, target_date, '/countdown'
    from countdown_events
  union all
  -- Every row, not the latest per asset: one car legitimately has an oil change, a tyre
  -- rotation and an aircond service open at once. next_done is the user's "dah buat" tick,
  -- which closes the reminder without inventing a service record (migration 006).
  select user_id, 'vehicle_service', id, coalesce(nullif(title, ''), 'Servis'),
         next_service_date, '/vehicle-services'
    from vehicle_service_events
   where next_service_date is not null and not next_done
  union all
  select user_id, 'home_service', id, coalesce(nullif(title, ''), 'Servis'),
         next_service_date, '/home-services'
    from home_service_events
   where next_service_date is not null and not next_done
)
select d.user_id, d.source, d.record_id, d.title,
       d.due_date::text as due_date, d.href,
       (d.due_date - t.today) as offset_days
  from due d
  cross join t
  left join reminder_sends s
    on  s.user_id     = d.user_id
    and s.source      = d.source
    and s.record_id   = d.record_id
    and s.offset_days = (d.due_date - t.today)
 where (d.due_date - t.today) = any($1::int[])
   and s.user_id is null
 order by d.user_id, d.due_date`;

/** Every reminder due today that has not already been delivered. */
export async function dueReminders(): Promise<DueReminder[]> {
  const { rows } = await q(DUE_SQL, [[...OFFSETS]]);
  return rows.map((r) => ({
    userId: r.user_id,
    source: r.source as ReminderSource,
    recordId: r.record_id,
    title: r.title,
    dueDate: r.due_date,
    offsetDays: r.offset_days,
    href: r.href,
  }));
}

export type Digest = {
  userId: string;
  email: string;
  unsubscribeToken: string;
  emailEnabled: boolean;
  pushEnabled: boolean;
  items: DueReminder[];
};

export type Deliver = (d: Digest) => Promise<boolean>;

/**
 * Read a user's preferences, creating the row if it does not exist yet.
 *
 * The upsert has to happen here rather than lazily on first toggle: a user who never opens
 * Settings would otherwise have no row, therefore no unsubscribe_token, and their email would
 * carry a dead unsubscribe link.
 */
async function ensurePrefs(userId: string) {
  const { rows } = await q(
    `insert into notification_prefs (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning email_enabled, push_enabled, unsubscribe_token`, [userId]);
  const { rows: [user] } = await q('select email from users where id = $1', [userId]);
  return { ...rows[0], email: user?.email as string | undefined };
}

/** Only ever called after a delivery actually succeeded. */
async function recordSends(userId: string, items: DueReminder[]) {
  await q(
    `insert into reminder_sends (user_id, source, record_id, offset_days)
     select $1, * from unnest($2::text[], $3::text[], $4::int[])
     on conflict do nothing`,
    [userId, items.map((i) => i.source), items.map((i) => i.recordId),
      items.map((i) => i.offsetDays)]);
}

// Replaced in Task 4 once both channels exist.
const deliverDigest: Deliver = async () => false;

/**
 * One pass: find what is due, group it into one digest per user, deliver, record.
 * Returns counts for the cron response so a silent zero is visible in the logs.
 */
export async function runReminders(deliver: Deliver = deliverDigest) {
  const due = await dueReminders();

  const byUser = new Map<string, DueReminder[]>();
  for (const r of due) {
    const list = byUser.get(r.userId);
    if (list) list.push(r);
    else byUser.set(r.userId, [r]);
  }

  let users = 0;
  for (const [userId, items] of byUser) {
    const prefs = await ensurePrefs(userId);
    if (!prefs.email) continue;
    if (!prefs.email_enabled && !prefs.push_enabled) continue;

    // One user's dead push endpoint or bounced address must not stop everyone behind them.
    let ok = false;
    try {
      ok = await deliver({
        userId,
        email: prefs.email,
        unsubscribeToken: prefs.unsubscribe_token,
        emailEnabled: prefs.email_enabled,
        pushEnabled: prefs.push_enabled,
        items,
      });
    } catch (err) {
      console.error('reminder delivery failed for', userId, err);
    }

    if (!ok) continue;
    await recordSends(userId, items);
    users++;
  }

  return { users, reminders: due.length };
}
