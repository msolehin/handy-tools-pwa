import React, { useEffect, useState } from 'react';
import { MessageSquare, Send, Check } from 'lucide-react';
import { DEFAULT_TOOLS } from '../lib/tools';
import { getUser, subscribe, type User } from '../lib/auth';

const KINDS = [
  { id: 'feedback', label: 'Feedback' },
  { id: 'idea', label: 'Idea' },
  { id: 'bug', label: 'Bug' },
  { id: 'complaint', label: 'Complaint' },
];

/** Feedback box in the settings sheet. Signed-in accounts only — the reply address is the account. */
const FeedbackForm: React.FC = () => {
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
          ? 'Too many messages for now — try again later.'
          : res.status === 401
            ? 'Your session expired — sign in again.'
            : err || "Couldn't send. Try again.");
        return setState('error');
      }
      setMessage('');
      setState('sent');
    } catch {
      setError("Can't reach the server. Check your connection.");
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
          <p className="font-semibold text-text text-sm">Send feedback</p>
          <p className="text-xs text-muted line-clamp-1">Idea, complaint or bug — on any tool.</p>
        </div>
      </summary>

      {!user ? (
        <p className="px-4 pb-4 text-xs text-muted">
          Sign in above to send feedback — that's how we can reply to you.
        </p>
      ) : state === 'sent' ? (
        <div className="p-4 pt-0 text-center">
          <p className="text-sm font-semibold text-emerald-500 flex items-center justify-center gap-1.5">
            <Check size={16} /> Thanks — got it.
          </p>
          <button
            onClick={() => setState('idle')}
            className="text-xs text-muted hover:text-text mt-2 underline"
          >
            Send another
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
                {k.label}
              </button>
            ))}
          </div>

          <label className="block">
            <span className="text-xs text-muted">About</span>
            <select
              value={target}
              onChange={e => setTarget(e.target.value)}
              className="mt-1 w-full p-2.5 rounded-xl bg-background border border-text/10 text-sm text-text"
            >
              <option value="/app">Home page</option>
              {DEFAULT_TOOLS.map(t => (
                <option key={t.id} value={t.to}>{t.title}</option>
              ))}
              <option value="other">Other / the whole app</option>
            </select>
          </label>

          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            required
            maxLength={2000}
            rows={4}
            placeholder="What's on your mind?"
            className="w-full p-3 rounded-xl bg-background border border-text/10 text-sm text-text placeholder:text-muted resize-y"
          />

          <p className="text-[11px] text-muted">Sent from {user.email}</p>

          {state === 'error' && <p className="text-xs text-rose-500">{error}</p>}

          <button
            type="submit"
            disabled={!message.trim() || state === 'sending'}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-primary text-white font-bold text-sm disabled:opacity-40 transition-opacity"
          >
            <Send size={16} /> {state === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </form>
      )}
    </details>
  );
};

export default FeedbackForm;
