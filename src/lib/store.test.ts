// node --experimental-webstorage --localstorage-file=.tmp-store-test --test src/lib/store.test.ts
//
// Covers the paths where store.ts could destroy user data:
//   - a guest never writes to localStorage, but still SEES pre-existing localStorage data
//   - preference keys are untouched by any of this
//   - nothing is pushed before a pull has confirmed what the server holds
//   - a 409 keeps the local edit instead of dropping it
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Minimal browser surface. store.ts registers listeners at module scope, so these have to
// exist before the dynamic import below.
const listeners: Record<string, (() => void)[]> = {};
(globalThis as any).window = {
  addEventListener: (name: string, fn: () => void) => { (listeners[name] ??= []).push(fn); },
  dispatchEvent: () => true,
};
(globalThis as any).document = { visibilityState: 'visible' };
// Plain classes, not parameter properties — Node's strip-only TS mode rejects those.
(globalThis as any).CustomEvent = class { type: string; constructor(type: string) { this.type = type; } };
(globalThis as any).Event = class { type: string; constructor(type: string) { this.type = type; } };

let online = true;
Object.defineProperty(globalThis, 'navigator', {
  value: { get onLine() { return online; } },
  configurable: true,
});

type Call = { url: string; body: any };
let calls: Call[] = [];
let handler: (url: string, init: RequestInit) => { status: number; body: unknown };

(globalThis as any).fetch = async (url: string, init: RequestInit = {}) => {
  const body = init.body ? JSON.parse(init.body as string) : undefined;
  calls.push({ url, body });
  const { status, body: out } = handler(url, init);
  return { ok: status >= 200 && status < 300, status, json: async () => out };
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
  online = true;
  handler = () => ({ status: 401, body: { error: 'unauthorized' } });
};

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
});

describe('store: guest mode', () => {
  beforeEach(reset);

  test('a guest write goes to sessionStorage, never localStorage', async () => {
    const store = await freshStore();
    await store.bootstrap();
    store.store.setItem('birthdays_data', '{"items":[1]}');

    assert.equal(sessionStorage.getItem('birthdays_data'), '{"items":[1]}');
    assert.equal(localStorage.getItem('birthdays_data'), null,
      'nothing a guest types may persist past the tab');
  });

  test('a guest still sees data an existing install already had', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    await store.bootstrap();

    assert.equal(store.store.getItem('birthdays_data'), '{"items":["legacy"]}',
      'without this, every existing user opens to an empty app on deploy day');
  });

  test('this-tab edits win over the legacy value', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    await store.bootstrap();
    store.store.setItem('birthdays_data', '{"items":["fresh"]}');

    assert.equal(store.store.getItem('birthdays_data'), '{"items":["fresh"]}');
    assert.equal(localStorage.getItem('birthdays_data'), '{"items":["legacy"]}',
      'the legacy value is read-only and must survive untouched');
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
    store.store.setItem('birthdays_data', '{"items":[1]}');
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
    signedInBootstrap({ birthdays_data: { items: ['server'] } }, { birthdays_data: 4 });
    await store.bootstrap();

    assert.deepEqual(JSON.parse(store.store.getItem('birthdays_data')!), { items: ['server'] });
    assert.ok(localStorage.getItem('acct:birthdays_data'), 'mirrored for the next cold start');
  });

  test('a write pushes and clears the pending count', async () => {
    const store = await freshStore();
    signedInBootstrap({ birthdays_data: { items: [] } }, { birthdays_data: 1 });
    await store.bootstrap();

    store.store.setItem('birthdays_data', '{"items":["mine"]}');
    assert.equal(store.pendingCount(), 1);

    await store.flush();
    const put = calls.find((c) => c.url.includes('/api/sync/birthdays_data'));
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

    store.store.setItem('birthdays_data', '{"items":[]}');
    await store.flush();

    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0,
      'an unconfirmed session must never overwrite the account');
    assert.equal(store.pendingCount(), 1, 'but the edit is kept, pending');
  });

  test('offline writes are queued, not lost', async () => {
    const store = await freshStore();
    signedInBootstrap({ birthdays_data: { items: [] } }, { birthdays_data: 1 });
    await store.bootstrap();

    online = false;
    store.store.setItem('birthdays_data', '{"items":["offline edit"]}');
    await store.flush();

    assert.equal(store.pendingCount(), 1, 'still pending while offline');
    assert.deepEqual(JSON.parse(localStorage.getItem('acct:__dirty')!), ['birthdays_data']);
    assert.equal(store.store.getItem('birthdays_data'), '{"items":["offline edit"]}',
      'and readable immediately — offline behaviour is unchanged');
  });

  test('a 409 keeps the local edit rather than discarding it', async () => {
    const store = await freshStore();
    signedInBootstrap({ birthdays_data: { items: ['server'] } }, { birthdays_data: 7 });
    await store.bootstrap();

    handler = (url) => url.includes('/api/sync')
      ? { status: 409, body: { rev: 9, data: { items: ['theirs'] } } }
      : { status: 200, body: {} };

    store.store.setItem('birthdays_data', '{"items":["mine"]}');
    await store.flush();

    assert.equal(store.pendingCount(), 1, 'the local edit stays queued, never dropped');
    assert.equal(store.store.getItem('birthdays_data'), '{"items":["mine"]}');
  });

  test('resolving a conflict as theirs adopts the server copy', async () => {
    const store = await freshStore();
    signedInBootstrap({ birthdays_data: { items: ['server'] } }, { birthdays_data: 7 });
    await store.bootstrap();
    store.store.setItem('birthdays_data', '{"items":["mine"]}');

    store.resolveConflict('birthdays_data', 'theirs', 9, { items: ['theirs'] });

    assert.deepEqual(JSON.parse(store.store.getItem('birthdays_data')!), { items: ['theirs'] });
    assert.equal(store.pendingCount(), 0);
  });

  test('legacy device data is offered for import, not uploaded behind your back', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});          // account has never seen this tool
    await store.bootstrap();

    assert.deepEqual(store.pendingImport(), ['birthdays_data']);
    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0,
      'nothing is sent until the user says so');
  });

  test('declining the import leaves the device data untouched', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});
    await store.bootstrap();

    store.skipImport();

    assert.deepEqual(store.pendingImport(), []);
    assert.equal(localStorage.getItem('birthdays_data'), '{"items":["legacy"]}',
      'declining must never delete anything');
    assert.equal(calls.filter((c) => c.url.includes('/api/sync')).length, 0);
  });

  test('accepting the import uploads once and adopts the data', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});
    await store.bootstrap();

    handler = (url) => url.includes('/api/sync/import')
      ? { status: 200, body: { imported: ['birthdays_data'] } }
      : { status: 200, body: { rev: 1 } };

    assert.equal(await store.runImport(), true);
    const post = calls.find((c) => c.url.includes('/api/sync/import'));
    assert.deepEqual(post.body.birthdays_data, { items: ['legacy'] });
    assert.deepEqual(store.pendingImport(), []);
  });

  test('a failed import keeps the data pending rather than claiming success', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    signedInBootstrap({}, {});
    await store.bootstrap();

    handler = () => ({ status: 500, body: { error: 'boom' } });

    assert.equal(await store.runImport(), false);
    assert.equal(localStorage.getItem('birthdays_data'), '{"items":["legacy"]}');
  });

  test('a tool the account already holds is not offered for import', async () => {
    const store = await freshStore();
    localStorage.setItem('birthdays_data', '{"items":["legacy"]}');
    signedInBootstrap({ birthdays_data: { items: ['server'] } }, { birthdays_data: 3 });
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
    assert.equal(store.store.getItem('birthdays_data'), null);

    // Now the sign-in callback lands, exactly as auth.ts does it.
    signedInBootstrap({ birthdays_data: { items: ['from account'] } }, { birthdays_data: 2 });
    const { setUser } = await import('./auth.ts');
    setUser({ email: 'a@b.c', name: 'A', picture: '' });
    await new Promise((r) => setTimeout(r, 20));   // let the subscriber's bootstrap settle

    assert.deepEqual(JSON.parse(store.store.getItem('birthdays_data')!), { items: ['from account'] },
      'account data is readable immediately after sign-in');
    assert.ok(remounts > 0, 'and the app remounts so mounted pages re-read it');
  });

  test('a different account on the same device wipes the previous mirror', async () => {
    const store = await freshStore();
    localStorage.setItem('acct:__uid', 'someone@else.com');
    localStorage.setItem('acct:birthdays_data', '{"items":["theirs"]}');

    signedInBootstrap({}, {});
    await store.bootstrap();

    assert.equal(localStorage.getItem('acct:birthdays_data'), null,
      'user B must never see user A cached blobs');
  });
});
