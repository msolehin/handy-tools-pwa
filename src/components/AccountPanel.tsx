import React, { useEffect, useRef, useState } from 'react';
import { LogOut, ShieldCheck, WifiOff } from 'lucide-react';
import { authConfigured, getUser, refresh, renderSignInButton, signOut, subscribe, type User } from '../lib/auth';
import { clearAccountData } from '../lib/store';
import { useT } from '../lib/lang';

/** Account block shown at the top of the settings sheet. */
const AccountPanel: React.FC = () => {
  const t = useT();
  const [user, setUser] = useState<User | null>(getUser());
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => subscribe(setUser), []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => { refresh(); }, []);

  // Only reach out to Google once the panel is actually open, signed out, and online.
  useEffect(() => {
    if (user || !online || !authConfigured || !buttonRef.current) return;
    renderSignInButton(buttonRef.current, (ok, message) => {
      if (!ok) setError(message ?? t('Log masuk gagal', 'Sign-in failed'));
    });
  }, [user, online]);

  if (user) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-2xl bg-surface border border-text/5">
        {user.picture
          ? <img src={user.picture} alt="" className="w-10 h-10 rounded-full shrink-0" />
          : <div className="w-10 h-10 rounded-full bg-primary/20 shrink-0" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-text line-clamp-1">{user.name || user.email}</p>
          <p className="text-xs text-muted line-clamp-1 flex items-center gap-1">
            {online
              ? <><ShieldCheck size={12} className="text-emerald-500" /> {t('Disimpan ke akaun anda', 'Saved to your account')}</>
              : <><WifiOff size={12} /> {t('Luar talian — perubahan disimpan bila anda sambung semula', 'Offline — changes save when you reconnect')}</>}
          </p>
        </div>
        <button
          onClick={async () => {
            // Flush first: never silently drop an edit that hasn't reached the account.
            await clearAccountData();
            await signOut();
            location.reload();
          }}
          className="p-2 rounded-xl bg-text/5 text-muted hover:text-text transition-colors shrink-0"
          aria-label={t('Log keluar', 'Sign out')}
          title={t('Log keluar', 'Sign out')}
        >
          <LogOut size={18} />
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 rounded-2xl bg-surface border border-text/5 text-center">
      <p className="font-semibold text-text">{t('Mod tetamu', 'Guest mode')}</p>
      <p className="text-xs text-muted mt-1 mb-3">
        {t('Rekod anda tinggal dalam tab ini sahaja. Log masuk untuk menyimpannya dan mencapainya dari mana-mana peranti.', 'Your records stay in this tab only. Sign in to keep them and reach them from any device.')}
      </p>
      {!authConfigured
        ? <p className="text-xs text-muted">{t('Log masuk belum disediakan pada pelayan ini.', "Sign-in isn't set up on this server yet.")}</p>
        : !online
          ? <p className="text-xs text-muted flex items-center justify-center gap-1"><WifiOff size={12} /> {t('Sambung ke internet untuk log masuk.', 'Connect to the internet to sign in.')}</p>
          : <div ref={buttonRef} className="flex justify-center" />}
      {error && <p className="text-xs text-rose-500 mt-2">{error}</p>}
    </div>
  );
};

export default AccountPanel;
