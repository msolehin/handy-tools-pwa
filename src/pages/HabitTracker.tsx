import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check, CalendarDays, LayoutGrid, ListChecks, ChevronLeft, ChevronRight, X, Pencil, ArrowUpDown, ChevronUp, ChevronDown } from 'lucide-react';
import { store } from '../lib/store';

interface Habit {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  completedDates: string[]; // 'YYYY-MM-DD'
}

const STORAGE_KEY = 'habit_tracker_data';

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
const PRESET_EMOJIS = ['🔥', '💧', '🏃', '📚', '🧘', '💪', '🥗', '😴', '🚭', '🎯', '✍️', '🧹'];
const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const WEEKDAYS = ['A', 'I', 'S', 'R', 'K', 'J', 'S'];

const NUM = { fontVariantNumeric: 'tabular-nums' } as const;

const generateId = () => Math.random().toString(36).substring(2, 9);
// Keep only the last emoji/character typed (handles multi-codepoint emojis like 🏃‍♀️)
const lastEmoji = (s: string) => {
  if (!s) return '';
  try {
    const Seg = (Intl as any).Segmenter;
    if (Seg) {
      const parts = Array.from(new Seg(undefined, { granularity: 'grapheme' }).segment(s), (x: any) => x.segment);
      return (parts[parts.length - 1] as string) || '';
    }
  } catch (e) {}
  const arr = Array.from(s);
  return arr[arr.length - 1] || '';
};
const toKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const toDisplay = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
const parseKey = (k: string) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const isNextDay = (a: string, b: string) => toKey(addDays(parseKey(a), 1)) === b;

const computeStreaks = (dates: string[]) => {
  if (dates.length === 0) return { current: 0, last: 0 };
  const uniq = Array.from(new Set(dates)).sort();
  const runs: number[] = [];
  let prev = uniq[0];
  let len = 1;
  const ends: string[] = [];
  for (let i = 1; i < uniq.length; i++) {
    if (isNextDay(prev, uniq[i])) {
      len++;
    } else {
      runs.push(len); ends.push(prev); len = 1;
    }
    prev = uniq[i];
  }
  runs.push(len); ends.push(prev);

  const today = toKey(new Date());
  const yesterday = toKey(addDays(new Date(), -1));
  const lastEnd = ends[ends.length - 1];
  if (lastEnd === today || lastEnd === yesterday) {
    return { current: runs[runs.length - 1], last: runs.length >= 2 ? runs[runs.length - 2] : 0 };
  }
  return { current: 0, last: runs[runs.length - 1] };
};

const HabitTracker: React.FC = () => {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<'single' | 'weekly' | 'yearly'>('single');

  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[3]);
  const [newEmoji, setNewEmoji] = useState('');
  const [error, setError] = useState('');

  const [weekOffset, setWeekOffset] = useState(0);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState(PRESET_COLORS[3]);
  const [editEmoji, setEditEmoji] = useState('');
  const [editError, setEditError] = useState('');
  const [isReordering, setIsReordering] = useState(false);

  useEffect(() => {
    const saved = store.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) setHabits(parsed);
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) store.setItem(STORAGE_KEY, JSON.stringify(habits));
  }, [habits, isLoaded]);

  const todayKey = toKey(new Date());

  // autoFocus scrolls the field into view; the panel opens in place, so that scroll is pure jump.
  // Stable ref identity, so it fires on mount only and doesn't re-focus on every keystroke.
  const focusNoScroll = useCallback((el: HTMLInputElement | null) => { el?.focus({ preventScroll: true }); }, []);

  const addHabit = () => {
    const name = newName.trim();
    if (!name) { setError('Masukkan nama tabiat'); return; }
    if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
      setError('Tabiat dengan nama ini sudah wujud');
      return;
    }
    setHabits(prev => [...prev, { id: generateId(), name, color: newColor, emoji: newEmoji.trim() || undefined, completedDates: [] }]);
    setNewName('');
    setNewColor(PRESET_COLORS[3]);
    setNewEmoji('');
    setError('');
    setIsAdding(false);
  };

  const deleteHabit = (id: string) => {
    const h = habits.find(x => x.id === id);
    if (h && !window.confirm(`Padam "${h.name}"? Sejarahnya akan hilang.`)) return;
    setHabits(prev => prev.filter(x => x.id !== id));
  };

  const startEdit = (h: Habit) => { setEditingId(h.id); setEditName(h.name); setEditColor(h.color); setEditEmoji(h.emoji || ''); setEditError(''); };
  const saveEdit = () => {
    const name = editName.trim();
    if (!name) { setEditError('Masukkan nama'); return; }
    if (habits.some(h => h.id !== editingId && h.name.toLowerCase() === name.toLowerCase())) {
      setEditError('Nama sudah wujud');
      return;
    }
    setHabits(prev => prev.map(h => h.id === editingId ? { ...h, name, color: editColor, emoji: editEmoji.trim() || undefined } : h));
    setEditingId(null);
    setEditError('');
  };

  const moveHabit = (id: string, dir: -1 | 1) => {
    setHabits(prev => {
      const i = prev.findIndex(h => h.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const arr = [...prev];
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  };

  const toggleDate = (habitId: string, key: string) => {
    setHabits(prev => prev.map(h => h.id === habitId
      ? { ...h, completedDates: h.completedDates.includes(key) ? h.completedDates.filter(d => d !== key) : [...h.completedDates, key] }
      : h));
  };

  // Today's roll-up — the one number worth reading before anything else on the page.
  const doneToday = habits.filter(h => h.completedDates.includes(todayKey)).length;
  const pct = habits.length ? Math.round((doneToday / habits.length) * 100) : 0;
  const bestStreak = habits.reduce((m, h) => Math.max(m, computeStreaks(h.completedDates).current), 0);
  const last7 = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i - 6));

  // --- Streak line shown in every tab: streak gets the display face, the rest is support text ---
  const StreakRow = ({ habit }: { habit: Habit }) => {
    const { current, last } = computeStreaks(habit.completedDates);
    return (
      <div className="flex items-baseline gap-1.5" title={`Streak sebelum ini: ${last} hari`}>
        <span className="font-display text-lg font-extrabold leading-none" style={{ ...NUM, color: habit.color }}>{current}</span>
        <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">hari berturut</span>
        <span className="ml-auto text-[11px] text-muted shrink-0" style={NUM}>{habit.completedDates.length} jumlah</span>
      </div>
    );
  };

  // Seven bars = the last week at a glance, so the daily tab answers "am I slipping?" without a tab switch.
  const Last7 = ({ habit }: { habit: Habit }) => (
    <div className="flex gap-1 mt-3" title="7 hari lepas">
      {last7.map(d => {
        const on = habit.completedDates.includes(toKey(d));
        return <span key={toKey(d)} className="h-1.5 flex-1 rounded-full transition-colors" style={{ backgroundColor: on ? habit.color : 'rgba(148,163,184,0.2)' }} />;
      })}
    </div>
  );

  const Tick = ({ done, color, size = 44, onClick, disabled, label }: { done: boolean; color: string; size?: number; onClick?: () => void; disabled?: boolean; label?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={done}
      className={`shrink-0 rounded-2xl border-2 flex items-center justify-center transition-all duration-200 ${disabled ? 'opacity-40 cursor-default' : 'active:scale-90 hover:scale-105'} ${done ? 'heart-pop-anim' : ''}`}
      style={{
        width: size, height: size,
        backgroundColor: done ? color : 'transparent',
        borderColor: done ? color : 'rgba(148,163,184,0.35)',
        color: done ? '#fff' : 'rgba(148,163,184,0.45)',
        boxShadow: done ? `0 6px 18px ${color}55` : undefined,
      }}
      title={label}
      aria-label={label}
    >
      <Check size={Math.round(size * 0.5)} strokeWidth={3} />
    </button>
  );

  // --- Weekly helpers ---
  const baseWeekStart = addDays(new Date(), -((new Date().getDay() + 6) % 7) + weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(baseWeekStart, i));
  const weekLabel = `${MONTHS[weekDays[0].getMonth()]} ${weekDays[0].getDate()} – ${MONTHS[weekDays[6].getMonth()]} ${weekDays[6].getDate()}, ${weekDays[6].getFullYear()}`;

  // --- Yearly grid helpers ---
  const year = new Date().getFullYear();
  const jan1 = new Date(year, 0, 1);
  const gridStart = addDays(jan1, -jan1.getDay());
  const dec31 = new Date(year, 11, 31);
  const gridEnd = addDays(dec31, 6 - dec31.getDay());
  const yearCells: Date[] = [];
  for (let c = new Date(gridStart); c <= gridEnd; c = addDays(c, 1)) yearCells.push(new Date(c));
  const weeksCount = yearCells.length / 7;
  const CELL = 11, GAP = 3, STEP = CELL + GAP;
  const monthMarks: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < weeksCount; w++) {
    const cell = yearCells[w * 7];
    if (cell.getFullYear() === year && cell.getMonth() !== lastMonth) {
      monthMarks.push({ col: w, label: MONTHS[cell.getMonth()] });
      lastMonth = cell.getMonth();
    }
  }
  const todayIndex = yearCells.findIndex(d => toKey(d) === todayKey);
  const todayCol = todayIndex >= 0 ? Math.floor(todayIndex / 7) : 0;

  // Centre today's column in the yearly grids when the tab opens
  useEffect(() => {
    if (tab !== 'yearly') return;
    const id = requestAnimationFrame(() => {
      document.querySelectorAll<HTMLDivElement>('[data-year-scroll]').forEach(el => {
        el.scrollLeft = Math.max(0, todayCol * STEP + STEP / 2 - el.clientWidth / 2);
      });
    });
    return () => cancelAnimationFrame(id);
  }, [tab]);

  return (
    <div className="space-y-5 pb-20 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-violet-500/15 text-violet-500 light:text-violet-700 rounded-xl">
          <ListChecks size={24} />
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-extrabold text-text leading-tight tracking-tight">Habit Tracker</h1>
          <p className={`text-sm ${habits.length && doneToday === habits.length ? 'font-semibold text-violet-500 light:text-violet-700' : 'text-muted'}`}>
            {habits.length ? `${doneToday} daripada ${habits.length} siap hari ni` : 'Bina streak anda'}
          </p>
        </div>
      </div>

      {/* Today's progress — ring + headline, the scan target of the whole page */}
      {habits.length > 0 && (
        <div className="glass-panel p-4 flex items-center gap-4">
          <div
            className="relative w-[72px] h-[72px] shrink-0 rounded-full transition-all duration-500"
            style={{ background: `conic-gradient(#8b5cf6 ${pct * 3.6}deg, rgba(148,163,184,0.18) 0deg)` }}
          >
            <div className="absolute inset-[6px] rounded-full bg-surface flex items-center justify-center">
              <span className="font-display text-2xl font-extrabold leading-none text-text" style={NUM}>
                {doneToday}<span className="text-muted text-sm font-bold">/{habits.length}</span>
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">Hari ini</span>
            <p className="font-display text-lg font-extrabold leading-tight tracking-tight text-text">
              {doneToday === habits.length ? 'Semua siap! 🎉' : doneToday === 0 ? 'Jom mula 💪' : `${habits.length - doneToday} lagi untuk habis`}
            </p>
            <div className="flex items-center gap-1.5 mt-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-500 light:text-orange-700 font-bold" style={NUM}>
                🔥 {bestStreak}
              </span>
              <span className="text-muted truncate">streak terpanjang yang masih hidup</span>
            </div>
          </div>
        </div>
      )}

      {/* Add habit */}
      {isAdding ? (
        // fade-in, not slide-up: slide-up starts a full panel-height below, so focusing the
        // name field scrolls to it down there before the animation settles.
        <div className="glass-panel p-5 space-y-4 border-violet-500/30 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-extrabold tracking-tight">Tabiat Baru</h3>
            <button onClick={() => { setIsAdding(false); setError(''); }} className="p-1 text-muted hover:text-text"><X size={18} /></button>
          </div>
          {/* Live preview — the emoji and colour choices below only mean something once you see the card they build. */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-text/5 border border-text/10">
            <span className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-xl leading-none transition-colors" style={{ backgroundColor: `${newColor}26`, color: newColor }}>
              {newEmoji || <span className="font-display text-base font-extrabold">{(newName.trim()[0] || '?').toUpperCase()}</span>}
            </span>
            <div className="min-w-0">
              <p className={`font-bold truncate leading-tight ${newName.trim() ? 'text-text' : 'text-muted'}`}>{newName.trim() || 'Nama tabiat'}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-lg font-extrabold leading-none" style={{ ...NUM, color: newColor }}>0</span>
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">hari berturut</span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Nama tabiat</label>
            <input
              type="text"
              value={newName}
              ref={focusNoScroll}
              onChange={e => { setNewName(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') addHabit(); }}
              placeholder="cth. Minum air, Baca 10 muka surat"
              className="input-field w-full"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Emoji <span className="text-text/25">pilihan</span></label>
              {newEmoji && <button onClick={() => setNewEmoji('')} className="text-[11px] font-bold text-muted hover:text-text">Buang</button>}
            </div>
            <div className="grid grid-cols-6 gap-1.5">
              {PRESET_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => setNewEmoji(em)}
                  className={`aspect-square rounded-lg text-lg leading-none flex items-center justify-center transition-all active:scale-90 ${newEmoji === em ? 'bg-violet-500/20 ring-2 ring-violet-500/50' : 'bg-text/5 hover:bg-text/10'}`}
                >
                  {em}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={newEmoji}
              onChange={e => setNewEmoji(lastEmoji(e.target.value))}
              placeholder="…atau taip sendiri 🙂"
              autoCapitalize="none"
              autoComplete="off"
              className="input-field w-full text-sm py-2"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Warna</label>
            <div className="grid grid-cols-9 gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  aria-label={`Warna ${c}`}
                  className="aspect-square rounded-full flex items-center justify-center transition-transform active:scale-90"
                  style={{ backgroundColor: c, boxShadow: newColor === c ? `0 0 0 2px rgb(var(--color-surface)), 0 0 0 4px ${c}` : undefined }}
                >
                  {newColor === c && <Check size={14} strokeWidth={4} className="text-[#fff]" />}
                </button>
              ))}
              <label className="aspect-square rounded-full border-2 border-dashed border-text/30 flex items-center justify-center cursor-pointer relative overflow-hidden hover:border-text/50" title="Warna tersuai">
                <Plus size={12} className="text-muted" />
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-400">{error}</p>}
          <button
            onClick={addHabit}
            disabled={!newName.trim()}
            className="w-full py-3.5 rounded-xl bg-violet-500 hover:bg-violet-600 text-[#fff] font-bold transition-all active:scale-95 shadow-lg shadow-violet-500/25 disabled:opacity-40 disabled:shadow-none disabled:active:scale-100"
          >
            Tambah Tabiat
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-violet-500/50 hover:text-violet-500 light:hover:text-violet-700 transition-all flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" /> Tambah Tabiat
        </button>
      )}

      {habits.length === 0 ? (
        <div className="text-center px-6 py-10 border border-dashed border-text/15 rounded-2xl">
          <div className="text-4xl mb-3">🔥</div>
          <p className="font-display text-lg font-extrabold tracking-tight text-text">Belum ada tabiat</p>
          <p className="text-sm text-muted mt-1">Tambah satu dan tanda ia setiap hari — streak bermula esok.</p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-text/5 rounded-xl">
            {([['single', 'Harian', ListChecks], ['weekly', 'Mingguan', CalendarDays], ['yearly', 'Tahunan', LayoutGrid]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`py-2.5 rounded-lg transition-colors flex flex-col items-center gap-1 ${tab === key ? 'bg-surface text-violet-500 light:text-violet-700 shadow-sm' : 'text-muted hover:text-text'}`}
              >
                <Icon size={16} />
                <span className="text-[11px] font-bold uppercase tracking-[0.08em]">{label}</span>
              </button>
            ))}
          </div>

          {/* SINGLE VIEW */}
          {tab === 'single' && (
            <div className="space-y-3">
              {habits.length > 1 && (
                <div className="flex justify-end">
                  <button
                    onClick={() => { setIsReordering(r => !r); setEditingId(null); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isReordering ? 'bg-violet-500/20 text-violet-400 border border-violet-500/40' : 'bg-text/5 text-muted hover:text-text'}`}
                  >
                    <ArrowUpDown size={14} /> {isReordering ? 'Siap' : 'Susun'}
                  </button>
                </div>
              )}
              {habits.map((habit, idx) => {
                const done = habit.completedDates.includes(todayKey);
                return (
                  <div
                    key={habit.id}
                    className="glass-panel p-4 transition-colors"
                    style={done ? { borderColor: `${habit.color}66` } : undefined}
                  >
                    <div className="flex items-center gap-3">
                    {editingId !== habit.id && (
                      <span
                        className="w-11 h-11 rounded-xl shrink-0 flex items-center justify-center text-xl leading-none"
                        style={{ backgroundColor: `${habit.color}26`, color: habit.color }}
                      >
                        {habit.emoji || <span className="font-display text-base font-extrabold">{habit.name.charAt(0).toUpperCase()}</span>}
                      </span>
                    )}
                    {editingId === habit.id ? (
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-lg leading-none" style={{ backgroundColor: `${editColor}26`, color: editColor }}>
                            {editEmoji || <span className="font-display text-sm font-extrabold">{(editName.trim()[0] || '?').toUpperCase()}</span>}
                          </span>
                          <input
                            type="text"
                            value={editName}
                            ref={focusNoScroll}
                            onChange={e => { setEditName(e.target.value); setEditError(''); }}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            className="input-field py-1.5 text-sm flex-1 min-w-0"
                          />
                          <button onClick={saveEdit} aria-label="Simpan" className="p-2 rounded-lg bg-violet-500/20 text-violet-500 light:text-violet-700 hover:bg-violet-500/30 shrink-0"><Check size={16} /></button>
                          <button onClick={() => setEditingId(null)} aria-label="Batal" className="p-2 rounded-lg bg-text/5 text-muted hover:text-text shrink-0"><X size={16} /></button>
                        </div>
                        <div className="grid grid-cols-9 gap-1.5">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              aria-label={`Warna ${c}`}
                              className="aspect-square rounded-full flex items-center justify-center transition-transform active:scale-90"
                              style={{ backgroundColor: c, boxShadow: editColor === c ? `0 0 0 2px rgb(var(--color-surface)), 0 0 0 4px ${c}` : undefined }}
                            >
                              {editColor === c && <Check size={12} strokeWidth={4} className="text-[#fff]" />}
                            </button>
                          ))}
                          <label className="aspect-square rounded-full border-2 border-dashed border-text/30 flex items-center justify-center cursor-pointer relative overflow-hidden hover:border-text/50" title="Warna tersuai">
                            <Plus size={10} className="text-muted" />
                            <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                          </label>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-bold text-muted uppercase tracking-[0.18em]">Emoji</span>
                          {editEmoji && <button onClick={() => setEditEmoji('')} className="text-[11px] font-bold text-muted hover:text-text">Buang</button>}
                        </div>
                        <div className="grid grid-cols-6 gap-1.5">
                          {PRESET_EMOJIS.map(em => (
                            <button
                              key={em}
                              onClick={() => setEditEmoji(em)}
                              className={`aspect-square rounded-lg text-base leading-none flex items-center justify-center transition-all active:scale-90 ${editEmoji === em ? 'bg-violet-500/20 ring-2 ring-violet-500/50' : 'bg-text/5 hover:bg-text/10'}`}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          value={editEmoji}
                          onChange={e => setEditEmoji(lastEmoji(e.target.value))}
                          placeholder="…atau taip sendiri 🙂"
                          autoCapitalize="none"
                          autoComplete="off"
                          className="input-field w-full text-sm py-2"
                        />
                        {editError && <p className="text-[11px] font-semibold text-red-400">{editError}</p>}
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-text truncate leading-tight">{habit.name}</h4>
                          {!isReordering && (
                            <button onClick={() => startEdit(habit)} aria-label={`Sunting ${habit.name}`} className="text-muted hover:text-text shrink-0 transition-colors" title="Sunting nama"><Pencil size={13} /></button>
                          )}
                        </div>
                        <StreakRow habit={habit} />
                      </div>
                    )}
                    {isReordering ? (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => moveHabit(habit.id, -1)} disabled={idx === 0} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronUp size={18} /></button>
                        <button onClick={() => moveHabit(habit.id, 1)} disabled={idx === habits.length - 1} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronDown size={18} /></button>
                      </div>
                    ) : editingId !== habit.id && (
                      <>
                        <Tick done={done} color={habit.color} onClick={() => toggleDate(habit.id, todayKey)} label="Tanda hari ini" />
                        <button onClick={() => deleteHabit(habit.id)} aria-label={`Padam ${habit.name}`} className="text-muted hover:text-rose-500 p-2 bg-text/5 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                    </div>
                    {editingId !== habit.id && !isReordering && <Last7 habit={habit} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* WEEKLY VIEW */}
          {tab === 'weekly' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <button onClick={() => setWeekOffset(o => o - 1)} aria-label="Minggu sebelum" className="p-2 rounded-lg bg-text/5 text-muted hover:text-text shrink-0"><ChevronLeft size={18} /></button>
                <div className="text-center min-w-0">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{weekOffset === 0 ? 'Minggu ini' : `${Math.abs(weekOffset)} minggu lepas`}</span>
                  <span className="block font-display text-sm font-extrabold tracking-tight text-text truncate" style={NUM}>{weekLabel}</span>
                </div>
                <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={weekOffset >= 0} aria-label="Minggu seterusnya" className="p-2 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30 shrink-0"><ChevronRight size={18} /></button>
              </div>
              {habits.map(habit => (
                <div key={habit.id} className="glass-panel p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-lg leading-none" style={{ backgroundColor: `${habit.color}26`, color: habit.color }}>
                      {habit.emoji || <span className="font-display text-sm font-extrabold">{habit.name.charAt(0).toUpperCase()}</span>}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-text truncate leading-tight">{habit.name}</h4>
                      <StreakRow habit={habit} />
                    </div>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((d) => {
                      const key = toKey(d);
                      const done = habit.completedDates.includes(key);
                      const isToday = key === todayKey;
                      const future = d > new Date();
                      return (
                        <div key={key} className="flex flex-col items-center gap-1.5">
                          <span className={`text-[10px] font-bold uppercase tracking-wider ${isToday ? 'text-text' : 'text-muted'}`}>{WEEKDAYS[d.getDay()]}</span>
                          <button
                            onClick={() => !future && toggleDate(habit.id, key)}
                            disabled={future}
                            aria-label={toDisplay(d)}
                            className={`w-full aspect-square rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${future ? 'opacity-30 cursor-default' : 'active:scale-90 hover:scale-105'} ${isToday ? 'ring-2 ring-offset-1 ring-offset-surface' : ''}`}
                            style={{
                              ...NUM,
                              backgroundColor: done ? habit.color : 'transparent',
                              borderColor: done ? habit.color : 'rgba(148,163,184,0.3)',
                              color: done ? '#fff' : 'rgb(var(--color-muted))',
                              ...(isToday ? { boxShadow: `0 0 0 2px ${habit.color}` } : {}),
                            }}
                          >
                            {done ? <Check size={14} strokeWidth={3} /> : d.getDate()}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* YEARLY VIEW */}
          {tab === 'yearly' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Ringkasan</span>
                <span className="font-display text-sm font-extrabold text-text" style={NUM}>{year}</span>
                <div className="h-px flex-1 bg-text/10" />
              </div>
              {habits.map(habit => {
                const done = habit.completedDates.includes(todayKey);
                const set = new Set(habit.completedDates);
                const daysThisYear = habit.completedDates.filter(k => k.startsWith(`${year}-`)).length;
                return (
                  <div key={habit.id} className="glass-panel p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-9 h-9 rounded-xl shrink-0 flex items-center justify-center text-lg leading-none" style={{ backgroundColor: `${habit.color}26`, color: habit.color }}>
                        {habit.emoji || <span className="font-display text-sm font-extrabold">{habit.name.charAt(0).toUpperCase()}</span>}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-text truncate leading-tight">{habit.name}</h4>
                        <StreakRow habit={habit} />
                      </div>
                      <Tick done={done} color={habit.color} size={36} onClick={() => toggleDate(habit.id, todayKey)} label="Tanda hari ini" />
                    </div>
                    <div className="flex items-baseline gap-2 pt-1">
                      <span className="font-display text-3xl font-extrabold leading-none" style={{ ...NUM, color: habit.color }}>{daysThisYear}</span>
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">hari ditanda dalam {year}</span>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar pb-1" data-year-scroll>
                      <div style={{ width: weeksCount * STEP }}>
                        {/* Month labels */}
                        <div className="relative h-4 mb-1" style={{ width: weeksCount * STEP }}>
                          {monthMarks.map(m => (
                            <span key={m.label + m.col} className="absolute text-[9px] font-bold uppercase tracking-wider text-muted" style={{ left: m.col * STEP }}>{m.label}</span>
                          ))}
                        </div>
                        {/* Grid */}
                        <div className="grid gap-[3px]" style={{ gridTemplateRows: `repeat(7, ${CELL}px)`, gridAutoFlow: 'column', gridAutoColumns: `${CELL}px` }}>
                          {yearCells.map((d, i) => {
                            const inYear = d.getFullYear() === year;
                            const key = toKey(d);
                            const isDone = set.has(key);
                            const isToday = key === todayKey;
                            const future = d > new Date();
                            const interactive = isToday;
                            return (
                              <button
                                key={i}
                                onClick={() => interactive && toggleDate(habit.id, key)}
                                disabled={!interactive}
                                title={inYear ? toDisplay(d) : ''}
                                className={`rounded-[2px] ${interactive ? 'cursor-pointer' : 'cursor-default'}`}
                                style={{
                                  width: CELL, height: CELL,
                                  backgroundColor: !inYear ? 'transparent' : isDone ? habit.color : future ? 'rgba(148,163,184,0.06)' : 'rgba(148,163,184,0.15)',
                                  outline: isToday ? `2px solid ${habit.color}` : 'none',
                                  outlineOffset: isToday ? '1px' : undefined,
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted leading-relaxed">Hanya hari ini boleh ditanda di sini. Guna <span className="font-bold text-text/70">Mingguan</span> untuk ubah hari lepas.</p>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default HabitTracker;
