// Reminders that fire while the app is closed — the gap spec.md §8 names.
//
// Every deadline in the app is already a real `date` column, so this is one union over seven
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
  | 'document' | 'contract' | 'asset' | 'countdown' | 'home_service'
  | 'garage_reminder' | 'garage_document' | 'garage_mileage';

export type DueReminder = {
  userId: string;
  source: ReminderSource;
  recordId: string;
  title: string;
  dueDate: string;      // YYYY-MM-DD. Empty for mileage rows, which are owed by distance.
  offsetDays: number;   // 30 | 7 | 1
  href: string;         // the tool route this record lives in
  /** Replaces the due date under the title. Set by mileage rows: "Myvi · 90,000 km". */
  subtitle?: string;
  /** Replaces the "N hari lagi" pill. Set by mileage rows: "lagi 300 km". */
  pill?: string;
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
  -- Garaj reminders owed by date. Unlike the service-event arm this replaces, there is no
  -- distinct-on: a reminder is an explicit row the owner created and closed, not the tail of a
  -- log that has to be de-duplicated by title.
  select user_id, 'garage_reminder', id, coalesce(nullif(label, ''), 'Servis'),
         due_date, '/vehicle-services'
    from garage_reminders
   where due_date is not null and not done
  union all
  select user_id, 'garage_document', id,
         initcap(replace(type, 'roadtax', 'road tax')), expiry, '/vehicle-services'
    from garage_documents
  union all
  select user_id, 'home_service', id, coalesce(nullif(title, ''), 'Servis'),
         next_service_date, '/home-services'
    from (select distinct on (user_id, asset_id, title) *
            from home_service_events
           order by user_id, asset_id, title, date desc, pos desc) h
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

/** A service is near on the odometer inside this many km. Mirrors KM_SOON in src/lib/horizon.ts. */
export const KM_SOON = 500;

// Reminders owed on the odometer rather than the calendar.
//
// Simpler and more accurate than the version this replaces: odo is a real integer on every
// record now, so the current reading is a plain max across three tables. The old query had to
// regex digits out of a free-text mileage field and fall back to vehicle_assets.mileage.
//
// The honest limit is unchanged: the odometer only moves when the user enters something, so
// this can only fire on the run after they did. A car driven 900 km without an entry is
// invisible here, which is why the tool page nags on screen as well.
//
// ponytail: still no rate estimation, for the same reason as before — a projected date that is
// wrong buzzes someone's phone about a service that is not due. The client shows a projection
// because the user can see the assumption; a push notification cannot carry that caveat.
const MILEAGE_SQL = `
with odo as (
  select v.user_id, v.id as vehicle_id,
         greatest(
           v.mileage,
           coalesce((select max(odo) from garage_energy_logs e
                      where e.user_id = v.user_id and e.vehicle_id = v.id), 0),
           coalesce((select max(odo) from garage_services s
                      where s.user_id = v.user_id and s.vehicle_id = v.id), 0),
           coalesce((select max(odo) from garage_odo_logs o
                      where o.user_id = v.user_id and o.vehicle_id = v.id), 0)
         ) as current_odo,
         coalesce(nullif(v.nickname, ''), v.model) as vehicle_name
    from garage_vehicles v
)
select r.user_id, 'garage_mileage' as source, r.id as record_id,
       coalesce(nullif(r.label, ''), 'Servis') as title,
       '' as due_date, '/vehicle-services' as href,
       odo.vehicle_name || ' · ' || to_char(odo.current_odo, 'FM999,999,999') || ' km' as subtitle,
       case when odo.current_odo >= r.due_odo then 'lepas ' || to_char(odo.current_odo - r.due_odo, 'FM999,999,999') || ' km'
            else 'lagi ' || to_char(r.due_odo - odo.current_odo, 'FM999,999,999') || ' km' end as pill,
       case when odo.current_odo >= r.due_odo then 1 else 7 end as offset_days
  from garage_reminders r
  join odo on odo.user_id = r.user_id and odo.vehicle_id = r.vehicle_id
  left join reminder_sends s
    on  s.user_id   = r.user_id
    and s.source    = 'garage_mileage'
    and s.record_id = r.id
    and s.offset_days = case when odo.current_odo >= r.due_odo then 1 else 7 end
 where r.due_odo is not null
   and not r.done
   and odo.current_odo >= r.due_odo - ${KM_SOON}
   and s.user_id is null`;

/** Every reminder due today that has not already been delivered, by date and by odometer. */
export async function dueReminders(): Promise<DueReminder[]> {
  const { rows } = await q(DUE_SQL, [[...OFFSETS]]);
  const dated: DueReminder[] = rows.map((r) => ({
    userId: r.user_id,
    source: r.source as ReminderSource,
    recordId: r.record_id,
    title: r.title,
    dueDate: r.due_date,
    offsetDays: r.offset_days,
    href: r.href,
  }));

  const { rows: mileage } = await q(MILEAGE_SQL);
  return dated.concat(mileage.map((r) => ({
    userId: r.user_id,
    source: r.source as ReminderSource,
    recordId: r.record_id,
    title: r.title,
    dueDate: r.due_date,
    offsetDays: r.offset_days,
    href: r.href,
    subtitle: r.subtitle,
    pill: r.pill,
  })));
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
  r.pill ?? (r.offsetDays === 1 ? 'Esok' : `${r.offsetDays} hari lagi`);

/**
 * Red at one day, orange at seven, yellow at thirty.
 *
 * A tinted pill rather than coloured text: yellow on white is 1.9:1 contrast, nowhere near the
 * 4.5:1 body text needs, and a reminder nobody can read is worse than an uncoloured one. The
 * light background carries the hue, the dark text of the same hue stays legible. All six values
 * are Tailwind's 100/700 steps, so they match the palette the app already uses.
 */
const URGENCY: Record<number, { bg: string; fg: string }> = {
  1: { bg: '#fee2e2', fg: '#b91c1c' },   // red-100 / red-700
  7: { bg: '#ffedd5', fg: '#c2410c' },   // orange-100 / orange-700
  30: { bg: '#fef9c3', fg: '#a16207' },  // yellow-100 / yellow-700
};
const urgencyOf = (days: number) => URGENCY[days] ?? URGENCY[30];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** 2026-08-08 is machine output. Nobody says that out loud — "8 August 2026" is. */
function fmtDate(iso: string) {
  const [y, m, day] = iso.split('-').map(Number);
  const month = MONTHS[m - 1];
  return month ? `${day} ${month} ${y}` : iso;
}

/** What sits under the title: the due date for dated records, the odometer for mileage ones. */
const detail = (r: DueReminder) => r.subtitle ?? fmtDate(r.dueDate);

// Inter first, matching tailwind.config.js `sans`, then the system stack. Gmail strips the
// stylesheet link below so it falls back there; Apple Mail and iOS Mail honour it.
const FONT = `Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

/**
 * The header wordmark, matching Layout.tsx: "Senang" in the text colour, "Kit" in the
 * pink-500 -> orange-400 gradient.
 *
 * The app does that gradient with `bg-clip-text` + `text-transparent`, which no email client
 * supports — Gmail and Outlook would paint the background and leave the letters invisible.
 * Three solid steps sampled along the same ramp read almost identically and work everywhere.
 */
const WORDMARK = `Senang<span style="color:#ec4899">K</span><span style="color:#f66d69">i</span><span style="color:#fb923c">t</span>`;

/**
 * One digest, never one email per record — eight warranties is one mail, not eight.
 *
 * Tables and inline styles, not flexbox: Outlook still renders with Word's engine, and Gmail
 * strips <style> blocks and @font-face.
 */
function emailHtml(d: Digest) {
  const cell = 'padding:12px 0;border-bottom:1px solid #e2e8f0';

  const rows = d.items.map((r) => `
    <tr>
      <td style="${cell};font-family:${FONT}">
        <a href="${APP_ORIGIN}${r.href}" style="color:#0f172a;font-weight:600;text-decoration:none">${esc(r.title)}</a>
        <div style="color:#64748b;font-size:13px;margin-top:2px">${esc(detail(r))}</div>
      </td>
      <td align="right" valign="top" style="${cell};font-family:${FONT};text-align:right;white-space:nowrap;padding-left:12px">
        <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${urgencyOf(r.offsetDays).bg};color:${urgencyOf(r.offsetDays).fg};font-size:13px;font-weight:700">${line(r)}</span>
      </td>
    </tr>`).join('');

  // Shown next to the subject in the inbox list, before anything is opened.
  const preheader = d.items.map((r) => `${r.title} — ${line(r).toLowerCase()}`).join(' · ');

  return `<!doctype html>
<html lang="ms">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>Ada yang nak tamat tempoh</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;background:#f8fafc;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(preheader)}</div>

<div style="max-width:520px;margin:0 auto;padding:32px 24px">

  <!-- favicon.png is the transparent bolt the app header itself uses (Layout.tsx:319), not the
       dark-square pwa icon. PNG rather than the favicon.svg the app now renders, because Gmail
       and Outlook strip inline and linked SVG. It is rendered from that same vector, so its
       ratio is the viewBox's 117.4x193.7 and 17x28 keeps it undistorted — email clients need
       both dimensions stated or Outlook guesses.
       The wordmark is real text beside it, so the header still reads when the client blocks
       images, which Gmail does by default for a first-time sender. -->
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px">
    <tr>
      <td width="17" valign="middle" style="padding-right:9px">
        <img src="${APP_ORIGIN}/favicon.png" width="17" height="28" alt=""
             style="display:block;width:17px;height:28px;border:0">
      </td>
      <td valign="middle" style="font-family:${FONT};font-size:20px;font-weight:700;color:#0f172a;letter-spacing:-0.02em">
        ${WORDMARK}
      </td>
    </tr>
  </table>

  <h1 style="font-size:20px;color:#0f172a;margin:0 0 4px">Ada yang nak tamat tempoh</h1>
  <p style="color:#64748b;font-size:14px;margin:0 0 24px">Ini rekod dalam SenangKit yang perlu perhatian anda.</p>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse">${rows}</table>

  <p style="margin:32px 0 0;font-size:12px;color:#94a3b8">
    <a href="${APP_ORIGIN}/app" style="color:#64748b">Buka SenangKit</a> &middot;
    <a href="${APP_ORIGIN}/api/unsubscribe?t=${encodeURIComponent(d.unsubscribeToken)}" style="color:#94a3b8">Berhenti terima emel ini</a>
  </p>

</div>
</body>
</html>`;
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
      ? `${line(first)} — ${detail(first)}`
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

const CRON_SECRET = process.env.CRON_SECRET ?? '';

/**
 * Driven by Railway cron, not an in-process timer: a setInterval dies on every redeploy and
 * fires twice if the service ever runs two instances.
 *
 * Fails closed — with CRON_SECRET unset this answers 404 for everyone, the way /admin does.
 */
reminders.post('/cron/reminders', async (c) => {
  if (!CRON_SECRET) return c.notFound();
  if (c.req.header('authorization') !== `Bearer ${CRON_SECRET}`) return c.notFound();

  const result = await runReminders();
  console.log('reminders run', result);
  return c.json(result);
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
    // Most urgent first, in both channels. The query already returns this order, but the
    // promise belongs where it is rendered — push only shows the first three, and a digest
    // that buried "esok" under four 30-day rows would be the wrong mail entirely.
    items.sort((a, b) => a.offsetDays - b.offsetDays || a.title.localeCompare(b.title));

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
