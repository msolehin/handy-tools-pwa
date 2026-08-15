import React, { useEffect, useState } from 'react';
import { UploadCloud, Smartphone } from 'lucide-react';
import { pendingImport, runImport, skipImport, TOOL_LABELS } from '../lib/store';
import { getUser, subscribe } from '../lib/auth';
import { useT } from '../lib/lang';

/**
 * Shown once, after the first sign-in on a device that already held records. Declining is
 * safe: nothing on the device is deleted either way.
 */
const ImportPrompt: React.FC = () => {
  const t = useT();
  const [keys, setKeys] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const check = () => setKeys(getUser() ? pendingImport() : []);
    check();
    return subscribe(check);
  }, []);

  if (!keys.length) return null;

  // Side-tables (categories, custom titles) ride along with their parent tool; listing them
  // separately would read as clutter.
  const labels = [...new Set(
    keys.map((k) => (TOOL_LABELS[k] ?? k).replace(/ \(.*\)$/, '')))];

  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-[60] backdrop-blur-sm animate-fade-in" />
      <div className="fixed bottom-0 left-0 right-0 z-[60] max-w-md mx-auto animate-slide-up">
        <div className="glass-panel border-x-0 border-b-0 rounded-t-3xl shadow-2xl bg-background/95 p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-primary/15 text-primary rounded-xl shrink-0">
              <Smartphone size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold">{t('Bawa data anda sekali?', 'Bring your data with you?')}</h3>
              <p className="text-xs text-muted mt-1">
                {t('Peranti ini sudah ada rekod yang akaun anda belum lihat.', "This device already has records your account hasn't seen.")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {labels.map((label) => (
              <span key={label} className="text-xs px-2.5 py-1 rounded-lg bg-surface border border-text/10 text-text">
                {label}
              </span>
            ))}
          </div>

          {error && <p className="text-xs text-rose-500">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => { skipImport(); setKeys([]); }}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-text/5 text-text font-bold hover:bg-text/10 transition-colors disabled:opacity-50"
            >
              {t('Simpan pada peranti ini', 'Keep on this device')}
            </button>
            <button
              onClick={async () => {
                setBusy(true);
                setError(null);
                const ok = await runImport();
                setBusy(false);
                if (ok) setKeys([]);
                else setError(t('Muat naik gagal. Data anda masih selamat pada peranti ini — cuba lagi.', 'Upload failed. Your data is still safe on this device — try again.'));
              }}
              disabled={busy}
              className="flex-1 py-3 rounded-xl bg-primary text-white font-bold shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <UploadCloud size={18} />
              {busy ? t('Memuat naik…', 'Uploading…') : t('Tambah ke akaun', 'Add to account')}
            </button>
          </div>

          <p className="text-[11px] text-muted text-center">
            {t('Apa pun pilihan anda, tiada apa pada peranti ini dipadam.', 'Either way, nothing on this device is deleted.')}
          </p>
        </div>
      </div>
    </>
  );
};

export default ImportPrompt;
