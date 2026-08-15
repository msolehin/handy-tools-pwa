import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Check } from 'lucide-react';
import { DEFAULT_TOOLS } from '../lib/tools';
import { getUser, subscribe, type User } from '../lib/auth';
import { useT } from '../lib/lang';

const KINDS = [
  { id: 'feedback', ms: 'Maklum balas', en: 'Feedback' },
  { id: 'idea', ms: 'Idea', en: 'Idea' },
  { id: 'bug', ms: 'Pepijat', en: 'Bug' },
  { id: 'complaint', ms: 'Aduan', en: 'Complaint' },
];

/** Feedback box in the settings sheet. Signed-in accounts only — the reply address is the account. */
const FeedbackForm: React.FC = () => {
  const tr = useT();
  const [user, setUser] = useState<User | null>(getUser());
  useEffect(() => subscribe(setUser), []);
  const [kind, setKind] = useState('feedback');
  const [target, setTarget] = useState('/app');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || state === 'sending') return;
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ kind, target, message }),
      });
      if (!res.ok) {
        const { error: err } = await res.json().catch(() => ({ error: '' }));
        setError(res.status === 429
          ? tr('Terlalu banyak mesej buat masa ini — cuba lagi nanti.', 'Too many messages for now — try again later.')
          : res.status === 401
            ? tr('Sesi anda telah tamat — log masuk semula.', 'Your session expired — sign in again.')
            : err || tr('Gagal hantar. Cuba lagi.', "Couldn't send. Try again."));
        return setState('error');
      }
      setMessage('');
      setState('sent');
    } catch {
      setError(tr('Tidak dapat menghubungi pelayan. Semak sambungan anda.', "Can't reach the server. Check your connection."));
      setState('error');
    }
  };

  return (
    <details className="rounded-2xl bg-surface border border-text/5 overflow-hidden">
      <summary className="flex items-center gap-2 p-3 cursor-pointer list-none select-none">
        <div className="p-2 rounded-xl bg-sky-500/20 text-sky-400 shrink-0">
          <MessageSquare size={18} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-text text-sm">{tr('Hantar maklum balas', 'Send feedback')}</p>
          <p className="text-xs text-muted line-clamp-1">{tr('Idea, aduan atau pepijat — untuk mana-mana alat.', 'Idea, complaint or bug — on any tool.')}</p>
        </div>
      </summary>

      {!user ? (
        <p className="px-4 pb-4 text-xs text-muted">
          {tr('Log masuk di atas untuk hantar maklum balas — itulah cara kami boleh balas anda.', "Sign in above to send feedback — that's how we can reply to you.")}
        </p>
      ) : state === 'sent' ? (
        <div className="p-4 pt-0 text-center">
          <p className="text-sm font-semibold text-emerald-500 flex items-center justify-center gap-1.5">
            <Check size={16} /> {tr('Terima kasih — dah sampai.', 'Thanks — got it.')}
          </p>
          <button
            onClick={() => setState('idle')}
            className="text-xs text-muted hover:text-text mt-2 underline"
          >
            {tr('Hantar lagi satu', 'Send another')}
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="p-4 pt-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(k => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                  kind === k.id
                    ? 'bg-primary/15 border-primary/40 text-primary'
                    : 'bg-text/5 border-text/10 text-muted hover:text-text'
                }`}
              >
                {tr(k.ms, k.en)}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs text-muted">{tr('Mengenai', 'About')}</span>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="mt-1 w-full p-2.5 rounded-xl bg-background border border-text/10 text-sm text-text"
            >
              <option value="/app">{tr('Halaman utama', 'Home page')}</option>
              {DEFAULT_TOOLS.map(t => (
                <option key={t.id} value={t.to}>{t.title}</option>
              ))}
              <option value="other">{tr('Lain-lain / keseluruhan app', 'Other / the whole app')}</option>
            </select>
          </label>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            placeholder={tr('Apa yang anda fikirkan?', "What's on your mind?")}
            className="w-full p-3 rounded-xl bg-background border border-text/10 text-sm text-text placeholder:text-muted resize-y"
          />

          <p className="text-[11px] text-muted">{tr('Dihantar dari', 'Sent from')} {user.email}</p>

          {state === 'error' && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={!message.trim() || state === 'sending'}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40 transition-opacity"
          >
            <Send size={16} /> {state === 'sending' ? tr('Menghantar…', 'Sending…') : tr('Hantar', 'Send')}
          </button>
        </form>
      )}
    </details>
  );
};

export default FeedbackForm;
