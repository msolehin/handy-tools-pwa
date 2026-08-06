// Google sign-in via Google Identity Services. The ID token is verified server-side, which
// hands back an httpOnly session cookie — nothing sensitive is ever held in JS.
//
// GIS is loaded lazily, only when the user actually opens the account panel, because it is
// the app's first and only runtime network request and everything else must keep working
// offline.

export type User = { email: string; name: string; picture: string };

// Optional-chained so this module can also be imported outside Vite (node --test).
const CLIENT_ID = import.meta.env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
export const authConfigured = Boolean(CLIENT_ID);

let user: User | null = null;
let ready = false;
const listeners = new Set<(u: User | null) => void>();

export const getUser = () => user;
export const isReady = () => ready;

export function subscribe(fn: (u: User | null) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function emit() {
  for (const fn of listeners) fn(user);
}

export function setUser(next: User | null) {
  user = next;
  ready = true;
  emit();
}

/**
 * Ask the server who we are. A network failure must NOT clear the user — offline while signed
 * in is the normal case here, and dropping to "guest" would hide their own data from them.
 * Only an explicit 401 signs you out.
 */
export async function refresh(): Promise<User | null> {
  try {
    const res = await fetch('/api/me', {
      credentials: 'same-origin',
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) setUser((await res.json()).user ?? null);
    else if (res.status === 401) setUser(null);
  } catch {
    ready = true; // offline: keep whatever bootstrap already established
  }
  return user;
}

export async function signOut() {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch { /* the cookie is gone locally either way once we reload */ }
  setUser(null);
}

let gisPromise: Promise<void> | null = null;

function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise;
  gisPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => { gisPromise = null; reject(new Error('Could not reach Google')); };
    document.head.appendChild(script);
  });
  return gisPromise;
}

type GoogleId = {
  initialize(opts: { client_id: string; callback: (r: { credential: string }) => void }): void;
  renderButton(el: HTMLElement, opts: Record<string, string | number>): void;
};

/**
 * Render Google's own sign-in button into `el`. Using their button rather than One Tap because
 * One Tap is silently suppressed in plenty of browsers and the user is left tapping nothing.
 */
export async function renderSignInButton(
  el: HTMLElement,
  onDone: (ok: boolean, message?: string) => void,
) {
  if (!CLIENT_ID) return onDone(false, 'Sign-in is not configured yet.');
  try {
    await loadGis();
  } catch {
    return onDone(false, 'Could not reach Google. Check your connection.');
  }

  const id = (window as unknown as { google: { accounts: { id: GoogleId } } }).google.accounts.id;
  id.initialize({
    client_id: CLIENT_ID,
    callback: async ({ credential }) => {
      try {
        const res = await fetch('/api/auth/google', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ credential }),
        });
        if (!res.ok) {
          // 502/504 means the API isn't reachable — in dev that is almost always the server
          // on :3000 not running, which is worth saying rather than a generic failure.
          if (res.status === 502 || res.status === 504) {
            return onDone(false, "Can't reach the server. Is the API running?");
          }
          if (res.status === 503) {
            return onDone(false, 'The server has no database configured yet.');
          }
          const { error } = await res.json().catch(() => ({ error: `Sign-in failed (${res.status})` }));
          return onDone(false, error);
        }
        setUser((await res.json()).user);
        onDone(true);
      } catch {
        onDone(false, "Can't reach the server. Check your connection.");
      }
    },
  });
  id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', width: 260 });
}
