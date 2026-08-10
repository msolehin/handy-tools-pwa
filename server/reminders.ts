// Reminders that fire while the app is closed — the gap spec.md §8 names.
//
// Every deadline in the app is already a real `date` column, so this is one union over six
// tables rather than a shared reminders store plus a write path in every tool page.
//
// `occasions` is deliberately absent: the Birthdays tool was removed, its table has no
// descriptor in tools.ts and no longer syncs. It was also the only recurring source, which
// is why nothing here does anniversary arithmetic.
import { Hono } from 'hono';
import webpush from 'web-push';
import { q } from './db.ts';
import { requireUser } from './auth.ts';

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

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? '';
const REMINDER_FROM = process.env.REMINDER_FROM ?? 'SenangKit <reminder@senangkit.app>';
const APP_ORIGIN = process.env.APP_ORIGIN ?? 'https://senangkit.app';

/** User-controlled titles land in an HTML document. This is a security boundary. */
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const line = (r: DueReminder) =>
  r.offsetDays === 1 ? 'Esok' : `${r.offsetDays} hari lagi`;

/** One digest, never one email per record — eight warranties is one mail, not eight. */
function emailHtml(d: Digest) {
  const rows = d.items.map((r) => `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0">
        <a href="${APP_ORIGIN}${r.href}" style="color:#0f172a;font-weight:600;text-decoration:none">${esc(r.title)}</a>
        <div style="color:#64748b;font-size:13px;margin-top:2px">${esc(r.dueDate)}</div>
      </td>
      <td style="padding:12px 0;border-bottom:1px solid #e2e8f0;text-align:right;white-space:nowrap;color:#b45309;font-weight:600">
        ${line(r)}
      </td>
    </tr>`).join('');

  return `<!doctype html><html><body style="margin:0;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif">
    <div style="max-width:520px;margin:0 auto;padding:32px 24px">
      <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px">Ada yang nak tamat tempoh</h1>
      <p style="color:#64748b;font-size:14px;margin:0 0 24px">Ini rekod dalam SenangKit yang perlu perhatian anda.</p>
      <table style="width:100%;border-collapse:collapse">${rows}</table>
      <p style="margin:32px 0 0;font-size:12px;color:#94a3b8">
        <a href="${APP_ORIGIN}/app" style="color:#64748b">Buka SenangKit</a> &middot;
        <a href="${APP_ORIGIN}/api/unsubscribe?t=${encodeURIComponent(d.unsubscribeToken)}" style="color:#94a3b8">Berhenti terima emel ini</a>
      </p>
    </div>
  </body></html>`;
}

export async function sendEmail(d: Digest): Promise<boolean> {
  if (!RESEND_API_KEY) return false;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: REMINDER_FROM,
      to: d.email,
      subject: d.items.length === 1
        ? `${d.items[0].title} — ${line(d.items[0]).toLowerCase()}`
        : `${d.items.length} rekod nak tamat tempoh`,
      html: emailHtml(d),
    }),
  });

  if (!res.ok) {
    console.error('resend failed', res.status, await res.text().catch(() => ''));
    return false;
  }
  return true;
}

export const reminders = new Hono<{ Variables: { userId: string } }>();

// No session required: the token IS the authorisation. That is what makes the link work from
// a mail client that has never seen the app's cookie.
reminders.get('/unsubscribe', async (c) => {
  const token = c.req.query('t');
  if (!token) return c.text('pautan tidak sah', 400);

  const { rowCount } = await q(
    'update notification_prefs set email_enabled = false, updated_at = now() where unsubscribe_token = $1',
    [token]);

  if (!rowCount) return c.text('pautan tidak sah', 400);
  return c.html(`<!doctype html><meta charset="utf-8"><title>Berhenti langgan</title>
    <div style="font-family:system-ui;max-width:420px;margin:80px auto;padding:0 24px;text-align:center">
      <h1 style="font-size:20px">Sudah berhenti</h1>
      <p style="color:#64748b">Anda tidak akan terima emel peringatan lagi. Boleh hidupkan semula bila-bila dalam Settings.</p>
      <a href="${APP_ORIGIN}/app" style="color:#0f172a">Buka SenangKit</a>
    </div>`);
});

export const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';

// A malformed key pair must not take the whole app down on boot — the rest of SenangKit works
// fine without push, so this fails closed the way an unset ADMIN_EMAIL closes /admin.
const pushConfigured = (() => {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return false;
  try {
    webpush.setVapidDetails('mailto:reminder@senangkit.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    return true;
  } catch (err) {
    console.error('invalid VAPID keys, push disabled:', err);
    return false;
  }
})();

export async function sendPush(d: Digest): Promise<boolean> {
  if (!pushConfigured) return false;

  const { rows } = await q(
    'select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1', [d.userId]);
  if (!rows.length) return false;

  const first = d.items[0];
  const payload = JSON.stringify({
    title: d.items.length === 1 ? first.title : `${d.items.length} rekod nak tamat tempoh`,
    body: d.items.length === 1
      ? `${line(first)} — ${first.dueDate}`
      : d.items.slice(0, 3).map((r) => `${r.title} (${line(r)})`).join('\n'),
    href: d.items.length === 1 ? first.href : '/app',
  });

  let delivered = 0;
  for (const sub of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
      await q('update push_subscriptions set last_ok_at = now() where id = $1', [sub.id]);
      delivered++;
    } catch (err) {
      // 404/410 means the browser threw the subscription away. Anything else is transient,
      // so the row stays and tomorrow's run tries again.
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await q('delete from push_subscriptions where id = $1', [sub.id]);
      } else {
        console.error('push failed', status, err);
      }
    }
  }
  return delivered > 0;
}

/**
 * Both channels fire when both are on — two independent switches, no precedence.
 * Succeeds if either channel landed, so a dead push endpoint does not suppress the email.
 */
const deliverDigest: Deliver = async (d) => {
  const results = await Promise.all([
    d.emailEnabled ? sendEmail(d) : Promise.resolve(false),
    d.pushEnabled ? sendPush(d) : Promise.resolve(false),
  ]);
  return results.some(Boolean);
};

reminders.get('/push/key', (c) => c.json({ key: VAPID_PUBLIC_KEY || null }));

reminders.post('/push/subscribe', requireUser, async (c) => {
  const body = await c.req.json().catch(() => null) as
    { endpoint?: string; keys?: { p256dh?: string; auth?: string } } | null;

  const endpoint = body?.endpoint;
  const p256dh = body?.keys?.p256dh;
  const auth = body?.keys?.auth;
  if (!endpoint || !p256dh || !auth) return c.json({ error: 'invalid subscription' }, 400);

  // Endpoint is unique: re-subscribing on the same browser updates rather than duplicating.
  await q(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update
       set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    [c.get('userId'), endpoint, p256dh, auth]);

  await q(
    `insert into notification_prefs (user_id, push_enabled) values ($1, true)
     on conflict (user_id) do update set push_enabled = true, updated_at = now()`,
    [c.get('userId')]);

  return c.json({ ok: true });
});

reminders.delete('/push/subscribe', requireUser, async (c) => {
  await q('delete from push_subscriptions where user_id = $1', [c.get('userId')]);
  await q(
    `insert into notification_prefs (user_id, push_enabled) values ($1, false)
     on conflict (user_id) do update set push_enabled = false, updated_at = now()`,
    [c.get('userId')]);
  return c.json({ ok: true });
});

reminders.get('/notification-prefs', requireUser, async (c) => {
  const { rows } = await q(
    `insert into notification_prefs (user_id) values ($1)
     on conflict (user_id) do update set user_id = excluded.user_id
     returning email_enabled, push_enabled`, [c.get('userId')]);
  return c.json({
    emailEnabled: rows[0].email_enabled,
    pushEnabled: rows[0].push_enabled,
    pushConfigured,
  });
});

reminders.put('/notification-prefs', requireUser, async (c) => {
  const body = await c.req.json().catch(() => null) as { emailEnabled?: boolean } | null;
  if (typeof body?.emailEnabled !== 'boolean') return c.json({ error: 'invalid' }, 400);

  await q(
    `insert into notification_prefs (user_id, email_enabled) values ($1, $2)
     on conflict (user_id) do update set email_enabled = excluded.email_enabled, updated_at = now()`,
    [c.get('userId'), body.emailEnabled]);
  return c.json({ ok: true });
});

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
