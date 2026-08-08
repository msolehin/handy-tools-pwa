import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, CalendarClock, Search } from 'lucide-react';
import { MAIN_TOOLS, SIDE_TOOLS, duitRayaLook } from '../lib/tools';
import { HorizonList } from './HorizonList';
import { useHorizon } from '../lib/useHorizon';

/**
 * The desktop shell around the tool column. The 24 tool pages are written for a 448px column and
 * stay exactly as they are — what a wide screen buys is not a wider form but a rail that reaches
 * every tool in one click, and the whole deadline horizon kept in view beside whatever you opened.
 *
 * Both are lg-only. Below that the phone layout is untouched.
 */

const RAIL_LINK = 'flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm transition-colors';

const RailGroup: React.FC<{ heading: string; tools: typeof MAIN_TOOLS }> = ({ heading, tools }) => (
  tools.length === 0 ? null : (
  <div>
    <p className="px-2.5 pb-1.5 pt-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted">
      {heading}
    </p>
    <ul>
      {tools.map((tool) => {
        const { Icon } = tool;
        // Same festive swap Home does — the rail must not still say Duit Raya in green
        // after the tool page switched to Angpao.
        const raya = tool.id === '/duit-raya' ? duitRayaLook() : null;
        const inner = (
          <>
            <span className={`rounded-lg p-1.5 ${raya?.iconBgClass ?? tool.iconBgClass}`}>
              {raya ? <span className="text-[15px] leading-none">{raya.emoji}</span> : <Icon size={15} />}
            </span>
            <span className="truncate">{raya?.title ?? tool.title}</span>
          </>
        );
        const idle = 'text-muted hover:bg-text/[0.04] hover:text-text';
        return (
          <li key={tool.id}>
            {/* One side tool points off-site; NavLink would try to route it. */}
            {tool.to.startsWith('http') ? (
              <a href={tool.to} target="_blank" rel="noopener noreferrer" className={`${RAIL_LINK} ${idle}`}>
                {inner}
              </a>
            ) : (
              <NavLink
                to={tool.to}
                className={({ isActive }) => `${RAIL_LINK} ${
                  isActive ? 'bg-text/[0.07] font-semibold text-text' : idle
                }`}
              >
                {inner}
              </NavLink>
            )}
          </li>
        );
      })}
    </ul>
  </div>
  )
);

export const ToolRail: React.FC = () => {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  // Description and category too, so "roadtax" finds Document Expiry and "duit" finds the money
  // tools — the names are Malay but what you remember about a tool often isn't its name.
  const match = (tool: typeof MAIN_TOOLS[number]) =>
    !q || `${tool.title} ${tool.desc} ${tool.category} ${tool.id === '/duit-raya' ? 'angpao raya' : ''}`
      .toLowerCase().includes(q);

  const main = MAIN_TOOLS.filter(match);
  const side = SIDE_TOOLS.filter(match);

  return (
    <nav
      aria-label="Tools"
      className="hidden w-60 shrink-0 flex-col overflow-hidden rounded-3xl border border-text/10 bg-surface/40 p-2.5 lg:flex"
    >
      <div className="relative mb-1.5">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari alat"
          aria-label="Cari alat"
          className="w-full rounded-xl border border-text/10 bg-background/60 py-2 pl-9 pr-3 text-sm text-text placeholder:text-muted focus:border-primary/50 focus:outline-none"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {!q && (
          <NavLink
            to="/app"
            end
            className={({ isActive }) => `${RAIL_LINK} ${
              isActive ? 'bg-text/[0.07] font-semibold text-text' : 'text-muted hover:bg-text/[0.04] hover:text-text'
            }`}
          >
            <span className="rounded-lg bg-primary/15 p-1.5 text-primary">
              <Home size={15} />
            </span>
            <span>Semua alat</span>
          </NavLink>
        )}

        <RailGroup heading="Simpan rekod" tools={main} />
        <RailGroup heading="Alat lain" tools={side} />

        {q && main.length + side.length === 0 && (
          <p className="px-2.5 py-6 text-sm leading-relaxed text-muted">
            Tiada alat sepadan “{query}”.
          </p>
        )}
      </div>
    </nav>
  );
};

export const HorizonPanel: React.FC = () => {
  const items = useHorizon();

  return (
    <aside
      aria-label="Tarikh akan datang"
      className="hidden w-72 shrink-0 flex-col overflow-hidden rounded-3xl border border-text/10 bg-surface/40 lg:flex"
    >
      <div className="flex items-center gap-2 border-b border-text/10 px-4 py-3.5">
        <CalendarClock size={16} className="text-primary" />
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          Yang tengah kejar
        </h2>
        {items.length > 0 && (
          <span className="ml-auto rounded-full bg-text/[0.07] px-2 py-0.5 text-[11px] font-bold text-text"
                style={{ fontVariantNumeric: 'tabular-nums' }}>
            {items.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2">
        <HorizonList items={items} />
      </div>
    </aside>
  );
};
