import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, Plus, X, Image as ImageIcon, Trash2, Pencil, Check } from 'lucide-react';
import { downscaleFile } from '../lib/downscale';
import { store } from '../lib/store';
import { daysUntil } from '../lib/horizon';

interface CountdownEvent {
  id: string;
  title: string;
  targetDate: string;
  imageUrl?: string;
}

/**
 * A stable colour per event, so a countdown with no photo still has an identity you recognise
 * in the list instead of being the fifth pink card.
 */
const hueOf = (title: string) => [...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

const Countdown: React.FC = () => {
  const [events, setEvents] = useState<CountdownEvent[]>(() => {
    const saved = store.getItem('cd_events');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    store.setItem('cd_events', JSON.stringify(events));
  }, [events]);

  const [showForm, setShowForm] = useState(false);
  const [fId, setFId] = useState<string | null>(null);
  const [fTitle, setFTitle] = useState('');
  const [fDate, setFDate] = useState('');
  const [fImage, setFImage] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!showForm) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowForm(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showForm]);

  const openForm = (event?: CountdownEvent) => {
    setFId(event?.id ?? null);
    setFTitle(event?.title ?? '');
    setFDate(event?.targetDate ?? '');
    setFImage(event?.imageUrl);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowForm(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    downscaleFile(file, 600).then(setFImage).catch(() => {});
  };

  const clearImage = () => {
    setFImage(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const canSave = Boolean(fTitle.trim() && fDate);

  const saveForm = () => {
    if (!canSave) return;
    const fields = { title: fTitle.trim(), targetDate: fDate, imageUrl: fImage };
    setEvents(prev => fId
      ? prev.map(ev => ev.id === fId ? { ...ev, ...fields } : ev)
      : [...prev, { id: Math.random().toString(36).slice(2, 9), ...fields }]);
    setShowForm(false);
  };

  const removeEvent = (event: CountdownEvent) => {
    if (window.confirm(`Padam countdown ke ${event.title}?`)) {
      setEvents(prev => prev.filter(ev => ev.id !== event.id));
    }
  };

  const dated = events.map(event => ({ event, days: daysUntil(event.targetDate) }));
  const upcoming = dated.filter(d => d.days >= 0).sort((a, b) => a.days - b.days);
  const passed = dated.filter(d => d.days < 0).sort((a, b) => b.days - a.days);

  const subtitle = events.length === 0
    ? 'Percutian, majlis kahwin, hari terakhir kerja'
    : upcoming.length === 0
      ? 'Tiada apa di hadapan — tambah yang seterusnya'
      : `Seterusnya dalam ${upcoming[0].days === 0 ? 'hari ini' : `${upcoming[0].days} hari`}`;

  const actions = (event: CountdownEvent, onDark: boolean) => (
    // z-10: the poster's text block is `relative` and comes later in the DOM, so without this it
    // paints over these buttons — its top padding is transparent but still eats the clicks.
    <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
      <button
        onClick={() => openForm(event)}
        aria-label={`Sunting ${event.title}`}
        className={`p-2 rounded-lg backdrop-blur-md transition-colors ${
          onDark ? 'bg-[#000]/55 text-[#fff] hover:bg-[#000]/75'
            : 'bg-text/5 text-muted hover:text-text hover:bg-text/10'
        }`}
      >
        <Pencil size={15} />
      </button>
      <button
        onClick={() => removeEvent(event)}
        aria-label={`Padam ${event.title}`}
        className={`p-2 rounded-lg backdrop-blur-md transition-colors ${
          onDark ? 'bg-[#000]/55 text-[#fff] hover:text-rose-300 hover:bg-[#000]/75'
            : 'bg-text/5 text-muted hover:text-rose-500 hover:bg-rose-500/10'
        }`}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );

  return (
    <div className="space-y-5 animate-fade-in pb-12">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2.5 bg-pink-500/15 text-pink-500 light:text-pink-700 rounded-xl shrink-0">
          <Calendar size={24} />
        </div>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold leading-tight">Countdown Day</h2>
          <p className="text-sm text-muted truncate">{subtitle}</p>
        </div>
      </div>

      <button
        onClick={() => openForm()}
        className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-pink-500/50 hover:text-pink-500 light:hover:text-pink-700 transition-all flex items-center justify-center"
      >
        <Plus size={20} className="mr-2" /> Tambah Countdown
      </button>

      <div className="space-y-4">
        {upcoming.map(({ event, days }) => {
          const hue = hueOf(event.title);
          return (
            <div
              key={event.id}
              className="relative overflow-hidden rounded-2xl border border-text/10 shadow-lg min-h-[168px] flex flex-col justify-end"
            >
              {/* A poster stays dark in both themes, so every colour on it is literal. `text-white`
                  and `bg-black` are theme tokens here that INVERT in light mode (see index.css), which
                  would paint dark slate text onto this dark card. Same reason .btn-primary writes
                  text-[#ffffff]. */}
              {event.imageUrl ? (
                <>
                  <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${event.imageUrl})` }} />
                  {/* The photo is whatever the user picked — a snow shot is as likely as a night
                      shot — so the text never relies on it. This scrim alone carries the contrast. */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#000]/90 via-[#000]/65 to-[#000]/25" />
                </>
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: `linear-gradient(135deg, hsl(${hue} 60% 34%), hsl(${(hue + 55) % 360} 58% 20%))` }}
                />
              )}

              {actions(event, true)}

              <div className="relative p-5 pt-10 [text-shadow:0_1px_6px_rgba(0,0,0,0.7)]">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#fff]/90 truncate">
                  {event.title}
                </p>
                <p className="font-display font-extrabold leading-[0.85] tracking-tight text-[#fff] text-6xl mt-1">
                  {days === 0 ? 'Hari Ini' : days}
                </p>
                <p className="text-xs text-[#fff]/90 mt-2">
                  {days === 0 ? formatDate(event.targetDate) : `hari · ${formatDate(event.targetDate)}`}
                </p>
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
            Belum ada apa-apa untuk dikira. Tambah percutian, majlis kahwin, hari terakhir kerja.
          </div>
        )}
      </div>

      {passed.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted px-1">
            Sudah Lepas · {passed.length}
          </h3>
          {passed.map(({ event, days }) => (
            <div key={event.id} className="glass-panel relative p-3 pr-24 flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-text/5 flex flex-col items-center justify-center shrink-0">
                <span className="font-mono text-sm font-bold text-muted leading-none">{Math.abs(days)}</span>
                <span className="text-[8px] uppercase tracking-wider text-muted">hari</span>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-text/70 truncate">{event.title}</p>
                <p className="text-xs text-muted truncate">{formatDate(event.targetDate)}</p>
              </div>
              {actions(event, false)}
            </div>
          ))}
        </div>
      )}

      {showForm && createPortal((
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={() => setShowForm(false)}
          role="dialog"
          aria-modal="true"
          aria-label={fId ? 'Sunting countdown' : 'Tambah countdown'}
        >
          <div
            className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up motion-reduce:animate-none"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">{fId ? 'Sunting countdown' : 'Tambah countdown'}</h3>
              <button onClick={() => setShowForm(false)} aria-label="Tutup" className="p-1 text-muted hover:text-text"><X size={20} /></button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="cd-title">Acara</label>
              <input
                id="cd-title"
                autoFocus
                value={fTitle}
                onChange={e => setFTitle(e.target.value)}
                placeholder="cth. Balik kampung, Kahwin, Peperiksaan"
                className="input-field w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider" htmlFor="cd-date">Tarikh</label>
              <input
                id="cd-date"
                type="date"
                value={fDate}
                onChange={e => setFDate(e.target.value)}
                className="input-field w-full"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Gambar (pilihan)</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} ref={fileInputRef} className="hidden" id="cd-image-upload" />
              {fImage ? (
                <div className="relative h-28 rounded-xl overflow-hidden border border-text/10">
                  <img src={fImage} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={clearImage}
                    aria-label="Buang gambar"
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#000]/50 text-[#fff]/80 hover:text-[#fff] backdrop-blur-md"
                  >
                    <X size={14} />
                  </button>
                  <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-bold text-[#fff]/90 bg-[#000]/50 px-2 py-1 rounded-lg backdrop-blur-md">
                    <Check size={12} /> Gambar ditambah
                  </span>
                </div>
              ) : (
                <label
                  htmlFor="cd-image-upload"
                  className="flex items-center justify-center gap-2 h-16 rounded-xl border border-dashed border-text/15 bg-text/5 text-muted text-sm cursor-pointer hover:text-text hover:bg-text/10 transition-colors"
                >
                  <ImageIcon size={18} /> Pilih gambar
                </label>
              )}
            </div>

            <button
              onClick={saveForm}
              disabled={!canSave}
              className="w-full py-3 rounded-xl bg-pink-600 text-[#fff] font-bold hover:bg-pink-700 disabled:opacity-50 disabled:pointer-events-none"
            >
              {fId ? 'Simpan Perubahan' : 'Mula Kira Detik'}
            </button>
          </div>
        </div>
      ), document.body)}
    </div>
  );
};

export default Countdown;
