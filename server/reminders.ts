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
