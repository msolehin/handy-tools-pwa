import React, { useState, useEffect } from 'react';
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
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

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

  const addHabit = () => {
    const name = newName.trim();
    if (!name) { setError('Enter a habit name'); return; }
    if (habits.some(h => h.name.toLowerCase() === name.toLowerCase())) {
      setError('A habit with this name already exists');
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
    if (h && !window.confirm(`Delete "${h.name}"? Its history will be lost.`)) return;
    setHabits(prev => prev.filter(x => x.id !== id));
  };

  const startEdit = (h: Habit) => { setEditingId(h.id); setEditName(h.name); setEditColor(h.color); setEditEmoji(h.emoji || ''); setEditError(''); };
  const saveEdit = () => {
    const name = editName.trim();
    if (!name) { setEditError('Enter a name'); return; }
    if (habits.some(h => h.id !== editingId && h.name.toLowerCase() === name.toLowerCase())) {
      setEditError('Name already exists');
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

  // --- Streak chip shown in every tab ---
  const StreakRow = ({ habit }: { habit: Habit }) => {
    const { current, last } = computeStreaks(habit.completedDates);
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="inline-flex items-center gap-1 font-bold px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/30">
          🔥 {current} day{current === 1 ? '' : 's'}
        </span>
        <span className="text-muted">Last: {last}</span>
        <span className="text-muted ml-auto">{habit.completedDates.length} total</span>
      </div>
    );
  };

  const Tick = ({ done, color, size = 40, onClick, disabled, label }: { done: boolean; color: string; size?: number; onClick?: () => void; disabled?: boolean; label?: string }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 rounded-xl border-2 flex items-center justify-center transition-all ${disabled ? 'opacity-40 cursor-default' : 'active:scale-90'}`}
      style={{
        width: size, height: size,
        backgroundColor: done ? color : 'transparent',
        borderColor: done ? color : 'rgba(148,163,184,0.4)',
        color: done ? '#fff' : 'transparent',
      }}
      title={label}
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
    <div className="max-w-md mx-auto p-4 pb-24 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-violet-500/20 rounded-xl">
            <ListChecks className="text-violet-400" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text/90">Habit Tracker</h1>
            <p className="text-[10px] text-muted uppercase tracking-wider">Build your streaks</p>
          </div>
        </div>
      </div>

      {/* Add habit */}
      {isAdding ? (
        <div className="glass-panel p-5 space-y-4 border-violet-500/30">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg">New Habit</h3>
            <button onClick={() => { setIsAdding(false); setError(''); }} className="p-1 text-muted hover:text-text"><X size={18} /></button>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Habit name</label>
            <input
              type="text"
              value={newName}
              autoFocus
              onChange={e => { setNewName(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') addHabit(); }}
              placeholder="e.g. Drink water, Read 10 pages"
              className="input-field w-full"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Emoji (optional)</label>
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="text"
                value={newEmoji}
                onChange={e => setNewEmoji(lastEmoji(e.target.value))}
                placeholder="🙂"
                autoCapitalize="none"
                autoComplete="off"
                className="input-field w-16 text-center text-xl py-1.5"
              />
              {PRESET_EMOJIS.map(em => (
                <button
                  key={em}
                  onClick={() => setNewEmoji(em)}
                  className={`w-8 h-8 rounded-lg text-lg leading-none flex items-center justify-center transition-all ${newEmoji === em ? 'bg-violet-500/20 ring-1 ring-violet-500/50' : 'bg-text/5 hover:bg-text/10'}`}
                >
                  {em}
                </button>
              ))}
              {newEmoji && <button onClick={() => setNewEmoji('')} className="text-xs text-muted hover:text-text px-1">clear</button>}
            </div>
            <p className="text-[10px] text-muted">Tap the box and use your keyboard's emoji picker for any emoji.</p>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Colour</label>
            <div className="flex flex-wrap items-center gap-2">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setNewColor(c)}
                  className={`w-8 h-8 rounded-full transition-transform ${newColor === c ? 'ring-2 ring-offset-2 ring-offset-surface scale-110' : ''}`}
                  style={{ backgroundColor: c, boxShadow: newColor === c ? `0 0 0 2px ${c}` : undefined }}
                />
              ))}
              <label className="w-8 h-8 rounded-full border-2 border-dashed border-text/30 flex items-center justify-center cursor-pointer relative overflow-hidden" title="Custom colour">
                <span className="text-[9px] text-muted">+</span>
                <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
              </label>
              <span className="w-8 h-8 rounded-lg ml-1 border border-text/10" style={{ backgroundColor: newColor }} />
            </div>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button onClick={addHabit} className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-600 text-white font-bold transition-colors">Add Habit</button>
        </div>
      ) : (
        <button
          onClick={() => setIsAdding(true)}
          className="w-full py-4 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-violet-500/50 hover:text-violet-400 transition-all flex items-center justify-center"
        >
          <Plus size={20} className="mr-2" /> Add Habit
        </button>
      )}

      {habits.length === 0 ? (
        <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">
          No habits yet. Add one to start tracking your streaks.
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div className="flex p-1 bg-text/5 rounded-xl">
            {([['single', 'Single', ListChecks], ['weekly', 'Weekly', CalendarDays], ['yearly', 'Yearly', LayoutGrid]] as const).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === key ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
              >
                <Icon size={15} /> {label}
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
                    <ArrowUpDown size={14} /> {isReordering ? 'Done' : 'Reorder'}
                  </button>
                </div>
              )}
              {habits.map((habit, idx) => {
                const done = habit.completedDates.includes(todayKey);
                return (
                  <div key={habit.id} className="glass-panel p-4 flex items-center gap-4">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                    {editingId === habit.id ? (
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={editName}
                            autoFocus
                            onChange={e => { setEditName(e.target.value); setEditError(''); }}
                            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }}
                            className="input-field py-1.5 text-sm flex-1"
                          />
                          <button onClick={saveEdit} className="p-1.5 rounded-lg bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 shrink-0"><Check size={16} /></button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text shrink-0"><X size={16} /></button>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {PRESET_COLORS.map(c => (
                            <button
                              key={c}
                              onClick={() => setEditColor(c)}
                              className={`w-6 h-6 rounded-full transition-transform ${editColor === c ? 'scale-110' : ''}`}
                              style={{ backgroundColor: c, boxShadow: editColor === c ? `0 0 0 2px ${c}` : undefined }}
                            />
                          ))}
                          <label className="w-6 h-6 rounded-full border-2 border-dashed border-text/30 flex items-center justify-center cursor-pointer relative overflow-hidden" title="Custom colour">
                            <span className="text-[8px] text-muted">+</span>
                            <input type="color" value={editColor} onChange={e => setEditColor(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
                          </label>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <input
                            type="text"
                            value={editEmoji}
                            onChange={e => setEditEmoji(lastEmoji(e.target.value))}
                            placeholder="🙂"
                            autoCapitalize="none"
                            autoComplete="off"
                            className="input-field w-12 text-center text-lg py-1"
                          />
                          {PRESET_EMOJIS.map(em => (
                            <button
                              key={em}
                              onClick={() => setEditEmoji(em)}
                              className={`w-7 h-7 rounded-lg text-base leading-none flex items-center justify-center transition-all ${editEmoji === em ? 'bg-violet-500/20 ring-1 ring-violet-500/50' : 'bg-text/5 hover:bg-text/10'}`}
                            >
                              {em}
                            </button>
                          ))}
                          {editEmoji && <button onClick={() => setEditEmoji('')} className="text-xs text-muted hover:text-text px-1">clear</button>}
                        </div>
                        {editError && <p className="text-[10px] text-red-400">{editError}</p>}
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="font-bold text-text/90 truncate">{habit.emoji ? habit.emoji + ' ' : ''}{habit.name}</h4>
                          {!isReordering && (
                            <button onClick={() => startEdit(habit)} className="text-muted hover:text-text shrink-0 transition-colors" title="Edit name"><Pencil size={13} /></button>
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
                        <Tick done={done} color={habit.color} onClick={() => toggleDate(habit.id, todayKey)} label="Mark today" />
                        <button onClick={() => deleteHabit(habit.id)} className="text-rose-400 opacity-50 hover:opacity-100 p-1 hover:bg-rose-500/20 rounded transition-all shrink-0">
                          <Trash2 size={16} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* WEEKLY VIEW */}
          {tab === 'weekly' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <button onClick={() => setWeekOffset(o => o - 1)} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text"><ChevronLeft size={18} /></button>
                <span className="text-sm font-bold text-text/90">{weekLabel}</span>
                <button onClick={() => setWeekOffset(o => Math.min(0, o + 1))} disabled={weekOffset >= 0} className="p-1.5 rounded-lg bg-text/5 text-muted hover:text-text disabled:opacity-30"><ChevronRight size={18} /></button>
              </div>
              {habits.map(habit => (
                <div key={habit.id} className="glass-panel p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                    <h4 className="font-bold text-text/90 truncate flex-1">{habit.emoji ? habit.emoji + ' ' : ''}{habit.name}</h4>
                  </div>
                  <StreakRow habit={habit} />
                  <div className="grid grid-cols-7 gap-1.5">
                    {weekDays.map((d) => {
                      const key = toKey(d);
                      const done = habit.completedDates.includes(key);
                      const isToday = key === todayKey;
                      const future = d > new Date();
                      return (
                        <div key={key} className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] ${isToday ? 'text-text font-bold' : 'text-muted'}`}>{WEEKDAYS[d.getDay()]}</span>
                          <button
                            onClick={() => !future && toggleDate(habit.id, key)}
                            disabled={future}
                            className={`w-full aspect-square rounded-lg border flex items-center justify-center text-xs font-bold transition-all ${future ? 'opacity-30 cursor-default' : 'active:scale-90'} ${isToday ? 'ring-2 ring-offset-1 ring-offset-surface' : ''}`}
                            style={{
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
              <p className="text-center text-sm font-bold text-text/90">{year} Overview</p>
              {habits.map(habit => {
                const done = habit.completedDates.includes(todayKey);
                const set = new Set(habit.completedDates);
                return (
                  <div key={habit.id} className="glass-panel p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: habit.color }} />
                      <h4 className="font-bold text-text/90 truncate flex-1">{habit.emoji ? habit.emoji + ' ' : ''}{habit.name}</h4>
                      <Tick done={done} color={habit.color} size={32} onClick={() => toggleDate(habit.id, todayKey)} label="Mark today" />
                    </div>
                    <StreakRow habit={habit} />
                    <div className="overflow-x-auto custom-scrollbar pb-1" data-year-scroll>
                      <div style={{ width: weeksCount * STEP }}>
                        {/* Month labels */}
                        <div className="relative h-4 mb-1" style={{ width: weeksCount * STEP }}>
                          {monthMarks.map(m => (
                            <span key={m.label + m.col} className="absolute text-[9px] text-muted" style={{ left: m.col * STEP }}>{m.label}</span>
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
                    <p className="text-[10px] text-muted">Only today can be ticked here. Use Weekly to edit past days.</p>
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
