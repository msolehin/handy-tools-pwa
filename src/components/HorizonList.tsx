import React from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import { DEFAULT_TOOLS } from '../lib/tools';
import { byMonth, horizonTone, daysUntil, type HorizonItem } from '../lib/horizon';

/**
 * The deadline horizon, rendered once and shown in two places: the desktop side panel, and a sheet
 * on mobile where there is no room for a panel. Both are the same list — a phone user should not
 * get a lesser version of the thing, just a different way in to it.
 */

// The countdown carries the urgency, so it gets the colour — one toned pill per row reads faster
// than a dot and a coloured word competing for the same glance.
const TONE_PILL = {
  red: 'bg-red-500/15 text-red-500',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-500',
  emerald: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-500',
};

// The row borrows the tool's own icon and colour chip from the catalog, so a date in the panel
// looks like the tool it came from — same chip you clicked in the rail.
const TOOL_BY_ROUTE = new Map(DEFAULT_TOOLS.map((t) => [t.to, t]));

const MONTHS = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sept', 'Okt', 'Nov', 'Dis'];
const monthLabel = (month: string) => {
  const [year, m] = month.split('-');
  return `${MONTHS[Number(m) - 1]} ${year}`;
};

const HorizonRow: React.FC<{ item: HorizonItem; onPick?: () => void }> = ({ item, onPick }) => {
  const navigate = useNavigate();
  const days = daysUntil(item.date);
  const tone = horizonTone(days);
  const tool = TOOL_BY_ROUTE.get(item.to);
  const Icon = tool?.Icon ?? CalendarClock;

  return (
    <li>
      <button
        type="button"
        onClick={() => { navigate(item.to); onPick?.(); }}
        className="flex w-full items-center gap-2.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-text/[0.05]"
      >
        <span className={`shrink-0 rounded-lg p-1.5 ${tool?.iconBgClass ?? 'bg-primary/15 text-primary'}`}>
          <Icon size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-text">{item.label}</span>
          <span className="block truncate text-[11px] text-muted">
            {item.tool} · {Number(item.date.slice(8, 10))}hb
          </span>
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${TONE_PILL[tone]}`}
              style={{ fontVariantNumeric: 'tabular-nums' }}>
          {days < 0 ? `Lewat ${-days}h` : days === 0 ? 'Hari ni' : `${days}h`}
        </span>
      </button>
    </li>
  );
};

export const HorizonList: React.FC<{ items: HorizonItem[]; onPick?: () => void }> = ({ items, onPick }) => {
  const groups = byMonth(items);

  if (groups.length === 0) {
    return (
      <p className="px-2 py-6 text-sm leading-relaxed text-muted">
        Tiada tarikh akan datang lagi. Simpan satu rekod bertarikh — roadtax, warranty, servis —
        dan ia muncul di sini.
      </p>
    );
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.month} className="mb-2">
          <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
            {monthLabel(group.month)}
          </p>
          <ul>
            {group.items.map((item) => <HorizonRow key={item.key} item={item} onPick={onPick} />)}
          </ul>
        </div>
      ))}
    </>
  );
};
