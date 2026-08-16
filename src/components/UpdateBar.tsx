import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useT } from '../lib/lang';

/**
 * A new build has taken over, and the page is still running the old one.
 *
 * The service worker registers with `registerType: 'autoUpdate'`, which used to reload the page
 * itself the instant a new worker activated — mid-form, with no warning, and no way to get the
 * half-typed record back. main.tsx now intercepts that (see the `onNeedReload` comment there)
 * and raises `sw:update-ready` instead, so the reload happens when the user says so.
 *
 * It matters that this is offered rather than merely ignored: the new worker claimed the page
 * and cleaned out the old precache, so a route this session has not visited yet can no longer
 * fetch its chunk. Dismissing is still allowed — the next natural page load picks the update up
 * either way — but someone who hits a blank tool now knows what to press.
 */
const UpdateBar: React.FC = () => {
  const tr = useT();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onReady = () => setReady(true);
    window.addEventListener('sw:update-ready', onReady);
    return () => window.removeEventListener('sw:update-ready', onReady);
  }, []);

  if (!ready) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 sm:bottom-8 z-[71] mx-auto w-[min(22rem,100%)] animate-slide-up"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 rounded-2xl border border-primary/30 bg-surface/95 backdrop-blur-md shadow-lg">
        <RefreshCw size={16} className="shrink-0 text-primary" />
        <p className="text-xs font-semibold leading-snug text-text/90">
          {tr('Versi baharu sedia.', 'A new version is ready.')}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="ml-auto shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-white"
        >
          {tr('Muat semula', 'Reload')}
        </button>
        <button
          type="button"
          onClick={() => setReady(false)}
          aria-label={tr('Tutup', 'Dismiss')}
          className="shrink-0 rounded-full p-1 text-muted"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

export default UpdateBar;
