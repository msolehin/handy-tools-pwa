// node --experimental-webstorage --localstorage-file=.tmp-store-test --test src/lib/store.test.ts
//
// Covers the paths where store.ts could destroy user data:
//   - a guest never writes to localStorage, but still SEES pre-existing localStorage data
//   - preference keys are untouched by any of this
//   - nothing is pushed before a pull has confirmed what the server holds
//   - a 409 keeps the local edit instead of dropping it
//   - a signed-in user is never silently left in guest mode by a pull that didn't land
//   - every save, failure and load is announced through `store:status`
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser surface. store.ts registers listeners at module scope, so these have to
// exist before the dynamic import below.
const listeners: Record<string, ((e?: any) => void)[]> = {};
// Everything the app was told through `store:status`, so the tests can assert the user was
// actually informed rather than only that the store did the right thing quietly.
let announced: { kind: string; message: string }[] = [];
(globalThis as any).window = {
  addEventListener: (name: string, fn: () => void) => { (listeners[name] ??= []).push(fn); },
  dispatchEvent: (e: any) => {
    if (e?.type === 'store:status') announced.push(e.detail);
    return true;
  },
};
(globalThis as any).document = { visibilityState: 'visible' };
// Plain classes, not parameter properties — Node's strip-only TS mode rejects those.
(globalThis as any).CustomEvent = class {
  type: string; detail: any;
  constructor(type: string, init?: { detail?: unknown }) { this.type = type; this.detail = init?.detail; }
};
(globalThis as any).Event = class { type: string; constructor(type: string) { this.type = type; } };

let online = true;
Object.defineProperty(globalThis, 'navigator', {
  value: { get onLine() { return online; } },
  configurable: true,
});

type Call = { url: string; method: string; body: any };
let calls: Call[] = [];
let handler: (url: string, init: RequestInit) => { status: number; body: unknown };

// A handler returning this as the body simulates a connection dropped mid-transfer: fetch()
// itself resolves fine (status/ok already known), but reading the body rejects — exactly what
// res.json() does on a truncated response.
const CORRUPT = Symbol('corrupt body');

(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const body = init.body ? JSON.parse(init.body as string) : undefined;
  calls.push({ url, method: init.method ?? 'GET', body });
  const { status, body: out } = handler(url, init);
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => { if (out === CORRUPT) throw new Error('truncated body'); return out; },
  };
};

// store.ts holds module-level state (cache, dirty set, the `pulled` gate). Each test gets a
// genuinely fresh instance — Node's ESM cache is keyed by URL, so the query param defeats it.
// Without this, one test's cache silently satisfies the next one's assertions.
let instance = 0;
type Store = typeof import('./store.ts');
const freshStore = (): Promise<Store> => import(`./store.ts?t=${instance++}`) as Promise<Store>;

const reset = () => {
  localStorage.clear();
  sessionStorage.clear();
  calls = [];
  announced = [];
  online = true;
  handler = () => ({ status: 401, body: { error: 'unauthorized' } });
};

const kinds = () => announced.map((a) => a.kind);

describe('client and server agree on the tool list', () => {
  test('every synced key has a server descriptor, and vice versa', async () => {
    const store = await freshStore();
    const { TOOLS } = await import('../../server/tools.ts');

    const client = [...store.SYNCED_KEYS].sort();
    const server = Object.keys(TOOLS).sort();

    // A key synced by the client with no descriptor would PUT to a 404 forever — the edit
    // stays dirty, retries on a backoff, and never reaches the account. Silent, and only
    // visible as "my data didn't save on the other phone".
    assert.deepEqual(client, server);
  });

  test('the landing page sorts every catalog tool into exactly one section', async () => {
    const store = await freshStore();
    const { DEFAULT_TOOLS } = await import('./tools.ts');

    const main = DEFAULT_TOOLS.filter((t) => Boolean(store.SYNCED_ROUTES[t.to]));
    const side = DEFAULT_TOOLS.filter((t) => !store.SYNCED_ROUTES[t.to]);

    assert.equal(main.length + side.length, DEFAULT_TOOLS.length,
      'a new tool must land in one section or the other, never neither');
    assert.ok(main.length, 'the landing page has record tools to promote');
    assert.ok(side.length, 'and side tools to offer as a quick try');

    // Every promoted tool must genuinely save, or the page is claiming something untrue.
    for (const tool of main) {
      assert.ok(store.SYNCED_KEYS.has(store.SYNCED_ROUTES[tool.to]),
        `${tool.to} is promoted as saving data but its key is not synced`);
    }
    // And nothing in the side strip may quietly be a record tool.
    for (const tool of side) {
      assert.equal(store.SYNCED_ROUTES[tool.to], undefined,
        `${tool.to} saves records but is listed as a throwaway side tool`);
    }
  });

  test('both landing languages describe every promoted tool', async () => {
    const store = await freshStore();
    const { DEFAULT_TOOLS } = await import('./tools.ts');
    const { COPY } = await import('../components/landing/copy.ts');

    const main = DEFAULT_TOOLS.filter((t) => Boolean(store.SYNCED_ROUTES[t.to]));

    // `reminds` is a Record<string, string>, so TypeScript can't check it for completeness —
    // a tool added later would silently fall back to its short catalog blurb, in one language
    // and not the other.
    for (const lang of ['ms', 'en'] as const) {
      for (const tool of main) {
        assert.ok(COPY[lang].reminds[tool.to],
          `${tool.to} has no ${lang} description on the landing page`);
      }
    }

    assert.equal(COPY.ms.hero.headline.length, COPY.en.hero.headline.length,
      'the headline is rendered line by line, so both languages need the same line count');
    assert.equal(COPY.ms.wall.records.length, COPY.en.wall.records.length,
      'the expiry wall pairs each record with a fixed day count by index');
    assert.equal(COPY.ms.scale.length, COPY.en.scale.length);
    assert.equal(COPY.ms.promises.length, COPY.en.promises.length);

    // The previews render real totals, so a language showing a different set of recipients
    // would quote a different amount given for the same screenshot.
    assert.equal(COPY.ms.previews.doc.items.length, COPY.en.previews.doc.items.length);
    assert.equal(COPY.ms.previews.service.events.length, COPY.en.previews.service.events.length);
    assert.equal(COPY.ms.previews.raya.budget, COPY.en.previews.raya.budget);
    assert.deepEqual(
      COPY.ms.previews.raya.recipients.map((r) => [r.amount, r.given]),
      COPY.en.previews.raya.recipients.map((r) => [r.amount, r.given]),
      'only the names should differ between languages, never the money',
    );
    assert.deepEqual(
      COPY.ms.previews.doc.items.map((d) => d.days),
      COPY.en.previews.doc.items.map((d) => d.days),
      'the same document should be the same number of days away in both languages',
    );
    assert.deepEqual(
      COPY.ms.previews.travel.trips.map((trip) => [trip.country, trip.budget]),
      COPY.en.previews.travel.trips.map((trip) => [trip.country, trip.budget]),
      'the same trip cost the same money, and lights the same country on the map',
    );
  });

  test('every record tool has a route that warns guests, and no route is stale', async () => {
    const store = await freshStore();

    for (const [route, key] of Object.entries(store.SYNCED_ROUTES)) {
      assert.ok(store.SYNCED_KEYS.has(key), `${route} points at unsynced key ${key}`);
    }

    // Side tables ride along with their parent tool and have no page of their own.
    const sideTables = new Set([
      'asset_warranty_custom_categories', 'book_tracker_custom_categories', 'home_custom_titles',
      // garage_records and garage_logs ride along with garage_fleet at '/vehicle-services' —
      // one route, three keys. (SYNCED_KEYS orders garage_fleet first for runImport's sake;
      // that ordering is unrelated to this route split.)
      'garage_records', 'garage_logs',
    ]);
    const routed = new Set(Object.values(store.SYNCED_ROUTES));
    for (const key of store.SYNCED_KEYS) {
      if (sideTables.has(key)) continue;
      assert.ok(routed.has(key),
        `${key} syncs but no route warns guests their entries won't be saved`);
    }
  });
});

describe('store: guest mode', () => {
  beforeEach(reset);

  test('a guest write is held in memory only, so a refresh loses it', async () => {
    const store = await freshStore();
    await store.bootstrap();
    store.store.setItem('tenancy_data', '{"items":[1]}');

    assert.equal(store.store.getItem('tenancy_data'), '{"items":[1]}',
      'readable in this tab — a guest can still try the tool');
    assert.equal(localStorage.getItem('tenancy_data'), null);
    assert.equal(sessionStorage.getItem('tenancy_data'), null,
      'sessionStorage survives F5, so it is not allowed to hold guest records either');

    // The refresh: a new module instance, with only real storage carried over.
    const reloaded = await freshStore();
    await reloaded.bootstrap();
    assert.equal(reloaded.store.getItem('tenancy_data'), null,
      'guest data must be gone once the page is refreshed');
  });

  test('a guest still sees data an existing install already had', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    await store.bootstrap();

    assert.equal(store.store.getItem('tenancy_data'), '{"items":["legacy"]}',
      'without this, every existing user opens to an empty app on deploy day');
  });

  test('this-tab edits win over the legacy value', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    await store.bootstrap();
    store.store.setItem('tenancy_data', '{"items":["fresh"]}');

    assert.equal(store.store.getItem('tenancy_data'), '{"items":["fresh"]}');
    assert.equal(localStorage.getItem('tenancy_data'), '{"items":["legacy"]}',
      'the legacy value is read-only and must survive untouched');
  });

  test('a guest is never told their data was saved', async () => {
    const store = await freshStore();
    await store.bootstrap();
    store.store.setItem('tenancy_data', '{"items":[1]}');
    await store.flush();

    assert.equal(kinds().includes('saved'), false,
      'nothing was saved anywhere, so claiming a save would be a lie');
  });

  test('preference keys bypass all of it', async () => {
    const store = await freshStore();
    await store.bootstrap();
    store.store.setItem('theme', 'light');
    store.store.setItem('pinnedTools', '["/parking"]');

    assert.equal(localStorage.getItem('theme'), 'light');
    assert.equal(sessionStorage.getItem('theme'), null);
    assert.equal(store.store.getItem('pinnedTools'), '["/parking"]');
  });

  test('a guest never calls the sync API', async () => {
    const store = await freshStore();
    await store.bootstrap();
    store.store.setItem('tenancy_data', '{"items":[1]}');
    await store.flush();

    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0);
  });
});

describe('store: signed in', () => {
  const signedInBootstrap = (data: Record<string, unknown> = {}, revisions: Record<string, number> = {}) => {
    handler = (url) => url.includes('/api/bootstrap')
      ? { status: 200, body: { user: { email: 'a@b.c', name: 'A', picture: '' }, revisions, data } }
      : { status: 200, body: { rev: 99 } };
  };

  beforeEach(reset);

  test('pulled data lands in the mirror and is readable', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['server'] } }, { tenancy_data: 4 });
    await store.bootstrap();

    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data')!), { items: ['server'] });
    assert.ok(localStorage.getItem('acct:tenancy_data'), 'mirrored for the next cold start');
  });

  test('a write pushes and clears the pending count', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    assert.equal(store.pendingCount(), 1);

    await store.flush();
    const put = calls.find((c) => c.url.includes('/api/sync/tenancy_data'));
    assert.ok(put, 'the edit was pushed');
    assert.deepEqual(put.body.data, { items: ['mine'] });
    assert.equal(store.pendingCount(), 0);
  });

  test('NOTHING is pushed until a pull has confirmed the server state', async () => {
    const store = await freshStore();
    // A previous session left a signed-in marker, then the boot pull fails (offline, slow,
    // API down). Four tool pages write their whole state on mount with no guard — if that
    // reached the server it would replace the account with an empty list.
    localStorage.setItem('acct:__uid', 'a@b.c');
    handler = () => { throw new Error('network down'); };
    await store.bootstrap();

    store.store.setItem('tenancy_data', '{"items":[]}');
    await store.flush();

    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0,
      'an unconfirmed session must never overwrite the account');
    assert.equal(store.pendingCount(), 1, 'but the edit is kept, pending');
  });

  test('an offline write is refused out loud, never persisted', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    online = false;
    announced = [];
    store.store.setItem('tenancy_data', '{"items":["offline edit"]}');
    await store.flush();

    assert.deepEqual(announced.map((a) => a.kind), ['offline'],
      'the user is told, rather than left assuming it saved');
    // Malay is the default language, so that is what the store announces here.
    assert.match(announced[0].message, /Tiada internet/);
    assert.equal(store.pendingCount(), 0, 'nothing is queued — a record only counts once it lands');
    assert.equal(localStorage.getItem('acct:tenancy_data'), '{"items":[]}',
      'the mirror still holds the last state that genuinely reached the account');

    // And the refusal must not poison the cache: the same write, once we are back online,
    // has to be recognised as a real change rather than swallowed as a no-op.
    online = true;
    store.store.setItem('tenancy_data', '{"items":["offline edit"]}');
    await store.flush();
    const put = calls.find((c) => c.url.includes('/api/sync/tenancy_data'));
    assert.deepEqual(put!.body.data, { items: ['offline edit'] }, 'it saves once reconnected');
  });

  test('a delete while offline is refused too', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['keep me'] } }, { tenancy_data: 1 });
    await store.bootstrap();

    online = false;
    announced = [];
    store.store.removeItem('tenancy_data');

    assert.deepEqual(announced.map((a) => a.kind), ['offline']);
    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data')!), { items: ['keep me'] },
      'and the record is still there, because the delete never happened');
  });

  test('a save is announced only once it has actually reached the account', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    announced = [];
    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    assert.deepEqual(kinds(), ['saving'],
      'the work is shown as started, but no save is claimed while the push is still in flight');

    await store.flush();
    assert.deepEqual(kinds(), ['saving', 'saved']);
  });

  test('a failed push says so instead of looking like a save', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    handler = (url) => url.includes('/api/sync')
      ? { status: 500, body: { error: 'boom' } }
      : { status: 200, body: {} };

    announced = [];
    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    await store.flush();

    assert.deepEqual(kinds(), ['saving', 'error'], 'the failure replaces the pending state');
    assert.equal(store.pendingCount(), 1, 'and it stays queued for the retry');

    // The rejected-key path armed a real setTimeout retry (backoff, in runFlush) that outlives
    // this test — left alone, it fires later against whatever `handler`/`calls` a DIFFERENT test
    // has since installed, and appends to those shared arrays. Draining the dirty set now makes
    // that stray timer's eventual flush() a same-tick no-op (`!dirty.size` returns before any
    // fetch), rather than cancelling a handle store.ts exposes no way to reach.
    handler = () => ({ status: 200, body: { rev: 2 } });
    await store.flush();
  });

  test('a key the server rejects is skipped, not left to block the keys behind it', async () => {
    // The reachable hazard this guards: garage_logs 500s on a missing foreign key, and dirty
    // is a Set restored in insertion order — without the skip, every key behind garage_logs
    // would stay dirty on every retry too, forever, for every tool.
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] }, cd_events: [] }, { tenancy_data: 1, cd_events: 1 });
    await store.bootstrap();

    handler = (url) => url.includes('/api/sync/tenancy_data')
      ? { status: 500, body: { error: 'fk violation' } }
      : url.includes('/api/sync')
        ? { status: 200, body: { rev: 9 } }
        : { status: 200, body: {} };

    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    store.store.setItem('cd_events', '[{"id":1}]');
    announced = [];

    await store.flush();

    const synced = calls.filter((c) => c.url.includes('/api/sync/'));
    assert.equal(synced.length, 2,
      'both keys were attempted — the rejection did not stop the loop early');
    assert.equal(store.pendingCount(), 1,
      'the rejected key stays dirty; the healthy key behind it still saved');
    assert.deepEqual(kinds(), ['saved', 'error'],
      'the successful key is reported saved, and the rejection is still surfaced rather than hidden by it');

    // Same stray-timer hazard as the previous test: the rejection above armed a backoff retry
    // that this test's own scope has no more use for. Let it succeed now so the leftover timer's
    // eventual fetch has nothing dirty left to send.
    handler = () => ({ status: 200, body: { rev: 9 } });
    await store.flush();
  });

  test('a body that fails to parse is treated as a rejected key, not a silent no-op', async () => {
    // fetch() resolves as soon as headers arrive, so a connection dropped mid-body — routine on
    // the mobile connections this app targets — makes res.json() itself reject, after res.ok
    // already read true. That must not escape runFlush unnoticed: the key stays dirty, on disk,
    // with a retry armed, exactly like any other rejected key.
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    handler = () => ({ status: 200, body: CORRUPT });

    announced = [];
    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    await store.flush();

    assert.equal(store.pendingCount(), 1, 'the key stays dirty rather than being silently dropped');
    assert.match(localStorage.getItem('acct:__dirty') ?? '', /tenancy_data/,
      'and that is persisted to disk, not just held in memory');
    assert.deepEqual(kinds(), ['saving', 'error'], 'the failure is surfaced, not swallowed');

    // Same stray-timer hazard as the two tests above (a rejected key arms a real backoff
    // setTimeout): drain the dirty set so that timer's eventual retry is a harmless no-op.
    handler = () => ({ status: 200, body: { rev: 2 } });
    await store.flush();
  });

  test('a network failure stops the run rather than skipping past it, unlike a rejected key', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] }, cd_events: [] }, { tenancy_data: 1, cd_events: 1 });
    await store.bootstrap();

    handler = () => { throw new Error('network down'); };

    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    store.store.setItem('cd_events', '[{"id":1}]');
    calls = [];

    await store.flush();

    const synced = calls.filter((c) => c.url.includes('/api/sync/'));
    assert.equal(synced.length, 1,
      'the first failure stops the loop — there is no point trying the rest while the server is unreachable');
    assert.equal(store.pendingCount(), 2,
      'both keys are still pending, unlike a rejected key which would only leave the one behind');
  });

  test('re-writing the same value is not a change, so it neither pushes nor toasts', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['same'] } }, { tenancy_data: 1 });
    await store.bootstrap();

    announced = [];
    // Several tools re-write their whole state from a mount effect; opening a tool must not
    // look like an edit, re-upload every photo in it, or flash "Saved".
    store.store.setItem('tenancy_data', '{"items":["same"]}');
    await store.flush();

    assert.equal(store.pendingCount(), 0);
    assert.deepEqual(kinds(), []);
    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0);
  });

  test('a 409 keeps the local edit rather than discarding it', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['server'] } }, { tenancy_data: 7 });
    await store.bootstrap();

    handler = (url) => url.includes('/api/sync')
      ? { status: 409, body: { rev: 9, data: { items: ['theirs'] } } }
      : { status: 200, body: {} };

    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    await store.flush();

    assert.equal(store.pendingCount(), 1, 'the local edit stays queued, never dropped');
    assert.equal(store.store.getItem('tenancy_data'), '{"items":["mine"]}');
  });

  test('resolving a conflict as theirs adopts the server copy', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['server'] } }, { tenancy_data: 7 });
    await store.bootstrap();
    store.store.setItem('tenancy_data', '{"items":["mine"]}');

    store.resolveConflict('tenancy_data', 'theirs', 9, { items: ['theirs'] });

    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data')!), { items: ['theirs'] });
    assert.equal(store.pendingCount(), 0);
  });

  test('legacy device data is offered for import, not uploaded behind your back', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});          // account has never seen this tool
    await store.bootstrap();

    assert.deepEqual(store.pendingImport(), ['tenancy_data']);
    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0,
      'nothing is sent until the user says so');
  });

  test('declining the import leaves the device data untouched', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});
    await store.bootstrap();

    store.skipImport();

    assert.deepEqual(store.pendingImport(), []);
    assert.equal(localStorage.getItem('tenancy_data'), '{"items":["legacy"]}',
      'declining must never delete anything');
    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0);
  });

  test('accepting the import uploads once and adopts the data', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});
    await store.bootstrap();

    handler = (url) => url.includes('/api/sync/import')
      ? { status: 200, body: { imported: ['tenancy_data'] } }
      : { status: 200, body: { rev: 1 } };

    assert.equal(await store.runImport(), true);
    const post = calls.find((c) => c.url.includes('/api/sync/import'));
    assert.deepEqual(post.body.tenancy_data, { items: ['legacy'] });
    assert.deepEqual(store.pendingImport(), []);
  });

  test('a failed import keeps the data pending rather than claiming success', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});
    await store.bootstrap();

    handler = () => ({ status: 500, body: { error: 'boom' } });

    assert.equal(await store.runImport(), false);
    assert.equal(localStorage.getItem('tenancy_data'), '{"items":["legacy"]}');
  });

  test('a tool the account already holds is not offered for import', async () => {
    const store = await freshStore();
    localStorage.setItem('tenancy_data', '{"items":["legacy"]}');
    signedInBootstrap({ tenancy_data: { items: ['server'] } }, { tenancy_data: 3 });
    await store.bootstrap();

    assert.deepEqual(store.pendingImport(), [],
      'the server copy wins; local legacy data is not offered to overwrite it');
  });

  test('signing in AFTER boot pulls and remounts, with no manual refresh', async () => {
    // The reported bug: main.tsx bootstraps as a guest, the user taps Sign in later, and the
    // store stayed in guest mode until the page was reloaded by hand.
    const store = await freshStore();
    let remounts = 0;
    store.onLateHydrate(() => { remounts++; });

    await store.bootstrap();                       // boots as a guest (401)
    assert.equal(store.store.getItem('tenancy_data'), null);

    // Now the sign-in callback lands, exactly as auth.ts does it.
    signedInBootstrap({ tenancy_data: { items: ['from account'] } }, { tenancy_data: 2 });
    const { setUser } = await import('./auth.ts');
    setUser({ email: 'a@b.c', name: 'A', picture: '' });
    await new Promise((r) => setTimeout(r, 20));   // let the subscriber's bootstrap settle

    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data')!), { items: ['from account'] },
      'account data is readable immediately after sign-in');
    assert.ok(remounts > 0, 'and the app remounts so mounted pages re-read it');
  });

  test('signing in announces that the data loaded', async () => {
    const store = await freshStore();
    await store.bootstrap();                       // guest

    signedInBootstrap({ tenancy_data: { items: ['x'] }, cd_events: [] }, { tenancy_data: 1, cd_events: 1 });
    announced = [];
    const { setUser } = await import('./auth.ts');
    setUser({ email: 'a@b.c', name: 'A', picture: '' });
    await new Promise((r) => setTimeout(r, 20));

    assert.deepEqual(kinds(), ['loaded']);
    assert.match(announced[0].message, /dimuatkan \(2 alat\)/);
  });

  test('data comes back after signing out and back in on the same account', async () => {
    // The reported bug, end to end: sign in, add a record, sign out (which reloads the page),
    // sign in again — and the record must be there.
    const store = await freshStore();
    const server: Record<string, unknown> = {};
    const revisions: Record<string, number> = {};
    const account = () => {
      handler = (url) => {
        if (url.includes('/api/bootstrap')) {
          return { status: 200, body: { user: { email: 'a@b.c', name: 'A', picture: '' }, revisions, data: server } };
        }
        const tool = decodeURIComponent(url.split('/api/sync/')[1]);
        server[tool] = calls.filter((c) => c.url.includes(tool) && c.method === 'PUT').pop()!.body.data;
        revisions[tool] = (revisions[tool] ?? 0) + 1;
        return { status: 200, body: { rev: revisions[tool] } };
      };
    };

    await store.bootstrap();
    account();
    const { setUser } = await import('./auth.ts');
    setUser({ email: 'a@b.c', name: 'A', picture: '' });
    await new Promise((r) => setTimeout(r, 20));

    store.store.setItem('tenancy_data', '{"items":["my house"]}');
    await store.flush();
    assert.deepEqual(server.tenancy_data, { items: ['my house'] }, 'it reached the account');

    // Sign out. AccountPanel then calls location.reload(), so the module state is thrown away.
    await store.clearAccountData();
    setUser(null);
    assert.equal(store.store.getItem('tenancy_data'), null, 'and is off the device');

    const afterReload = await freshStore();
    let remounts = 0;
    afterReload.onLateHydrate(() => { remounts++; });
    handler = () => ({ status: 401, body: { error: 'unauthorized' } });
    await afterReload.bootstrap();

    account();
    (await import('./auth.ts')).setUser({ email: 'a@b.c', name: 'A', picture: '' });
    await new Promise((r) => setTimeout(r, 20));

    assert.deepEqual(JSON.parse(afterReload.store.getItem('tenancy_data')!), { items: ['my house'] });
    assert.ok(remounts > 0, 'and the app remounts so every page re-reads it');
  });

  test('a pull that does not land keeps retrying instead of silently staying a guest', async () => {
    // This is the root cause of "I signed in and my data is gone": the pull timed out, the
    // store stayed in guest mode while the account panel showed a signed-in user, and nothing
    // ever asked again — the auth subscriber only fires when the user CHANGES.
    const store = await freshStore();
    await store.bootstrap();

    handler = () => { throw new Error('timed out'); };
    const { setUser } = await import('./auth.ts');
    setUser({ email: 'a@b.c', name: 'A', picture: '' });
    await new Promise((r) => setTimeout(r, 20));

    assert.equal(store.store.getItem('tenancy_data'), null, 'nothing loaded yet');

    // The server comes back a moment later. Nobody touches the app.
    signedInBootstrap({ tenancy_data: { items: ['from account'] } }, { tenancy_data: 2 });
    await new Promise((r) => setTimeout(r, 2600));   // first retry is at 2s

    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data') ?? 'null'), { items: ['from account'] },
      'the store must recover on its own once the server is reachable');
  });

  test('a refresh shows you as signed in before the network answers', async () => {
    // The reported bug: refresh the production app and it says you are not logged in, until you
    // open the account panel — whose /api/me call was the only thing putting you back.
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['mine'] } }, { tenancy_data: 3 });
    await store.bootstrap();                       // a normal signed-in session

    const { setUser, getUser } = await import('./auth.ts');
    setUser(null);                                 // the reload: auth starts empty again

    const reloaded = await freshStore();
    handler = () => { throw new Error('slow server'); };   // and the pull has not landed
    await reloaded.bootstrap();

    assert.equal(getUser()?.email, 'a@b.c',
      'a valid session must not paint as Guest mode just because the pull is slow');
    assert.deepEqual(JSON.parse(reloaded.store.getItem('tenancy_data')!), { items: ['mine'] },
      'and the data is on screen from the mirror, not withheld');
  });

  test('a failed pull on a cold refresh still retries', async () => {
    // schedulePull used to gate on getUser(), which is null on a cold boot — so the one case
    // that most needs a retry never got one, and the app sat in guest mode until something
    // else happened to call /api/me.
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['mine'] } }, { tenancy_data: 3 });
    await store.bootstrap();

    const { setUser } = await import('./auth.ts');
    setUser(null);
    localStorage.removeItem('acct:__user');        // no cached profile: only the uid marker

    const reloaded = await freshStore();
    handler = () => { throw new Error('down'); };
    await reloaded.bootstrap();

    signedInBootstrap({ tenancy_data: { items: ['fresh from server'] } }, { tenancy_data: 4 });
    await new Promise((r) => setTimeout(r, 2600));  // first retry is at 2s

    assert.deepEqual(JSON.parse(reloaded.store.getItem('tenancy_data')!), { items: ['fresh from server'] },
      'the pull must recover on its own after a refresh, with nothing for the user to click');
  });

  test('an explicit 401 still signs you out, and stays signed out across a refresh', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['mine'] } }, { tenancy_data: 3 });
    await store.bootstrap();

    const { setUser, getUser } = await import('./auth.ts');
    setUser(null);

    // Session really is gone now.
    const reloaded = await freshStore();
    handler = () => ({ status: 401, body: { error: 'unauthorized' } });
    await reloaded.bootstrap();

    assert.equal(getUser(), null, 'a 401 is an answer, not a network hiccup');
    assert.equal(localStorage.getItem('acct:__user'), null,
      'and the cached profile is dropped, or the next refresh would resurrect them');

    const again = await freshStore();
    await again.bootstrap();
    assert.equal(getUser(), null, 'still signed out after another refresh');
  });

  test('a 500 on the pull is not mistaken for an empty account', async () => {
    const store = await freshStore();
    localStorage.setItem('acct:__uid', 'a@b.c');
    localStorage.setItem('acct:tenancy_data', '{"items":["mine"]}');

    handler = () => ({ status: 500, body: { error: 'boom' } });
    await store.bootstrap();

    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data')!), { items: ['mine'] },
      'a server having a bad moment must never look like a signed-out or empty account');
    assert.equal(localStorage.getItem('acct:__uid'), 'a@b.c', 'and must not sign the user out');
  });

  test('a different account on the same device wipes the previous mirror', async () => {
    const store = await freshStore();
    localStorage.setItem('acct:__uid', 'someone@else.com');
    localStorage.setItem('acct:tenancy_data', '{"items":["theirs"]}');

    signedInBootstrap({}, {});
    await store.bootstrap();

    assert.equal(localStorage.getItem('acct:tenancy_data'), null,
      'user B must never see user A cached blobs');
  });

  // ---------------------------------------------------------------- nothing yanks the page away
  //
  // A remount destroys the entire React tree: every open modal, every half-typed form, the
  // scroll position. To the user that is indistinguishable from the app refreshing itself
  // while they were in the middle of adding a record. It is only ever worth it when the
  // identity behind the data changed.

  test('a cold refresh of a signed-in session does not remount or re-announce', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['mine'] } }, { tenancy_data: 3 });
    await store.bootstrap();
    (await import('./auth.ts')).setUser(null);     // the reload: auth starts empty again

    const reloaded = await freshStore();
    let remounts = 0;
    reloaded.onLateHydrate(() => { remounts++; });
    announced = [];
    await reloaded.bootstrap();

    assert.equal(remounts, 0,
      'merely opening the app is not a sign-in, and must not rebuild the whole tree a second after paint');
    assert.deepEqual(kinds(), [], 'nor tell the user their data loaded when they changed nothing');
  });

  test('a pull that brings newer data updates the store without remounting', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['mine'] } }, { tenancy_data: 3 });
    await store.bootstrap();
    (await import('./auth.ts')).setUser(null);

    const reloaded = await freshStore();
    let remounts = 0;
    reloaded.onLateHydrate(() => { remounts++; });
    signedInBootstrap({ tenancy_data: { items: ['edited on my phone'] } }, { tenancy_data: 4 });
    await reloaded.bootstrap();

    assert.deepEqual(JSON.parse(reloaded.store.getItem('tenancy_data')!), { items: ['edited on my phone'] },
      'the newer copy is in the store, ready for the next page that mounts');
    assert.equal(remounts, 0, 'but a background pull never yanks the page away mid-edit');
  });

  test('a record saved during a background pull is not reverted by it', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: ['old'] } }, { tenancy_data: 1 });
    await store.bootstrap();

    // Mid-edit: dirty, and the debounce has not fired yet.
    store.store.setItem('tenancy_data', '{"items":["my new record"]}');
    assert.equal(store.pendingCount(), 1);

    let remounts = 0;
    store.onLateHydrate(() => { remounts++; });

    // A retry pull lands. /api/bootstrap answers with the pre-push copy, because the server
    // was read before our PUT reached it — and bootstrap flushes before it applies the pull,
    // so `dirty` is empty by then and no longer protects the key.
    await store.bootstrap();

    assert.deepEqual(JSON.parse(store.store.getItem('tenancy_data')!), { items: ['my new record'] },
      'the record the user just saved must survive the pull that raced it');
    assert.equal(remounts, 0, 'and it must not look to them like the app refreshed itself');
  });

  test('two flushes racing each other push once, not twice', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    calls = [];
    // The debounce timer, `visibilitychange` and the `online` listener can all land together.
    await Promise.all([store.flush(), store.flush(), store.flush()]);

    assert.equal(calls.filter((c) => c.url.includes('/api/sync/tenancy_data')).length, 1,
      'a second PUT carries the same rev, comes back 409, and tells the user their record '
      + 'changed on another device when nothing of the sort happened');
  });

  test('a pending save is announced the moment it is made, not when it lands', async () => {
    const store = await freshStore();
    signedInBootstrap({ tenancy_data: { items: [] } }, { tenancy_data: 1 });
    await store.bootstrap();

    announced = [];
    store.store.setItem('tenancy_data', '{"items":["mine"]}');
    assert.deepEqual(kinds(), ['saving'],
      'clicking save is followed by feedback, not by 800ms of debounce and a round trip in silence');

    // The toast fills its progress bar over exactly this long, so a change to the debounce that
    // forgot the bar would leave it finishing early and then sitting full while the push ran.
    assert.equal((announced[0] as { waitMs?: number }).waitMs, 800,
      'the pending announcement carries the wait it is actually asking the user to sit through');

    await store.flush();
    assert.deepEqual(kinds(), ['saving', 'saved'], 'and the claim of a save still waits for the account');
    assert.equal((announced[1] as { waitMs?: number }).waitMs, undefined,
      'an outcome promises no duration');
  });
});
