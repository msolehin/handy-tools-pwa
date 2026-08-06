import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { SYNCED_ROUTES } from '../lib/store';
import { getUser, subscribe, type User } from '../lib/auth';

/**
 * Warns a signed-out user, on the tools that keep records, that what they type here lives in
 * this tab only. Rendered once from Layout rather than pasted into 15 pages — Layout already
 * knows the route.
 *
 * Deliberately not dismissible: the data really does vanish, and a dismissed warning is worse
 * than none because it reads as "handled".
 */
const GuestNotice: React.FC<{ onSignIn: () => void }> = ({ onSignIn }) => {
  const [user, setUser] = useState<User | null>(getUser());
  useEffect(() => subscribe(setUser), []);
  const { pathname } = useLocation();

  if (user || !SYNCED_ROUTES[pathname]) return null;

  return (
    <div className="mb-4 flex items-center gap-3 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25">
      <CloudOff size={18} className="text-amber-500 shrink-0" />
      <p className="text-xs text-text/80 leading-snug flex-1">
        <span className="font-semibold">Not saved.</span>{' '}
        Entries here stay in this tab and are gone when you close it.
      </p>
      <button
        onClick={onSignIn}
        className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-600 hover:bg-amber-500/30 transition-colors border border-amber-500/30"
      >
        Sign in
      </button>
    </div>
  );
};

export default GuestNotice;
