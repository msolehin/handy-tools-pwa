// The app's storage boundary. Pages call this instead of localStorage directly.
//
// Three tiers, decided per key:
//   pref/stateless keys  -> real localStorage, never synced, identical to before
//   synced key, guest    -> memory only (gone on refresh), falling back to any pre-existing
//                           localStorage value READ-ONLY so existing installs still show data
//   synced key, signed in-> in-memory cache + an `acct:` localStorage mirror + a debounced push
//
// A record only counts as saved once it has reached the account, so a synced key is persisted
// ONLY while signed in AND online. Offline edits are refused out loud rather than queued: the
// user asked to be told "no internet, not saved" instead of being left to assume it worked.

// Explicit .ts extension so `node --test` can resolve this too (Vite handles it either way).
import { getUser, setUser, subscribe as subscribeToAuth, type User } from './auth.ts';
import { t } from './lang.ts';

/**
 * Every outcome the user is told about, from one place. Pages don't announce their own saves:
 * 20 tools would each have to get it right, and they'd each be wrong about whether the push
 * actually reached the account.
 */
export type SyncStatus = {
  // 'saving' is the only one that describes work still in flight. Every other kind is an
  // outcome, and replaces it.
  kind: 'loaded' | 'saving' | 'saved' | 'offline' | 'error' | 'guest';
  message: string;
  /**
   * How long the caller knows it is about to wait, for the one stretch whose length is not a
   * guess: the debounce before the push leaves. Carried rather than hardcoded in the toast, or
   * the bar and DEBOUNCE_MS drift apart the first time either is tuned.
   *
   * Deliberately absent once the request is actually in flight — the network owes no promise
   * about how long it will take, and a bar that invents one is a lie the user can feel.
   */
  waitMs?: number;
};

function announce(kind: SyncStatus['kind'], message: string, waitMs?: number) {
  window.dispatchEvent(new CustomEvent('store:status', { detail: { kind, message, waitMs } }));
}

/**
 * Tool keys that belong to an account. Grows one phase at a time.
 *
 * `garage_fleet` is listed before `garage_records` and `garage_logs` on purpose: both
 * `runImport` and the flush loop below iterate this Set in insertion order, and the two other
 * Garaj keys carry rows with a foreign key onto `garage_vehicles`, which only `garage_fleet`
 * populates. Pushing (or importing) a vehicle's logs before its fleet row exists is a 500 from
 * the FK constraint, so fleet goes first to make that the common case rather than a coin flip.
 */
export const SYNCED_KEYS = new Set<string>([
  'tenancy_data',
  'de_documents',
  'cd_events',
  'debt_tracker_ious',
  'habit_tracker_data',
  'important_numbers_data',
  'expense_manager_data',
  'duit_raya_manager_data',
  'travel_history_data',
  'water_tracker_data',
  'garage_fleet',
  'garage_records',
  'garage_logs',
  'home_services_data',
  'home_custom_titles',
  'asset_warranty_tracker_data',
  'asset_warranty_custom_categories',
  'book_tracker_data',
  'book_tracker_custom_categories',
]);

/**
 * Routes whose tool keeps records in an account. Used to warn guests that what they type
 * here won't survive the tab. Kept next to SYNCED_KEYS so the two can't drift — there is a
 * test asserting every route maps to a real synced key and every record tool has a route.
 */
export const SYNCED_ROUTES: Record<string, string> = {
  '/tenancy': 'tenancy_data',
  '/document-expiry': 'de_documents',
  '/countdown': 'cd_events',
  '/debt-tracker': 'debt_tracker_ious',
  '/habit-tracker': 'habit_tracker_data',
  '/important-numbers': 'important_numbers_data',
  '/expense-manager': 'expense_manager_data',
  '/commitments': 'expense_manager_data',   // a second view over the same records
  '/duit-raya': 'duit_raya_manager_data',
  '/travel-history': 'travel_history_data',
  '/water-tracker': 'water_tracker_data',
  '/vehicle-services': 'garage_fleet',
  '/home-services': 'home_services_data',
  '/asset-warranty': 'asset_warranty_tracker_data',
  '/book-tracker': 'book_tracker_data',
};

const P = 'acct:';
const UID_KEY = `${P}__uid`;
// The profile itself, so a refresh can show you as signed in before the network answers.
// Without it the app knows it has your data but not your name, and paints the guest UI.
const USER_KEY = `${P}__user`;
const DIRTY_KEY = `${P}__dirty`;
const REV_KEY = `${P}__revs`;
const IMPORTED_KEY = `${P}__imported`;
const DEBOUNCE_MS = 800;
// A ceiling on that debounce. Ticking a week of habit boxes re-arms the trailing timer on
// every tap, so without this nothing reaches the account until the user stops for a full
// 800ms — a fast burst could go a minute with everything still only in memory.
const MAX_WAIT_MS = 2500;

const cache = new Map<string, string>();
const dirty = new Set<string>();
const revs = new Map<string, number>();

let signedIn = false;
// Nothing is pushed until a pull has succeeded this session. Four tools write their whole
// state on mount with no guard (Countdown, DocumentExpiry, AssetWarranty, BookTracker), so a
// failed pull followed by a page mount would otherwise push [] straight over the account.
let pulled = false;
let flushTimer: ReturnType<typeof setTimeout> | undefined;
let maxWaitTimer: ReturnType<typeof setTimeout> | undefined;
// The push currently in flight, so concurrent callers join it instead of starting a second one.
let flushing: Promise<void> | null = null;
let backoff = 1000;
let lateHydrate: (() => void) | null = null;

const readJson = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

// ---------------------------------------------------------------- the page-facing API

export const store = {
  getItem(key: string): string | null {
    if (!SYNCED_KEYS.has(key)) return localStorage.getItem(key);
    if (cache.has(key)) return cache.get(key)!;

    const value = signedIn
      ? localStorage.getItem(P + key)
      // Guest: this tab's edits live in `cache` above and nowhere else. This is only the
      // pre-account on-device value — read-only, or every existing user opens to an empty app.
      : localStorage.getItem(key);

    if (value !== null) cache.set(key, value);
    return value;
  },

  setItem(key: string, value: string): void {
    if (!SYNCED_KEYS.has(key)) { localStorage.setItem(key, value); return; }

    // Several tools re-write their whole state from a mount effect. Without this, merely
    // opening a tool pushes an identical blob to the server and flashes a "Saved" the user
    // never asked for — and re-uploads every photo in it.
    if (cache.get(key) === value) return;

    // Signed in but offline: refuse, and don't cache it either. Caching would make the identical
    // write that arrives once we're back online look like a no-op above, and the edit would be
    // swallowed for good. The store holds only what genuinely reached the account.
    if (signedIn && !navigator.onLine) {
      announce('offline', t('Tiada internet. Tiada apa disimpan — sambung semula dan cuba lagi.', 'No internet detected. Nothing was saved — reconnect and try again.'));
      return;
    }

    cache.set(key, value);
    if (signedIn) {
      try {
        localStorage.setItem(P + key, value);
      } catch {
        // Quota. The in-memory copy still holds and the push still carries it to the server.
      }
      markDirty(key);
    }
    window.dispatchEvent(new Event('store:changed'));
  },

  removeItem(key: string): void {
    if (!SYNCED_KEYS.has(key)) { localStorage.removeItem(key); return; }

    if (signedIn && !navigator.onLine) {
      announce('offline', t('Tiada internet. Tiada apa dipadam — sambung semula dan cuba lagi.', 'No internet detected. Nothing was deleted — reconnect and try again.'));
      return;
    }

    cache.delete(key);
    if (signedIn) { localStorage.removeItem(P + key); markDirty(key); }
    window.dispatchEvent(new Event('store:changed'));
  },
};

// ---------------------------------------------------------------- push

function markDirty(key: string) {
  dirty.add(key);
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));

  // Say so now. The outcome is still a debounce plus a round trip away, and a user who clicks
  // Save and gets nothing back for over a second reasonably concludes the click missed — and
  // clicks again. `pulled` because a push that cannot run yet must not claim to be running.
  //
  // DEBOUNCE_MS is how long the bar has to fill before the request leaves. Every write re-arms
  // that timer, so during a burst the bar restarts too — which is exactly the truth: nothing
  // goes anywhere until you stop, or until MAX_WAIT_MS overrules you.
  if (pulled) announce('saving', t('Menyimpan…', 'Saving…'), DEBOUNCE_MS);

  clearTimeout(flushTimer);
  flushTimer = setTimeout(() => { void flush(); }, DEBOUNCE_MS);
  if (maxWaitTimer === undefined) {
    maxWaitTimer = setTimeout(() => { maxWaitTimer = undefined; void flush(); }, MAX_WAIT_MS);
  }
}

function persistRevs() {
  localStorage.setItem(REV_KEY, JSON.stringify(Object.fromEntries(revs)));
}

export const pendingCount = () => dirty.size;

/** Push every dirty key. Safe to call any time; a no-op when offline or signed out. */
export function flush(): Promise<void> {
  // The debounce timer, `visibilitychange` and the `online` listener can all arrive while a PUT
  // is still in flight. Two runs read the same revs.get(key) and send it; the loser comes back
  // 409, and the user is told their record "changed on another device" in the middle of an
  // ordinary save on their only device. Concurrent callers join the run already going.
  //
  // A key dirtied mid-run is not carried by that run — markDirty has already re-armed the
  // timer, so the next one takes it.
  return flushing ??= runFlush().finally(() => { flushing = null; });
}

async function runFlush(): Promise<void> {
  if (!signedIn || !pulled || !dirty.size || !navigator.onLine) return;
  let pushed = 0;
  // A key the server itself rejects (a still-missing foreign key, a bad payload) must not
  // block every key behind it: `dirty` is a Set restored from localStorage in insertion order,
  // so a poisoned key would otherwise sit at the same position on every retry and wedge sync
  // for every tool, forever — see the FK-ordering comment on SYNCED_KEYS for the concrete case.
  // It is left dirty and reported once, below, rather than retried inline here.
  let anyRejected = false;

  for (const key of [...dirty]) {
    const raw = cache.get(key) ?? null;
    let res: Response;
    try {
      res = await fetch(`/api/sync/${encodeURIComponent(key)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rev: revs.get(key), data: raw === null ? null : JSON.parse(raw) }),
      });
    } catch {
      // The request never got a response at all — offline, DNS, a timeout. Every other key
      // would fail the exact same way right now, so there is no point burning through the rest
      // of the dirty set; stop and let the backoff below try the whole run again later.
      backoff = Math.min(backoff * 2, 60_000);
      clearTimeout(maxWaitTimer);
      maxWaitTimer = undefined;   // the backoff owns the retry from here, or the two race
      flushTimer = setTimeout(() => { void flush(); }, backoff);
      localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
      announce('error', t('Gagal simpan ke akaun anda. Cuba semula…', "Couldn't save to your account. Retrying…"));
      return; // leave this key and the rest dirty; try again later
    }

    if (res.status === 401) {
      signedIn = false;
      localStorage.removeItem(UID_KEY);
      localStorage.removeItem(USER_KEY);
      setUser(null);
      announce('error', t('Sesi anda telah tamat. Log masuk semula untuk terus menyimpan.', 'Your session expired. Sign in again to keep saving.'));
      return;
    }

    if (res.status === 409) {
      // Another device moved first. Keep ours dirty (never discard a local edit) and let
      // the UI ask which copy wins.
      const conflict = await res.json();
      window.dispatchEvent(new CustomEvent('store:conflict', {
        detail: { key, rev: conflict.rev, data: conflict.data },
      }));
      announce('error', t('Ini telah diubah pada peranti lain. Belum disimpan.', 'This was changed on another device. Not saved yet.'));
      continue;
    }

    if (!res.ok) {
      // A real answer, just not a good one. Unlike the network case above, the other keys in
      // this run have no reason to fail the same way — a bad foreign key on `garage_logs` says
      // nothing about whether `tenancy_data` will PUT cleanly — so this one stays dirty and the
      // loop moves on rather than stalling every tool behind it.
      anyRejected = true;
      continue;
    }

    revs.set(key, (await res.json()).rev);
    persistRevs();
    dirty.delete(key);
    pushed++;
  }

  backoff = 1000;
  clearTimeout(maxWaitTimer);
  maxWaitTimer = undefined;
  localStorage.setItem(DIRTY_KEY, JSON.stringify([...dirty]));
  if (pushed) announce('saved', t('Disimpan ke akaun anda.', 'Saved to your account.'));
  // Reported after 'saved' so it is the one left on screen — a mix of pushed and rejected keys
  // is still an outcome the user needs to notice, not one the save toast should paper over.
  if (anyRejected) {
    announce('error', t('Sebahagian tidak dapat disimpan. Cuba lagi kemudian.', "Some changes couldn't be saved. Will retry later."));
  }
}

/**
 * Resolve a 409. 'mine' re-pushes the local copy at the server's revision; 'theirs' adopts the
 * server copy and drops the local edit.
 */
export function resolveConflict(key: string, keep: 'mine' | 'theirs', rev: number, data: unknown) {
  revs.set(key, rev);
  persistRevs();
  if (keep === 'theirs') {
    const raw = JSON.stringify(data);
    cache.set(key, raw);
    localStorage.setItem(P + key, raw);
    dirty.delete(key);
    lateHydrate?.();
  } else {
    markDirty(key);
  }
}

// ---------------------------------------------------------------- boot

function applyPulled(tool: string, data: unknown): boolean {
  const raw = JSON.stringify(data);
  if (cache.get(tool) === raw) return false;
  cache.set(tool, raw);
  try { localStorage.setItem(P + tool, raw); } catch { /* quota — memory copy still wins */ }
  return true;
}

function wipeAccountMirror() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(P)) localStorage.removeItem(key);
  }
  cache.clear();
  dirty.clear();
  revs.clear();
}

let pullTimer: ReturnType<typeof setTimeout> | undefined;
let pullBackoff = 2000;

/**
 * A pull that never lands is how "I signed in and my data is gone" happens: the store stays in
 * guest mode while the account panel shows a signed-in user, so nothing loads, nothing is
 * pushed, and nothing ever asks again — the auth subscriber only fires when the user CHANGES.
 * Keep asking as long as auth believes we have a session.
 */
function schedulePull() {
  // `signedIn` as well as getUser(): on a refresh the pull is the only thing that would have
  // told auth who we are, so on a cold boot getUser() is still null and gating on it alone
  // meant the one case that most needs a retry never got one.
  if (pullTimer || !(getUser() || signedIn)) return;
  pullTimer = setTimeout(() => {
    pullTimer = undefined;
    void bootstrap();
  }, pullBackoff);
  pullBackoff = Math.min(pullBackoff * 2, 30_000);
}

/**
 * Called by main.tsx. Everything before the first `await` is synchronous, so the on-device
 * mirror is in the cache before main.tsx paints; the network pull then runs in the background
 * and remounts through `lateHydrate` when it lands. It must never hold the first paint — that
 * is what forced the old 1.5s abort, which a cold server loses more often than it wins.
 */
export async function bootstrap(): Promise<void> {
  const knownUid = localStorage.getItem(UID_KEY);
  // A genuine guest -> account transition, which is the only thing worth remounting the app
  // for. `signedIn` alone is module state and is false on every cold boot, so reading it by
  // itself made EVERY page load look like a fresh sign-in: the whole tree was thrown away a
  // second after paint, and the user was told their data loaded when they had just opened the
  // app and changed nothing.
  const wasGuest = !signedIn && !knownUid;
  signedIn = Boolean(knownUid);

  if (signedIn) {
    for (const key of SYNCED_KEYS) {
      const raw = localStorage.getItem(P + key);
      if (raw !== null) cache.set(key, raw);
    }
    // Before the first paint, and before any network. A valid session that simply hasn't been
    // confirmed yet must not render as "Guest mode" with a "not saved" warning over the user's
    // own data — that is a refresh telling them they're logged out when they aren't. Only an
    // explicit 401 below signs anyone out; this mirrors auth.refresh(), which already refuses
    // to let a network failure clear the user.
    const cached = readJson<User | null>(localStorage.getItem(USER_KEY), null);
    if (cached && !getUser()) setUser(cached);
    for (const key of readJson<string[]>(localStorage.getItem(DIRTY_KEY), [])) dirty.add(key);
    for (const [k, v] of Object.entries(readJson<Record<string, number>>(
      localStorage.getItem(REV_KEY), {}))) revs.set(k, v);
  }

  if (!navigator.onLine) return;

  let payload: { user: User & { id?: string } | null; revisions: Record<string, number>; data: Record<string, unknown> };
  try {
    // Generous, because this no longer blocks the paint. /api/bootstrap makes ~36 sequential
    // queries, which on a remote database is comfortably over a second before the server is
    // even slow.
    const res = await fetch('/api/bootstrap', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      // Only a 401 is an answer — it really means "not signed in". Anything else is the server
      // having a bad moment, and must not be mistaken for an empty account.
      if (res.status === 401) {
        // A real answer: the session is gone. Drop the cached profile too, or the next refresh
        // would restore it above and show a signed-out user as signed in for ever.
        if (signedIn) { signedIn = false; localStorage.removeItem(UID_KEY); }
        localStorage.removeItem(USER_KEY);
        setUser(null);
        return;
      }
      throw new Error(String(res.status));
    }
    payload = await res.json();
  } catch {
    // Offline, slow, or the API is down. The mirror already rendered; keep trying so a signed-in
    // user is never silently left in guest mode.
    schedulePull();
    return;
  }

  if (!payload.user) { setUser(null); return; }

  // Shared device, different Google account: never let user B see user A's cached blobs.
  const identity = payload.user.email;
  if (knownUid && knownUid !== identity) wipeAccountMirror();
  localStorage.setItem(UID_KEY, identity);
  try { localStorage.setItem(USER_KEY, JSON.stringify(payload.user)); } catch { /* quota */ }
  signedIn = true;
  // We now hold the server's state, so pushing over it is a real decision rather than a
  // guess — and every push is revision-checked anyway.
  pulled = true;
  setUser(payload.user);

  // Unsent offline edits go up BEFORE the pull is applied, or an older server copy silently
  // overwrites them.
  //
  // `payload` was read off the server BEFORE that push, so for anything we are about to send it
  // holds the older copy — and the flush empties `dirty`, so the guard below stops covering the
  // very keys it was written for. Remember what was ours first. Without this, saving a record
  // while a retry pull was in flight reverted it to the previous version on screen and remounted
  // the whole app: the user watches their new entry vanish and the page reset itself.
  const wasDirty = new Set(dirty);
  if (dirty.size) await flush();

  let changed = false;
  for (const [tool, rev] of Object.entries(payload.revisions)) revs.set(tool, rev);
  for (const [tool, data] of Object.entries(payload.data)) {
    if (dirty.has(tool) || wasDirty.has(tool)) continue; // ours is newer, or just went up
    if (applyPulled(tool, data)) changed = true;
  }
  persistRevs();

  // Tools the server has never seen but this device has. Collected, not uploaded — the user
  // is asked once. Nothing is deleted either way, so declining loses nothing.
  if (!localStorage.getItem(IMPORTED_KEY)) {
    for (const key of SYNCED_KEYS) {
      if (revs.has(key)) continue;
      // This tab's guest edits (cache) beat the pre-account on-device value.
      const local = cache.get(key) ?? localStorage.getItem(key);
      if (local && local !== '[]' && local !== '{}') importCandidates.set(key, local);
    }
  }

  // Only on a guest -> account transition. Mounted pages read their state from the guest tier;
  // once signedIn flips, getItem answers from the account mirror instead, and stale component
  // state would disagree with the store — so that one is worth the cost.
  //
  // `changed` alone is not. A remount destroys the entire tree: open modals, half-typed forms,
  // scroll position. A background pull firing that mid-edit is indistinguishable from the app
  // refreshing itself, and schedulePull() can land at any moment.
  // ponytail: a tool page already open when another device edits it keeps showing the old copy
  // until you navigate away and back — the store itself is current. Push a targeted per-key
  // subscription down to the pages if that ever actually bites someone.
  if (wasGuest) lateHydrate?.();

  pullBackoff = 2000;
  clearTimeout(pullTimer);
  pullTimer = undefined;

  // Only on a real sign-in, or when the pull actually brought something new. Announcing every
  // cold start would toast at someone who just opened the app and changed nothing.
  if (wasGuest || changed) {
    const tools = Object.keys(payload.data).length;
    announce('loaded', tools
      ? t(`Log masuk berjaya. Data anda dimuatkan (${tools} alat).`, `Signed in. Your data loaded successfully (${tools} tools).`)
      : t('Log masuk berjaya. Akaun ini belum ada data tersimpan.', 'Signed in. This account has no saved data yet.'));
  }
}

// Signing in happens long after main.tsx ran bootstrap() as a guest. Without this, the store
// stays in guest mode until a manual page refresh: no pull, no remount, no data.
subscribeToAuth((user) => {
  if (user && !signedIn) void bootstrap();
});

// ---------------------------------------------------------------- first-login import

const importCandidates = new Map<string, string>();

/** Tool labels for the import prompt. Keyed by storage key. */
export const TOOL_LABELS: Record<string, string> = {
  tenancy_data: 'Sewa & Kontrak',
  de_documents: 'Document Expiry',
  cd_events: 'Countdown Day',
  debt_tracker_ious: 'Catat Hutang',
  habit_tracker_data: 'Habit Tracker',
  important_numbers_data: 'Important Number / Date',
  expense_manager_data: 'Expense Manager',
  duit_raya_manager_data: 'Kira Duit Raya',
  travel_history_data: 'My Travel History',
  water_tracker_data: 'Minum',
  garage_fleet: 'Garaj (kenderaan)',
  garage_records: 'Garaj (servis & dokumen)',
  garage_logs: 'Garaj (minyak & peringatan)',
  home_services_data: 'Servis Rumah',
  home_custom_titles: 'Servis Rumah (titles)',
  asset_warranty_tracker_data: 'Asset & Warranty',
  asset_warranty_custom_categories: 'Asset & Warranty (categories)',
  book_tracker_data: 'My Books',
  book_tracker_custom_categories: 'My Books (categories)',
};

/** Tool names found on this device that the account has never seen. Empty once resolved. */
export const pendingImport = (): string[] => [...importCandidates.keys()];

/** Upload the found data, then adopt it locally. */
export async function runImport(): Promise<boolean> {
  if (!importCandidates.size) return true;
  const body: Record<string, unknown> = {};
  for (const [key, raw] of importCandidates) {
    try { body[key] = JSON.parse(raw); } catch { /* unparseable: skip rather than send junk */ }
  }
  try {
    const res = await fetch('/api/sync/import', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return false;
    for (const [key, raw] of importCandidates) {
      if (body[key] === undefined) continue;
      cache.set(key, raw);
      try { localStorage.setItem(P + key, raw); } catch { /* quota */ }
    }
  } catch {
    return false;
  }
  importCandidates.clear();
  localStorage.setItem(IMPORTED_KEY, '1');
  // Revisions are now stale; the next boot pulls them fresh.
  lateHydrate?.();
  return true;
}

/** Decline. The on-device data is left exactly where it is. */
export function skipImport() {
  importCandidates.clear();
  localStorage.setItem(IMPORTED_KEY, 'skipped');
}

/** main.tsx registers a remount here: 25 pages read storage once and never re-read. */
export function onLateHydrate(fn: () => void) { lateHydrate = fn; }

/** Sign-out: flush what we can, then drop every trace of the account from this device. */
export async function clearAccountData() {
  await flush().catch(() => {});
  wipeAccountMirror();
  signedIn = false;
  pulled = false;
  clearTimeout(pullTimer);
  pullTimer = undefined;
}

// Push on the transitions that actually fire reliably on mobile. `beforeunload` is not one
// of them in an installed PWA.
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flush();
});
// Back online: re-run bootstrap rather than flushing blind. If the boot pull never landed,
// this is the first chance to learn the server's state before pushing anything over it.
window.addEventListener('online', () => {
  backoff = 1000;
  pullBackoff = 2000;
  void (pulled ? flush() : bootstrap());
});
window.addEventListener('offline', () => {
  if (signedIn) announce('offline', t('Tiada internet. Perubahan tidak boleh disimpan sekarang.', 'No internet detected. Changes cannot be saved right now.'));
});
