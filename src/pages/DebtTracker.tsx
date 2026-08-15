import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HandCoins, Trash2, Check, Plus, X, Send, Copy, Share2, MessageCircle } from 'lucide-react';
import { store } from '../lib/store';
import { useT, t as tr, getLang, type Lang } from '../lib/lang';
import { nudge, TONES, type Tone } from '../lib/nudge';

interface IOU {
  id: string;
  personName: string;
  description: string;
  amount: number;
  type: 'owe_me' | 'i_owe';
  isSettled: boolean;
}

const STORAGE_KEY = 'debt_tracker_ious';

type Filter = 'all' | 'owe_me' | 'i_owe';

const money = (n: number) =>
  `RM${Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Each tone names its light-mode partner: emerald-500 is 2.5:1 on white, emerald-700 is 3.2:1 on
// the dark surface, so neither shade works alone in both themes.
const GREEN = 'text-emerald-500 light:text-emerald-700';
const RED = 'text-rose-500 light:text-rose-700';

const TAB_LABELS: { key: Filter; ms: string; en: string }[] = [
  { key: 'all', ms: 'Semua', en: 'All' },
  { key: 'owe_me', ms: 'Orang hutang you', en: 'Owed to you' },
  { key: 'i_owe', ms: 'You hutang orang', en: 'You owe' },
];

/**
 * One debt, read as a ledger line: name, dotted leader, amount. That is how a kedai runcit credit
 * book is written, and the leader is what makes the amounts scan as a column.
 *
 * Hoisted out of the page component on purpose — declared inline it would be a new component type
 * every render, so React would tear down and rebuild every row on each keystroke.
 */
/**
 * The reminder composer. Language is its own choice here rather than the app's — the app can be in
 * English while the person you are chasing reads Malay, and that mismatch is the whole point of a
 * message you send to someone else.
 */
const NudgeSheet: React.FC<{ iou: IOU; onClose: () => void }> = ({ iou, onClose }) => {
  const t = useT();
  const [tone, setTone] = useState<Tone>('gentle');
  const [lang, setMsgLang] = useState<Lang>(getLang);
  const [copied, setCopied] = useState(false);

  const message = nudge(tone, lang, iou.personName, money(iou.amount), iou.description);

  const copy = () => {
    navigator.clipboard?.writeText(message).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // The share sheet is the "any other app" route; where it does not exist (desktop Firefox, and
  // anything non-secure) the clipboard is the honest fallback rather than a dead button.
  // Feature-detected with `typeof`: lib.dom types `share` as always present, so a plain
  // truthiness check is a type error and would still be wrong on the browsers that lack it.
  const canShare = typeof navigator.share === 'function';
  const share = () => {
    if (canShare) navigator.share({ text: message }).catch(() => { /* user dismissed */ });
    else copy();
  };

  return createPortal((
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t(`Mesej untuk ${iou.personName}`, `Message for ${iou.personName}`)}
    >
      <div
        className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up motion-reduce:animate-none"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-lg min-w-0 truncate">
            {t(`Ingatkan ${iou.personName}`, `Remind ${iou.personName}`)}
          </h3>
          <button onClick={onClose} aria-label={t('Tutup', 'Close')} className="p-1 shrink-0 text-muted hover:text-text">
            <X size={20} />
          </button>
        </div>

        <div className="flex p-1 bg-text/5 rounded-xl gap-1">
          {(['ms', 'en'] as const).map(code => (
            <button
              key={code}
              onClick={() => setMsgLang(code)}
              aria-pressed={lang === code}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                lang === code ? 'bg-surface shadow-sm text-text' : 'text-muted hover:text-text'
              }`}
            >
              {code === 'ms' ? 'Bahasa Melayu' : 'English'}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {TONES.map(({ key, ms, en }) => (
            <button
              key={key}
              onClick={() => setTone(key)}
              aria-pressed={tone === key}
              className={`px-3 py-1.5 text-xs font-bold rounded-full border transition-colors ${
                tone === key
                  ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-500 light:text-indigo-700'
                  : 'border-text/15 text-muted hover:text-text hover:border-text/30'
              }`}
            >
              {t(ms, en)}
            </button>
          ))}
        </div>

        <p className="text-sm leading-relaxed bg-text/5 rounded-xl p-3.5 whitespace-pre-wrap">
          {message}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <a
            href={`https://wa.me/?text=${encodeURIComponent(message)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="py-3 rounded-xl bg-emerald-600 text-[#fff] font-bold flex items-center justify-center gap-2 hover:bg-emerald-700"
          >
            <MessageCircle size={16} /> WhatsApp
          </a>
          <button
            onClick={share}
            className="py-3 rounded-xl bg-indigo-600 text-[#fff] font-bold flex items-center justify-center gap-2 hover:bg-indigo-700"
          >
            {canShare
              ? <><Share2 size={16} /> {t('Kongsi', 'Share')}</>
              : <><Copy size={16} /> {copied ? t('Disalin!', 'Copied!') : t('Salin', 'Copy')}</>}
          </button>
        </div>
        {canShare && (
          <button onClick={copy} className="w-full text-xs font-bold text-muted hover:text-text flex items-center justify-center gap-1.5">
            <Copy size={13} /> {copied ? t('Disalin!', 'Copied!') : t('Salin teks', 'Copy the text')}
          </button>
        )}
      </div>
    </div>
  ), document.body);
};

const Row: React.FC<{
  iou: IOU;
  onToggle: (id: string) => void;
  onDelete: (iou: IOU) => void;
  onNudge: (iou: IOU) => void;
}> = ({ iou, onToggle, onDelete, onNudge }) => {
  const t = useT();
  const settled = iou.isSettled;
  const incoming = iou.type === 'owe_me';
  const initial = iou.personName.trim().charAt(0).toUpperCase() || '?';

  return (
    <div className={`glass-panel px-3 py-3 transition-all ${settled ? 'opacity-60' : ''}`}>
      <div className="flex items-center gap-3">
        {/* The person's disc is also the settle control — one target instead of a checkbox
            beside an avatar, and the check reads as "paid" on the person rather than on a box. */}
        <button
          onClick={() => onToggle(iou.id)}
          aria-pressed={settled}
          aria-label={settled
            ? t(`Tanda ${iou.personName} belum settle`, `Mark ${iou.personName} as unsettled`)
            : t(`Tanda ${iou.personName} dah settle`, `Mark ${iou.personName} as settled`)}
          title={settled ? t('Tap: belum settle', 'Tap: mark unsettled') : t('Tap: dah settle', 'Tap: mark settled')}
          className={`w-9 h-9 shrink-0 rounded-full border flex items-center justify-center text-sm font-extrabold transition-all hover:ring-2 hover:ring-indigo-500/40 ${
            settled
              ? 'bg-indigo-500 border-indigo-500 text-[#fff]'
              : incoming
                ? `bg-emerald-500/15 border-emerald-500/40 ${GREEN}`
                : `bg-rose-500/15 border-rose-500/40 ${RED}`
          }`}
        >
          {settled ? <Check size={16} strokeWidth={3} /> : initial}
        </button>

        <span className={`min-w-0 truncate font-semibold ${settled ? 'line-through text-text/50' : 'text-text'}`}>
          {iou.personName}
        </span>
        <span className="flex-1 border-b border-dotted border-text/25 min-w-[1rem]" aria-hidden="true" />
        <span
          className={`shrink-0 text-base font-extrabold ${settled ? 'text-text/50' : incoming ? GREEN : RED}`}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {incoming ? '+' : '−'}{money(iou.amount)}
        </span>
        {/* Only for money coming your way, and only while it is still owed — there is nothing to
            ask for once it is settled, and chasing yourself is not a feature. */}
        {incoming && !settled && (
          <button
            onClick={() => onNudge(iou)}
            aria-label={t(`Hantar peringatan kepada ${iou.personName}`, `Send ${iou.personName} a reminder`)}
            title={t('Minta balik', 'Ask for it back')}
            className="shrink-0 p-1.5 rounded-lg text-muted hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
          >
            <Send size={14} />
          </button>
        )}
        <button
          onClick={() => onDelete(iou)}
          aria-label={t(`Padam catatan untuk ${iou.personName}`, `Delete the note for ${iou.personName}`)}
          className="shrink-0 p-1.5 -mr-1 rounded-lg text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {iou.description && (
        <p className="text-xs text-muted mt-1 pl-12 truncate">{iou.description}</p>
      )}
    </div>
  );
};

const DebtTracker: React.FC = () => {
  const t = useT();
  const [ious, setIous] = useState<IOU[]>([]);
  const [isAddingIou, setIsAddingIou] = useState(false);
  const [iouName, setIouName] = useState('');
  const [iouDesc, setIouDesc] = useState('');
  const [iouAmount, setIouAmount] = useState('');
  const [iouType, setIouType] = useState<'owe_me' | 'i_owe'>('owe_me');
  const [isLoaded, setIsLoaded] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [nudging, setNudging] = useState<IOU | null>(null);

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setIous(JSON.parse(saved));
      } catch { /* unreadable blob — start empty rather than crash the page */ }
    } else {
      // Migrate from old debt_tracker_data if available
      const oldSaved = localStorage.getItem('debt_tracker_data');
      if (oldSaved) {
        try {
          const parsed = JSON.parse(oldSaved);
          if (parsed.ious) setIous(parsed.ious);
        } catch { /* same */ }
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      store.setItem(STORAGE_KEY, JSON.stringify(ious));
    }
  }, [ious, isLoaded]);

  const generateId = () => Math.random().toString(36).substring(2, 9);

  const addIou = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(iouAmount);
    if (!iouName.trim() || !amount) return;

    setIous([{
      id: generateId(),
      personName: iouName.trim(),
      description: iouDesc.trim(),
      amount,
      type: iouType,
      isSettled: false
    }, ...ious]);

    setIouName('');
    setIouDesc('');
    setIouAmount('');
    setIsAddingIou(false);
  };

  const toggleIouSettle = (id: string) => {
    setIous(ious.map(i => i.id === id ? { ...i, isSettled: !i.isSettled } : i));
  };

  const deleteIou = (iou: IOU) => {
    if (window.confirm(tr(`Padam catatan untuk ${iou.personName}?`, `Delete the note for ${iou.personName}?`))) {
      setIous(ious.filter(i => i.id !== iou.id));
    }
  };

  const open = ious.filter(i => !i.isSettled);
  const totalOwedToMe = open.filter(i => i.type === 'owe_me').reduce((acc, curr) => acc + curr.amount, 0);
  const totalIOwe = open.filter(i => i.type === 'i_owe').reduce((acc, curr) => acc + curr.amount, 0);

  const net = totalOwedToMe - totalIOwe;
  const board = totalOwedToMe + totalIOwe; // everything still on the table, the beam's full width

  const countFor = (key: Filter) => key === 'all' ? open.length : open.filter(i => i.type === key).length;

  const visible = ious.filter(i => filter === 'all' || i.type === filter);
  const active = visible.filter(i => !i.isSettled);
  const settled = visible.filter(i => i.isSettled);

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-indigo-500/15 text-indigo-500 light:text-indigo-700 rounded-xl shrink-0">
          <HandCoins size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight">Catat Hutang</h1>
          <p className="text-sm text-muted truncate">{t('Siapa hutang siapa, sebelum lupa', 'Who owes who, before you forget')}</p>
        </div>
      </div>

      {/* Running totals — open notes only, so settling one takes it off the board */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-panel p-4 border-emerald-500/30 text-center relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-emerald-500/10 blur-xl" aria-hidden="true" />
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">{t('Orang hutang you', 'Owed to you')}</p>
          <p className={`text-xl font-extrabold ${GREEN}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(totalOwedToMe)}
          </p>
        </div>
        <div className="glass-panel p-4 border-rose-500/30 text-center relative overflow-hidden">
          <div className="absolute -right-6 -top-6 w-20 h-20 rounded-full bg-rose-500/10 blur-xl" aria-hidden="true" />
          <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">{t('You hutang orang', 'You owe')}</p>
          <p className={`text-xl font-extrabold ${RED}`} style={{ fontVariantNumeric: 'tabular-nums' }}>
            {money(totalIOwe)}
          </p>
        </div>
      </div>

      {/* The balance beam. Where the two colours meet IS the ratio between them, so the bar says
          something the two numbers above cannot: which way the page is leaning, at a glance. */}
      <div className="glass-panel px-4 py-3">
        <div className="flex items-baseline justify-between gap-2 mb-2.5">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted shrink-0">{t('Imbangan', 'Balance')}</span>
          <span
            className={`text-lg font-extrabold leading-none truncate ${
              net > 0 ? GREEN : net < 0 ? RED : 'text-muted'
            }`}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {board === 0 ? t('Kosong', 'Nothing') : net === 0 ? t('Seri', 'Even')
              : net > 0 ? t(`You lebih ${money(net)}`, `You are up ${money(net)}`)
                : t(`You kurang ${money(net)}`, `You are down ${money(net)}`)}
          </span>
        </div>
        <div className="flex h-2.5 gap-0.5 rounded-full overflow-hidden bg-text/10">
          {board > 0 && (
            <>
              <div
                className="bg-emerald-500 transition-[width] duration-500 ease-out"
                style={{ width: `${(totalOwedToMe / board) * 100}%` }}
              />
              <div
                className="bg-rose-500 transition-[width] duration-500 ease-out"
                style={{ width: `${(totalIOwe / board) * 100}%` }}
              />
            </>
          )}
        </div>
      </div>

      {isAddingIou ? (
        <div className="glass-panel p-5 space-y-4 border-indigo-500/30 animate-slide-up motion-reduce:animate-none">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">{t('Catatan baru', 'New note')}</h3>
            <button onClick={() => setIsAddingIou(false)} aria-label={t('Tutup', 'Close')} className="p-1 text-muted hover:text-text">
              <X size={20} />
            </button>
          </div>

          <div className="flex p-1 bg-text/5 rounded-xl gap-1">
            <button
              onClick={() => setIouType('owe_me')}
              aria-pressed={iouType === 'owe_me'}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                iouType === 'owe_me' ? `bg-emerald-500/20 ${GREEN} border border-emerald-500/30` : 'text-muted hover:text-text'
              }`}
            >
              {t('Orang hutang you', 'Owed to you')}
            </button>
            <button
              onClick={() => setIouType('i_owe')}
              aria-pressed={iouType === 'i_owe'}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-colors ${
                iouType === 'i_owe' ? `bg-rose-500/20 ${RED} border border-rose-500/30` : 'text-muted hover:text-text'
              }`}
            >
              {t('You hutang orang', 'You owe')}
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="dt-name">{t('Nama orang', 'Person')}</label>
            <input id="dt-name" autoFocus type="text" value={iouName} onChange={e => setIouName(e.target.value)} placeholder={t('cth. Sara', 'e.g. Sara')} className="input-field w-full" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="dt-amount">{t('Jumlah (RM)', 'Amount (RM)')}</label>
            <input id="dt-amount" type="number" step="0.01" value={iouAmount} onChange={e => setIouAmount(e.target.value)} placeholder="0.00" className="input-field w-full font-mono text-lg" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="dt-desc">{t('Untuk apa? (pilihan)', 'What for? (optional)')}</label>
            <input id="dt-desc" type="text" value={iouDesc} onChange={e => setIouDesc(e.target.value)} placeholder={t('cth. Tiket konsert', 'e.g. Concert tickets')} className="input-field w-full" />
          </div>

          <button
            onClick={addIou}
            disabled={!iouName.trim() || !parseFloat(iouAmount)}
            className="w-full py-3 rounded-xl bg-indigo-600 text-[#fff] font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:pointer-events-none"
          >
            {t('Simpan catatan', 'Save note')}
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingIou(true)}
          className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-indigo-500/50 hover:text-indigo-500 light:hover:text-indigo-700 transition-all flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" /> {t('Tambah Catatan Hutang', 'Add a debt note')}
        </button>
      )}

      {/* Filter tabs */}
      <div className="flex p-1 bg-text/5 rounded-xl gap-1">
        {TAB_LABELS.map(({ key, ms, en }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            aria-pressed={filter === key}
            className={`flex-1 min-w-0 py-2 px-1 rounded-lg flex flex-col items-center gap-0.5 transition-colors ${
              filter === key ? 'bg-surface shadow-sm' : 'hover:bg-text/5'
            }`}
          >
            <span className={`text-[10px] font-bold leading-tight truncate max-w-full ${
              filter === key ? 'text-text' : 'text-muted'
            }`}>
              {t(ms, en)}
            </span>
            <span
              className={`text-sm font-black leading-none ${filter === key ? 'text-indigo-500 light:text-indigo-700' : 'text-muted'}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {countFor(key)}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {active.map(iou => (
          <Row key={iou.id} iou={iou} onToggle={toggleIouSettle} onDelete={deleteIou} onNudge={setNudging} />
        ))}

        {active.length === 0 && !isAddingIou && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            {ious.length === 0
              ? t('Takde hutang lagi. Catat satu sebelum lupa siapa hutang siapa.', 'No debts yet. Write one down before you forget who owes who.')
              : filter === 'all' ? t('Semua dah settle.', 'Everything is settled.')
                : filter === 'owe_me' ? t('Takde siapa hutang you.', 'Nobody owes you anything.')
                  : t('You takde hutang sesiapa.', 'You do not owe anybody.')}
          </div>
        )}
      </div>

      {settled.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted px-1">
            {t('Dah settle', 'Settled')} · {settled.length}
          </h2>
          {settled.map(iou => (
            <Row key={iou.id} iou={iou} onToggle={toggleIouSettle} onDelete={deleteIou} onNudge={setNudging} />
          ))}
        </div>
      )}

      {nudging && <NudgeSheet iou={nudging} onClose={() => setNudging(null)} />}
    </div>
  );
};

export default DebtTracker;
