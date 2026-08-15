// Two switches, signed-in only. Self-contained including its own fetches — it is rendered in
// exactly one place and nothing else needs its state.
import { useEffect, useState } from 'react';
import { Bell, Mail } from 'lucide-react';
import { getUser, subscribe, type User } from '../lib/auth';
import { useT, t as tr } from '../lib/lang';

const urlBase64ToUint8Array = (base64: string) => {
  const padded = (base64 + '='.repeat((4 - base64.length % 4) % 4))
    .replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** iOS only allows Web Push once the PWA is installed to the home screen. */
const iosNeedsInstall = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches;

type RowProps = {
  icon: typeof Bell;
  title: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
};

// Declared outside NotificationSettings: a component defined inside another remounts on every
// render, which would drop focus and restart the toggle transition mid-tap.
function Row({ icon: Icon, title, desc, on, onChange, disabled }: RowProps) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="w-full flex items-center justify-between p-3 rounded-2xl bg-surface border border-text/5 disabled:opacity-50"
    >
      <div className="flex items-center gap-3 text-left">
        <div className="p-2 rounded-xl shrink-0 bg-amber-500/20 text-amber-400">
          <Icon size={20} />
        </div>
        <div>
          <p className="font-medium text-text">{title}</p>
          <p className="text-xs text-muted mt-0.5 line-clamp-1">{desc}</p>
        </div>
      </div>
      <div className={`w-11 h-6 rounded-full shrink-0 flex items-center px-0.5 transition-colors ${on ? 'bg-primary' : 'bg-text/15'}`}>
        <div className={`w-5 h-5 rounded-full bg-white transition-transform ${on ? 'translate-x-5' : ''}`} />
      </div>
    </button>
  );
}

export default function NotificationSettings() {
  const t = useT();
  const [user, setUser] = useState<User | null>(getUser());
  const [email, setEmail] = useState(true);
  const [push, setPush] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => subscribe(setUser), []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/notification-prefs')
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => {
        if (!p) return;
        setEmail(p.emailEnabled);
        setPush(p.pushEnabled);
        setConfigured(p.pushConfigured);
      })
      .catch(() => { /* offline: the toggles just show their defaults */ });
  }, [user]);

  if (!user) return null;

  const toggleEmail = async (next: boolean) => {
    setEmail(next);
    await fetch('/api/notification-prefs', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ emailEnabled: next }),
    }).catch(() => setEmail(!next));
  };

  const togglePush = async (next: boolean) => {
    setNote('');
    if (!next) {
      setPush(false);
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      await fetch('/api/push/subscribe', { method: 'DELETE' }).catch(() => {});
      return;
    }

    if (iosNeedsInstall()) {
      setNote(tr('Pasang SenangKit ke skrin utama dulu, baru boleh terima notifikasi.', 'Install SenangKit to your home screen first, then notifications can be turned on.'));
      return;
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setNote(tr('Pelayar ini tak sokong notifikasi.', "This browser doesn't support notifications."));
      return;
    }

    setBusy(true);
    try {
      if (await Notification.requestPermission() !== 'granted') {
        setNote(tr('Notifikasi disekat. Benarkan dalam tetapan pelayar.', 'Notifications are blocked. Allow them in your browser settings.'));
        return;
      }

      const { key } = await fetch('/api/push/key').then((r) => r.json());
      if (!key) { setNote(tr('Notifikasi belum disediakan di server.', 'Notifications are not set up on the server yet.')); return; }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });

      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) { setNote(tr('Gagal daftar notifikasi. Cuba lagi.', "Couldn't register for notifications. Try again.")); return; }
      setPush(true);
    } catch {
      setNote(tr('Gagal daftar notifikasi. Cuba lagi.', "Couldn't register for notifications. Try again."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="pt-5 pb-1 px-1">
        <h4 className="text-sm font-bold text-text">{t('Peringatan', 'Reminders')}</h4>
        <p className="text-xs text-muted mt-0.5">{t('30, 7 dan 1 hari sebelum sesuatu tamat tempoh.', '30, 7 and 1 day before something expires.')}</p>
      </div>

      <Row icon={Mail} title={t('Emel', 'Email')} desc={user.email} on={email} onChange={toggleEmail} />
      <Row
        icon={Bell}
        title={t('Notifikasi', 'Push notifications')}
        desc={configured ? t('Terus ke telefon anda', 'Straight to your phone') : t('Belum disediakan', 'Not set up yet')}
        on={push}
        onChange={togglePush}
        disabled={busy || !configured}
      />

      {note && <p className="text-xs text-amber-400 px-1">{note}</p>}
    </div>
  );
}
