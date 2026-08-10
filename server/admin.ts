// Owner-only monitoring page. Server-rendered HTML on purpose: it stays out of the client
// bundle, out of the tool registry, and out of the service worker's precache, so the public
// PWA carries no trace of it.
//
// SECURITY: every route here is behind requireUser -> requireAdmin (see the middleware below),
// and every value interpolated into the HTML goes through esc(). Feedback messages and account
// names are user-controlled text landing in a document — that escaping is the security boundary
// of this file, not a nicety.
//
// DESIGN: deliberately not the app's look. SenangKit is a soft, rounded, dark consumer PWA;
// this is the back of the machine — a service log for the app itself, in the same visual
// language as the documents it helps people track. Serif for words a human wrote, mono for
// numbers a machine counted; that split is the page's whole hierarchy. Copy is Malay like the
// rest of the product, with stored enums staying English behind a display map.
import { Hono } from 'hono';
import { hasDb, q } from './db.ts';
import { GOOGLE_CLIENT_ID, requireUser, requireAdmin } from './auth.ts';

type Vars = { Variables: { userId: string } };

export const admin = new Hono<Vars>();

admin.use('*', async (c, next) => {
  if (!hasDb) return c.text('database not configured', 503);
  await next();
});
admin.use('*', requireUser);
admin.use('*', requireAdmin);

/** Past this, the backup panel turns red. */
const STALE_DAYS = 7;
/** Past this with no writes, a tool reads as going cold. */
const COLD_DAYS = 60;
/** The hero shows an opening, not an essay. The full text lives in the Mesej view. */
const HERO_CHARS = 190;
/** Rows per page for the listings. */
const PAGE_SIZE = 25;

/** The left menu. Order is the reading order: what happened, then the detail behind it. */
const VIEWS = ['ringkasan', 'mesej', 'alat', 'akaun'] as const;
type View = typeof VIEWS[number];
const VIEW_LABEL: Record<View, string> = {
  ringkasan: 'Ringkasan', mesej: 'Mesej', alat: 'Alat', akaun: 'Akaun',
};

/** Anything not on the list is the overview — a bad query string is not an error page. */
const viewOf = (raw: string | undefined): View =>
  (VIEWS as readonly string[]).includes(raw ?? '') ? raw as View : 'ringkasan';

/**
 * Clamp a page number into the range that actually exists. `?page=abc`, `?page=-4` and
 * `?page=9999` all have to land somewhere sensible rather than produce an empty table or a
 * negative OFFSET.
 */
function pageOf(raw: string | undefined, total: number): number {
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const asked = Math.floor(Number(raw));
  if (!Number.isFinite(asked) || asked < 1) return 1;
  return Math.min(asked, last);
}

const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, (ch) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]!
));

/** Stored kinds stay English; Malay is a display concern, as everywhere else in the app. */
const KIND_LABEL: Record<string, string> = {
  bug: 'Pepijat', complaint: 'Aduan', idea: 'Idea', feedback: 'Maklum balas',
};
// Red is the page's only loud colour, so it is spent on the two kinds that mean something
// is wrong. Ideas get the second ink, plain feedback stays quiet.
const KIND_TONE: Record<string, string> = {
  bug: 'bad', complaint: 'bad', idea: 'good', feedback: 'soft',
};

function rel(v: string | Date | null | undefined): string {
  if (!v) return 'tiada';
  const secs = Math.round((Date.now() - new Date(v).getTime()) / 1000);
  if (secs < 60) return 'baru sahaja';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min lalu`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return `${Math.round(days / 30)} bulan lalu`;
}

const daysSince = (v: string | Date | null | undefined) =>
  v ? (Date.now() - new Date(v).getTime()) / 86_400_000 : Infinity;

function size(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1_048_576) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}

const num = (n: unknown) => Number(n ?? 0).toLocaleString('en-GB');

const CSS = `
:root{
  color-scheme:light dark;
  --paper:#E9EBE3; --paper-2:#F2F4EC; --ink:#1B2A26; --ink-soft:#5F6C66;
  --rule:#C3C9BD; --red:#B3122B; --stamp:#2F6F62;
  --mono:ui-monospace,'Cascadia Mono','Segoe UI Mono','SF Mono',Menlo,Consolas,monospace;
  --serif:Georgia,'Iowan Old Style','Times New Roman',serif;
  --sans:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
}
/* Checked at 6am on a phone as often as at a desk, so the ledger inverts rather than glaring. */
@media (prefers-color-scheme:dark){
  :root{
    --paper:#121917; --paper-2:#1A2321; --ink:#DFE4DA; --ink-soft:#8B978F;
    --rule:#2B3733; --red:#FF7A7A; --stamp:#74C4B0;
  }
}
*{box-sizing:border-box}
body{margin:0;padding:26px 20px 80px;background:var(--paper);color:var(--ink);
  font-family:var(--sans);font-size:14px;line-height:1.55;-webkit-font-smoothing:antialiased;
  overflow-wrap:break-word}
.wrap{max-width:840px;margin:0 auto}
a{color:inherit}
:focus-visible{outline:2px solid var(--red);outline-offset:3px}

/* Shell — menu rail beside the sheet. */
.shell{display:grid;grid-template-columns:164px minmax(0,1fr);gap:36px;align-items:start;
  margin-top:22px}
.nav{position:sticky;top:26px;display:flex;flex-direction:column}
.nav a{display:flex;justify-content:space-between;align-items:baseline;gap:10px;
  font-family:var(--mono);font-size:11px;letter-spacing:.13em;text-transform:uppercase;
  text-decoration:none;color:var(--ink-soft);padding:10px 10px 10px 13px;
  border-left:2px solid transparent}
.nav a:hover{color:var(--ink)}
.nav a.on{color:var(--ink);border-left-color:var(--ink);background:var(--paper-2)}
.nav .c{font-size:10px;font-variant-numeric:tabular-nums}
.dot{width:6px;height:6px;border-radius:50%;background:var(--red);display:inline-block}

/* Pagination — only rendered when a list actually outgrows one page. */
.pager{display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:baseline;
  margin-top:20px;font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--ink-soft)}
.pager a{color:var(--ink);text-decoration:none;border-bottom:1px solid var(--ink);padding-bottom:2px}
.pager .off{opacity:.3}
.pager b{color:var(--ink);font-weight:600;padding:0 8px;font-variant-numeric:tabular-nums}

/* Masthead — a form header, not a logo lockup. */
.mast{display:flex;justify-content:space-between;align-items:baseline;gap:14px;
  flex-wrap:wrap;font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink-soft);
  border-bottom:2px solid var(--ink);padding-bottom:9px}
.mast > *{min-width:0;overflow-wrap:anywhere}
.mast strong{color:var(--ink);font-weight:700}

/* Hero — a sentence someone wrote, at the size a number usually gets. */
.hero{padding:34px 0 28px;border-bottom:1px solid var(--rule)}
.eyebrow{font-family:var(--mono);font-size:10.5px;letter-spacing:.18em;text-transform:uppercase;
  color:var(--ink-soft);margin:0 0 16px}
.quote{font-family:var(--serif);font-size:clamp(21px,4.4vw,31px);line-height:1.32;
  letter-spacing:-.011em;margin:0;text-wrap:pretty}
.quote.none{color:var(--ink-soft);font-style:italic}
.hero-meta{font-family:var(--mono);font-size:10.5px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--ink-soft);margin-top:18px;display:flex;flex-wrap:wrap;gap:12px;align-items:center}
/* An address is not a label: leave its case alone, and let it break rather than widen the page. */
.who{text-transform:none;letter-spacing:.02em;overflow-wrap:anywhere;min-width:0}

/* Readings — gauges, not trophies. Small on purpose. */
.readings{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));
  border-bottom:1px solid var(--rule)}
.reading{padding:18px 14px 18px 0}
.reading .n{font-family:var(--mono);font-size:25px;font-weight:600;line-height:1;
  font-variant-numeric:tabular-nums;letter-spacing:-.025em}
.reading .k{font-family:var(--mono);font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
  color:var(--ink-soft);margin-top:8px}

h2{font-family:var(--mono);font-size:10.5px;font-weight:700;letter-spacing:.18em;
  text-transform:uppercase;color:var(--ink);margin:42px 0 0;padding-bottom:9px;
  border-bottom:2px solid var(--ink);display:flex;justify-content:space-between;
  gap:12px;flex-wrap:wrap}
h2 em{font-style:normal;font-weight:400;color:var(--ink-soft);letter-spacing:.1em}

/* Backup — quiet when fresh, unmissable when not. */
/* No bottom rule: this is the last block on the overview, and .foot already draws a heavier
   one — the two together left an empty ruled band. */
.backup{display:flex;flex-wrap:wrap;gap:18px;align-items:center;justify-content:space-between;
  padding:20px 0}
.backup .when{font-family:var(--mono);font-size:17px;letter-spacing:-.01em}
.backup.stale .when{color:var(--red)}
.backup .note{font-size:12.5px;color:var(--ink-soft);margin-top:7px;max-width:46ch}
.btn{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;
  border:1.5px solid var(--ink);color:var(--ink);text-decoration:none;padding:12px 18px;
  display:inline-block;white-space:nowrap}
.btn:hover{background:var(--ink);color:var(--paper)}

/* Messages — prose stays sans and readable; only the stamp line is mono. */
.msg{padding:18px 0;border-bottom:1px solid var(--rule)}
.msg .t{font-size:14.5px;line-height:1.55;white-space:pre-wrap;word-break:break-word;margin:0}
.msg .m{font-family:var(--mono);font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--ink-soft);margin-top:10px;display:flex;flex-wrap:wrap;gap:11px;align-items:center}
.msg .m > span{min-width:0}
.tag{border:1px solid currentColor;padding:2px 7px;font-size:9.5px;letter-spacing:.13em}
.bad{color:var(--red)} .good{color:var(--stamp)} .soft{color:var(--ink-soft)}

/* Tool ledger — the underline IS the bar. Recency drives whether a row reads as alive. */
/* Tracks are in px, not em: .head sets its own font-size, and em tracks would make the header
   columns narrower than the data columns — the two rows would not line up. */
.tool{position:relative;display:grid;
  grid-template-columns:minmax(0,1fr) 62px 68px 116px;gap:12px;align-items:baseline;
  padding:13px 0;border-bottom:1px solid var(--rule);font-family:var(--mono);font-size:12.5px}
.tool::after{content:'';position:absolute;left:0;bottom:-1px;height:2px;
  width:var(--w);background:var(--ink)}
/* Fixed em tracks plus unbreakable words (PENGGUNA, long tool keys) would otherwise overflow
   the track and give the whole page a horizontal scrollbar. */
.tool > *{min-width:0;overflow-wrap:anywhere}
.tool.cold{color:var(--ink-soft)}
.tool.cold::after{opacity:.28}
.tool .name{word-break:break-all}
.tool .n{text-align:right;font-variant-numeric:tabular-nums}
.tool .last{text-align:right;color:var(--ink-soft);font-size:11px}
.head{font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft);
  border-bottom:1px solid var(--rule);padding-bottom:8px}
.head::after{display:none}

table{width:100%;border-collapse:collapse;font-family:var(--mono);font-size:12.5px}
th{font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-soft);
  font-weight:400;text-align:left;padding:12px 12px 8px 0;border-bottom:1px solid var(--rule)}
td{padding:12px 12px 12px 0;border-bottom:1px solid var(--rule);vertical-align:top}
td.soft{color:var(--ink-soft)}
.scroll{overflow-x:auto}

.empty{font-family:var(--serif);font-size:16px;color:var(--ink-soft);padding:24px 0 4px;margin:0}
.empty + .hint{font-size:12.5px;color:var(--ink-soft);padding-bottom:22px;margin:6px 0 0;
  border-bottom:1px solid var(--rule)}

/* Footer — the readings that matter least, sized accordingly. */
.foot{margin-top:44px;padding-top:14px;border-top:2px solid var(--ink);
  font-family:var(--mono);font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;
  color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:8px 20px}
.foot b{color:var(--ink);font-weight:600}

/* The rail becomes a scrolling tab strip rather than a hamburger — no JS on this page. */
@media (max-width:720px){
  .shell{grid-template-columns:minmax(0,1fr);gap:0;margin-top:10px}
  .nav{position:static;flex-direction:row;overflow-x:auto;border-bottom:1px solid var(--rule)}
  .nav a{border-left:0;border-bottom:2px solid transparent;white-space:nowrap;
    padding:13px 16px 11px 0;gap:7px}
  .nav a.on{border-left:0;border-bottom-color:var(--ink);background:transparent}
}
@media (max-width:560px){
  body{padding:22px 16px 72px}
  .tool{grid-template-columns:minmax(0,1fr) 58px 62px;gap:8px;row-gap:4px}
  .tool .last{grid-column:1/-1;text-align:left}
  .head .last{display:none}
}
`;

const reading = (key: string, label: string, n: unknown) =>
  `<div class="reading" data-stat="${key}"><div class="n">${esc(num(n))}</div>` +
  `<div class="k">${esc(label)}</div></div>`;

const tag = (kind: string) =>
  `<span class="tag ${KIND_TONE[kind] ?? 'soft'}">${esc(KIND_LABEL[kind] ?? kind)}</span>`;


/** Prev/next with a position readout. Renders nothing when everything fits on one page. */
function pager(view: View, page: number, total: number): string {
  if (total <= PAGE_SIZE) return '';
  const last = Math.ceil(total / PAGE_SIZE);
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  // `view` is whitelisted and the page numbers are integers, so the href needs no escaping —
  // but nothing here comes from the request unvalidated in the first place.
  const step = (p: number, label: string) => (p >= 1 && p <= last
    ? `<a href="/admin?view=${view}&amp;page=${p}">${label}</a>`
    : `<span class="off">${label}</span>`);
  return `<div class="pager">
    <span>${from}&ndash;${to} daripada ${total}</span>
    <span>${step(page - 1, 'Sebelum')}<b>${page}/${last}</b>${step(page + 1, 'Seterusnya')}</span>
  </div>`;
}

function shell(view: View, counts: Record<string, number>, staleBackup: boolean, main: string) {
  const item = (v: View) => {
    const badge = v === 'ringkasan'
      ? (staleBackup ? '<span class="dot" title="Salinan sudah lama"></span>' : '')
      : `<span class="c">${esc(num(counts[v]))}</span>`;
    return `<a href="/admin?view=${v}" class="${v === view ? 'on' : ''}"
      ${v === view ? 'aria-current="page"' : ''}>${esc(VIEW_LABEL[v])}${badge}</a>`;
  };
  return `<!doctype html>
<html lang="ms"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>SenangKit &mdash; ${esc(VIEW_LABEL[view])}</title><style>${CSS}</style>
</head><body><div class="wrap">

<div class="mast">
  <strong>SenangKit &middot; Panel</strong>
  <span>${esc(new Date().toLocaleDateString('ms-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  }))} &middot; ${esc(new Date().toLocaleTimeString('ms-MY', {
    hour: '2-digit', minute: '2-digit',
  }))}</span>
</div>

<div class="shell">
  <nav class="nav">${VIEWS.map(item).join('')}</nav>
  <main>${main}</main>
</div>

</div></body></html>`;
}

admin.get('/', async (c) => {
  const view = viewOf(c.req.query('view'));

  // Counts for the menu badges. One round trip, needed on every view.
  const { rows: [counts] } = await q(
    `select (select count(*)::int from feedback)                as mesej,
            (select count(distinct tool)::int from tool_revisions) as alat,
            (select count(*)::int from users)                   as akaun`);
  const { rows: [lastBackup] } = await q(
    'select created_at, rows_total, bytes from admin_backups order by created_at desc limit 1');
  const stale = daysSince(lastBackup?.created_at) > STALE_DAYS;

  let main = '';

  if (view === 'ringkasan') {
    const [users, latestRow, devices, migrations, dbSize] = await Promise.all([
      q(`select count(*)::int                                                          as total,
                count(*) filter (where created_at   > now() - interval '7 days')::int  as new7,
                count(*) filter (where last_seen_at > now() - interval '7 days')::int  as active7
         from users`),
      q(`select f.kind, f.target, f.message, f.created_at, u.email
         from feedback f left join users u on u.id = f.user_id
         order by f.created_at desc limit 1`),
      // Approximate by design — no UA-parsing dependency for a rough device mix.
      q(`select case
                  when user_agent is null            then 'Tidak diketahui'
                  when user_agent ilike '%android%'  then 'Android'
                  when user_agent ilike '%iphone%'   then 'iPhone'
                  when user_agent ilike '%ipad%'     then 'iPad'
                  when user_agent ilike '%windows%'  then 'Windows'
                  when user_agent ilike '%macintosh%' or user_agent ilike '%mac os%' then 'Mac'
                  else 'Lain-lain'
                end as device, count(*)::int as n
         from sessions where expires_at > now()
         group by device order by n desc`),
      q('select count(*)::int as n, max(name) as latest from _migrations'),
      q('select pg_database_size(current_database()) as bytes'),
    ]);

    const u = users.rows[0];
    const mig = migrations.rows[0];
    const latest = latestRow.rows[0];
    const sessions = devices.rows.reduce((sum, r) => sum + r.n, 0);
    const recent = await q(
      `select count(*)::int as n from feedback where created_at > now() - interval '7 days'`);

    // Truncate the raw string, then escape. Escaping first and slicing after could cut an
    // entity in half and put a live `<` back into the document.
    const full = latest ? String(latest.message) : '';
    const heroText = full.length > HERO_CHARS ? `${full.slice(0, HERO_CHARS).trimEnd()}…` : full;

    main = `
<div class="hero">
  <p class="eyebrow">Mesej terkini</p>
  ${latest
    ? `<p class="quote">&ldquo;${esc(heroText)}&rdquo;</p>
       <div class="hero-meta">${tag(latest.kind)}
         <span>${esc(latest.target)}</span>
         <span>${esc(rel(latest.created_at))}</span>
         <span class="who">${esc(latest.email ?? 'akaun dipadam')}</span>
         <a href="/admin?view=mesej" class="who">Baca semua &rarr;</a>
       </div>`
    : `<p class="quote none">Belum ada sesiapa menulis apa-apa.</p>
       <div class="hero-meta"><span>Mesej dari borang maklum balas akan muncul di sini</span></div>`}
</div>

<div class="readings">
  ${reading('akaun', 'Akaun', u.total)}
  ${reading('baru', 'Baru 7 hari', u.new7)}
  ${reading('aktif', 'Aktif 7 hari', u.active7)}
  ${reading('mesej', 'Mesej 7 hari', recent.rows[0].n)}
  ${reading('sesi', 'Sesi', sessions)}
</div>

<h2>Salinan data</h2>
<div class="backup${stale ? ' stale' : ''}">
  <div>
    <div class="when">${esc(lastBackup
      ? `Salinan terakhir ${rel(lastBackup.created_at)}`
      : 'Belum ada salinan')}</div>
    <p class="note">${lastBackup
      ? `${esc(num(lastBackup.rows_total))} baris &middot; ${esc(size(Number(lastBackup.bytes)))}. `
      : ''}Pangkalan data sekarang ${esc(size(Number(dbSize.rows[0].bytes)))}.
      Railway simpan salinan automatik; ini salinan yang awak pegang sendiri.</p>
  </div>
  <a class="btn" href="/admin/backup">Muat turun salinan</a>
</div>

<div class="foot">
  ${devices.rows.map((r) => `<span><b>${esc(num(r.n))}</b> ${esc(r.device)}</span>`).join('')
    || '<span>Tiada sesi</span>'}
  <span><b>${esc(num(mig.n))}</b> migrasi &middot; ${esc(mig.latest ?? 'tiada')}</span>
  <span>Google sign-in <b>${GOOGLE_CLIENT_ID ? 'ok' : 'mati'}</b></span>
</div>
<p class="foot" style="border:0;margin-top:10px;text-transform:none;letter-spacing:0">
  Peranti dikira dari sesi yang belum luput, bukan sesi langsung — satu sesi bertahan setahun.
  Teka dari user-agent, jadi anggap ia anggaran.
</p>`;
  }

  if (view === 'mesej') {
    const total = counts.mesej;
    const page = pageOf(c.req.query('page'), total);
    const { rows } = await q(
      `select f.kind, f.target, f.message, f.created_at, u.email
       from feedback f left join users u on u.id = f.user_id
       order by f.created_at desc limit $1 offset $2`,
      [PAGE_SIZE, (page - 1) * PAGE_SIZE]);

    main = `<h2>Mesej <em>${esc(num(total))} semua</em></h2>
${rows.length === 0
  ? `<p class="empty">Tiada mesej lagi.</p>
     <p class="hint">Mesej masuk melalui borang maklum balas dalam app.</p>`
  : rows.map((r) => `<div class="msg">
      <p class="t">${esc(r.message)}</p>
      <div class="m">${tag(r.kind)}
        <span>${esc(r.target)}</span>
        <span>${esc(rel(r.created_at))}</span>
        <span class="who">${esc(r.email ?? 'akaun dipadam')}</span>
      </div>
    </div>`).join('')}
${pager('mesej', page, total)}`;
  }

  if (view === 'alat') {
    const { rows } = await q(
      `select tool,
              count(distinct user_id)::int as users,
              sum(rev)                     as writes,
              max(updated_at)              as last_write
       from tool_revisions group by tool order by users desc, writes desc`);
    const peak = Math.max(...rows.map((r) => r.users), 1);

    main = `<h2>Penggunaan alat <em>${esc(num(rows.length))} alat</em></h2>
${rows.length === 0
  ? `<p class="empty">Belum ada data disegerak.</p>
     <p class="hint">Alat muncul di sini selepas seseorang yang log masuk menyimpan rekod.</p>`
  : `<div class="tool head"><span class="name">Alat</span><span class="n">Pengguna</span>
       <span class="n">Tulisan</span><span class="last">Tulisan akhir</span></div>
     ${rows.map((r) => {
       const cold = daysSince(r.last_write) > COLD_DAYS;
       const width = ((r.users / peak) * 100).toFixed(1); // numeric, never user input
       return `<div class="tool${cold ? ' cold' : ''}" style="--w:${width}%">
         <span class="name">${esc(r.tool)}</span>
         <span class="n">${esc(num(r.users))}</span>
         <span class="n">${esc(num(r.writes))}</span>
         <span class="last">${esc(rel(r.last_write))}</span>
       </div>`;
     }).join('')}`}`;
  }

  if (view === 'akaun') {
    const total = counts.akaun;
    const page = pageOf(c.req.query('page'), total);
    const { rows } = await q(
      `select email, name, created_at, last_seen_at
       from users order by created_at desc limit $1 offset $2`,
      [PAGE_SIZE, (page - 1) * PAGE_SIZE]);

    main = `<h2>Akaun <em>${esc(num(total))} semua</em></h2>
<div class="scroll">${rows.length === 0
  ? '<p class="empty">Belum ada akaun.</p>'
  : `<table>
      <tr><th>E-mel</th><th>Nama</th><th>Daftar</th><th>Dilihat</th></tr>
      ${rows.map((r) => `<tr>
        <td>${esc(r.email)}</td>
        <td class="soft">${esc(r.name)}</td>
        <td class="soft">${esc(rel(r.created_at))}</td>
        <td class="soft">${esc(rel(r.last_seen_at))}</td>
      </tr>`).join('')}
    </table>`}</div>
${pager('akaun', page, total)}`;
  }

  c.header('Cache-Control', 'no-store');
  return c.html(shell(view, counts, stale, main));
});

/**
 * Full database dump as one JSON file. Everything every user owns is in this response — it is
 * the most sensitive route in the app, hence admin-only and no-store.
 *
 * No pg_dump: the deployed Node image ships no Postgres client binaries, and `pg` is the only
 * database dependency. Reading through the pool is what's actually available.
 */
admin.get('/backup', async (c) => {
  // The table list comes from the database itself, so a new tool's table is included without
  // anyone remembering to edit a list here. A stale hardcoded list is the kind of thing you
  // only find out about during a restore.
  const { rows: tables } = await q(
    `select tablename from pg_tables where schemaname = 'public' order by tablename`);

  // ponytail: whole database buffered in memory as one JSON response. Fine at personal-app
  // scale; switch to a streamed NDJSON body if this ever gets slow or memory-hungry.
  const data: Record<string, unknown[]> = {};
  let rowsTotal = 0;
  for (const { tablename } of tables) {
    // Identifiers come from pg_tables, never from the request. Quoted regardless.
    const { rows } = await q(`select * from "${tablename}"`);
    data[tablename] = rows;
    rowsTotal += rows.length;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify({ takenAt: new Date().toISOString(), rowsTotal, data });
  const bytes = Buffer.byteLength(body);

  await q('insert into admin_backups (rows_total, bytes) values ($1, $2)', [rowsTotal, bytes]);

  c.header('Content-Type', 'application/json; charset=utf-8');
  c.header('Content-Disposition', `attachment; filename="senangkit-${stamp}.json"`);
  c.header('Cache-Control', 'no-store');
  return c.body(body);
});
