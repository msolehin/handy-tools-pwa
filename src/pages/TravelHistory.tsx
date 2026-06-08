import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Globe, Plus, Trash2, Pencil, X, Calendar, MapPin, Plane, Star,
  Clock, Search, ArrowUpDown, Layers, TrendingUp, ZoomIn, ZoomOut, Maximize, Wallet, Map as MapIcon, ChevronUp, ChevronDown, Check, Backpack
} from 'lucide-react';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { feature } from 'topojson-client';
import worldTopo from 'world-atlas/countries-110m.json';

// Precompute the world map paths once (offline, no network needed)
const WORLD_FC: any = feature(worldTopo as any, (worldTopo as any).objects.countries);
const MAP_W = 800, MAP_H = 388;
const _mapPath = geoPath(geoEqualEarth().fitSize([MAP_W, MAP_H], WORLD_FC));
const COUNTRY_PATHS: { name: string; d: string }[] = WORLD_FC.features.map((f: any) => ({ name: f.properties.name, d: _mapPath(f) || '' }));
// Per-country path + bounding box, for drawing a single-country silhouette
const COUNTRY_BOX: Record<string, { d: string; box: [number, number, number, number] }> = {};
WORLD_FC.features.forEach((f: any) => {
  const d = _mapPath(f) || '';
  const b = _mapPath.bounds(f);
  COUNTRY_BOX[f.properties.name] = { d, box: [b[0][0], b[0][1], b[1][0] - b[0][0], b[1][1] - b[0][1]] };
});
// Map our country names to the world-atlas naming where they differ
const MAP_ALIAS: Record<string, string> = { 'United States': 'United States of America', 'Czech Republic': 'Czechia' };

// Faint silhouette of a country, used as a card background watermark
const CountryBg: React.FC<{ country: string }> = ({ country }) => {
  const c = COUNTRY_BOX[MAP_ALIAS[country] || country];
  if (!c || !c.d) return null;
  const [x, y, w, h] = c.box;
  const pad = Math.max(w, h) * 0.15;
  return (
    <svg
      viewBox={`${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute right-0 inset-y-0 w-2/3 text-cyan-400 opacity-[0.08] pointer-events-none"
      aria-hidden
    >
      <path d={c.d} fill="currentColor" />
    </svg>
  );
};

const WorldMap: React.FC<{ counts: Record<string, number>; focus?: { name: string; n: number } | null; highlight?: string | null }> = ({ counts, focus, highlight }) => {
  const maxCount = Object.values(counts).reduce((m, v) => Math.max(m, v), 1);
  const [t, setT] = useState({ k: 1, x: 0, y: 0 });
  const [smooth, setSmooth] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const ptrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinch = useRef<number | null>(null);

  // Animate-zoom to a country when asked
  useEffect(() => {
    if (!focus) return;
    const c = COUNTRY_BOX[focus.name];
    if (!c || !c.d) return;
    const [x, y, w, h] = c.box;
    const k = Math.min(10, Math.max(1.5, Math.min(MAP_W / (w * 2.4), MAP_H / (h * 2.4))));
    const cx = x + w / 2, cy = y + h / 2;
    setSmooth(true);
    setT({ k, x: MAP_W / 2 - cx * k, y: MAP_H / 2 - cy * k });
    const id = setTimeout(() => setSmooth(false), 550);
    return () => clearTimeout(id);
  }, [focus?.n]);

  const toView = (clientX: number, clientY: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { x: (clientX - r.left) / r.width * MAP_W, y: (clientY - r.top) / r.height * MAP_H };
  };
  const clampK = (k: number) => Math.min(10, Math.max(1, k));
  const zoomAt = (factor: number, vx: number, vy: number) => {
    setT(prev => {
      const k = clampK(prev.k * factor);
      const f = k / prev.k;
      return { k, x: vx - (vx - prev.x) * f, y: vy - (vy - prev.y) * f };
    });
  };
  const reset = () => setT({ k: 1, x: 0, y: 0 });

  // Native non-passive wheel listener so we can preventDefault (page won't scroll while zooming)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = toView(e.clientX, e.clientY);
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, v.x, v.y);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    setSmooth(false); // dragging should be immediate, not animated
    (e.target as Element).setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    const prevPos = ptrs.current.get(e.pointerId)!;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = Array.from(ptrs.current.values());
    if (pts.length >= 2) {
      const [a, b] = pts;
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current != null && pinch.current > 0) {
        const mid = toView((a.x + b.x) / 2, (a.y + b.y) / 2);
        zoomAt(dist / pinch.current, mid.x, mid.y);
      }
      pinch.current = dist;
    } else if (pts.length === 1 && t.k > 1) {
      const r = svgRef.current!.getBoundingClientRect();
      const dx = (e.clientX - prevPos.x) / r.width * MAP_W;
      const dy = (e.clientY - prevPos.y) / r.height * MAP_H;
      setT(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    }
  };
  const endPtr = (e: React.PointerEvent) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size < 2) pinch.current = null;
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-black/10">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${MAP_W} ${MAP_H}`}
        className="w-full h-auto select-none block"
        style={{ touchAction: t.k > 1 ? 'none' : 'pan-y' }}
        role="img"
        aria-label="Visited countries map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPtr}
        onPointerCancel={endPtr}
        onPointerLeave={endPtr}
      >
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`} style={{ transition: smooth ? 'transform 0.5s ease' : 'none' }}>
          {COUNTRY_PATHS.map(c => {
            const n = counts[c.name] || 0;
            // Heatmap: more trips → darker. 1 trip starts mid, scales up to full at the max.
            const intensity = n <= 0 ? 0 : Math.min(1, 0.45 + ((n - 1) / Math.max(1, maxCount - 1)) * 0.55);
            return (
              <path
                key={c.name}
                d={c.d}
                fill={n > 0 ? 'rgb(16 185 129)' : 'rgba(148,163,184,0.15)'}
                fillOpacity={n > 0 ? intensity : 1}
                stroke="rgba(148,163,184,0.3)"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              >
                <title>{c.name}{n > 0 ? ` · ${n} trip${n > 1 ? 's' : ''}` : ''}</title>
              </path>
            );
          })}
          {highlight && COUNTRY_BOX[highlight]?.d && (
            <path
              d={COUNTRY_BOX[highlight].d}
              fill="rgb(34 211 238)"
              fillOpacity={0.35}
              stroke="rgb(34 211 238)"
              strokeWidth={1.6}
              vectorEffect="non-scaling-stroke"
              style={{ filter: 'drop-shadow(0 0 3px rgb(34 211 238))' }}
              pointerEvents="none"
            />
          )}
        </g>
      </svg>
      <div className="absolute bottom-1.5 right-1.5 flex flex-col gap-1">
        <button onClick={() => zoomAt(1.5, MAP_W / 2, MAP_H / 2)} className="w-7 h-7 rounded-lg bg-surface/90 border border-text/10 text-text flex items-center justify-center hover:bg-surface active:scale-90"><ZoomIn size={15} /></button>
        <button onClick={() => zoomAt(1 / 1.5, MAP_W / 2, MAP_H / 2)} className="w-7 h-7 rounded-lg bg-surface/90 border border-text/10 text-text flex items-center justify-center hover:bg-surface active:scale-90"><ZoomOut size={15} /></button>
        <button onClick={reset} className="w-7 h-7 rounded-lg bg-surface/90 border border-text/10 text-text flex items-center justify-center hover:bg-surface active:scale-90"><Maximize size={14} /></button>
      </div>
      {maxCount > 1 && (
        <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 bg-surface/80 rounded-lg px-2 py-1 text-[9px] text-muted font-bold">
          <span>1</span>
          {[0.45, 0.65, 0.85, 1].map((o, i) => <span key={i} className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'rgb(16 185 129)', opacity: o }} />)}
          <span>{maxCount}+ trips</span>
        </div>
      )}
    </div>
  );
};

interface ItinActivity { id: string; time?: string; text: string; }
interface ItinDay { id: string; label: string; timed: boolean; activities: ItinActivity[]; }
interface ChecklistItem { id: string; category: string; text: string; done: boolean; }

const DEFAULT_CHECKLIST: Record<string, string[]> = {
  Documents: ['Passport', 'Visa', 'ID card', 'Flight tickets', 'Hotel booking', 'Travel insurance'],
  Money: ['Cash', 'Credit / debit cards', 'Local currency'],
  Clothing: ['Shirts', 'Pants', 'Underwear', 'Socks', 'Jacket', 'Sleepwear', 'Comfortable shoes'],
  Toiletries: ['Toothbrush', 'Toothpaste', 'Shampoo', 'Soap', 'Deodorant', 'Sunscreen', 'Skincare'],
  Electronics: ['Phone', 'Charger', 'Power bank', 'Travel adapter', 'Earphones'],
  Health: ['Medication', 'First aid kit', 'Hand sanitizer', 'Face masks'],
  Essentials: ['Reusable water bottle', 'Umbrella', 'Snacks', 'Travel pillow'],
};

interface Trip {
  id: string;
  country: string;
  flag: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  budget: number;
  categories?: Record<string, number>;
  bestLocation?: string;
  cities?: string[];
  notes?: string;
  itinerary?: ItinDay[];
  checklist?: ChecklistItem[];
}

const STORAGE_KEY = 'travel_history_data';
const DEFAULT_CATS = ['Transport', 'Hotel', 'Food', 'Shopping', 'Entertainment', 'Others'];
const TOTAL_COUNTRIES = 195; // recognised countries in the world

const COUNTRIES: { name: string; code: string }[] = [
  { name: 'Malaysia', code: 'MY' }, { name: 'Singapore', code: 'SG' }, { name: 'Thailand', code: 'TH' }, { name: 'Indonesia', code: 'ID' },
  { name: 'Vietnam', code: 'VN' }, { name: 'Philippines', code: 'PH' }, { name: 'Cambodia', code: 'KH' }, { name: 'Laos', code: 'LA' },
  { name: 'Myanmar', code: 'MM' }, { name: 'Brunei', code: 'BN' }, { name: 'Japan', code: 'JP' }, { name: 'South Korea', code: 'KR' },
  { name: 'China', code: 'CN' }, { name: 'Hong Kong', code: 'HK' }, { name: 'Taiwan', code: 'TW' }, { name: 'Macau', code: 'MO' },
  { name: 'India', code: 'IN' }, { name: 'Sri Lanka', code: 'LK' }, { name: 'Nepal', code: 'NP' }, { name: 'Bangladesh', code: 'BD' },
  { name: 'Pakistan', code: 'PK' }, { name: 'Maldives', code: 'MV' }, { name: 'Bhutan', code: 'BT' }, { name: 'United Arab Emirates', code: 'AE' },
  { name: 'Saudi Arabia', code: 'SA' }, { name: 'Qatar', code: 'QA' }, { name: 'Oman', code: 'OM' }, { name: 'Turkey', code: 'TR' },
  { name: 'Egypt', code: 'EG' }, { name: 'Morocco', code: 'MA' }, { name: 'South Africa', code: 'ZA' }, { name: 'Kenya', code: 'KE' },
  { name: 'Mauritius', code: 'MU' }, { name: 'Australia', code: 'AU' }, { name: 'New Zealand', code: 'NZ' }, { name: 'Fiji', code: 'FJ' },
  { name: 'United States', code: 'US' }, { name: 'Canada', code: 'CA' }, { name: 'Mexico', code: 'MX' }, { name: 'Brazil', code: 'BR' },
  { name: 'Argentina', code: 'AR' }, { name: 'Peru', code: 'PE' }, { name: 'United Kingdom', code: 'GB' }, { name: 'Ireland', code: 'IE' },
  { name: 'France', code: 'FR' }, { name: 'Germany', code: 'DE' }, { name: 'Spain', code: 'ES' }, { name: 'Portugal', code: 'PT' },
  { name: 'Italy', code: 'IT' }, { name: 'Switzerland', code: 'CH' }, { name: 'Netherlands', code: 'NL' }, { name: 'Belgium', code: 'BE' },
  { name: 'Austria', code: 'AT' }, { name: 'Greece', code: 'GR' }, { name: 'Czech Republic', code: 'CZ' }, { name: 'Poland', code: 'PL' },
  { name: 'Hungary', code: 'HU' }, { name: 'Sweden', code: 'SE' }, { name: 'Norway', code: 'NO' }, { name: 'Denmark', code: 'DK' },
  { name: 'Finland', code: 'FI' }, { name: 'Iceland', code: 'IS' }, { name: 'Croatia', code: 'HR' }, { name: 'Russia', code: 'RU' },
];

const flagOf = (code: string) => code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad2 = (n: number) => String(n).padStart(2, '0');
const dateKey = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const generateId = () => Math.random().toString(36).substring(2, 9);
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 });
const longDate = (key: string) => { if (!key) return ''; const [y, m, d] = key.split('-').map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const yearOf = (key: string) => key.slice(0, 4);

// Dev-only: rich sample data to preview the tool
const makeSampleTrips = (): Trip[] => {
  const flag = (name: string) => { const c = COUNTRIES.find(x => x.name === name); return c ? flagOf(c.code) : '🌍'; };
  const mk = (country: string, year: number, month: number, day: number, len: number, budget: number, extra: Partial<Trip> = {}): Trip => {
    const sd = new Date(year, month - 1, day);
    const ed = new Date(year, month - 1, day + len);
    return { id: generateId(), country, flag: flag(country), title: `${country} ${year}`, startDate: dateKey(sd), endDate: dateKey(ed), budget, ...extra };
  };
  const japanItin: ItinDay[] = [
    { id: generateId(), label: 'Day 1', timed: true, activities: [
      { id: generateId(), time: '09:00', text: 'Arrive Narita, train to Tokyo' },
      { id: generateId(), time: '13:00', text: 'Lunch at Tsukiji Market' },
      { id: generateId(), time: '19:00', text: 'Shibuya crossing & dinner' },
    ] },
    { id: generateId(), label: 'Day 2', timed: false, activities: [
      { id: generateId(), text: 'Senso-ji Temple' },
      { id: generateId(), text: 'Akihabara shopping' },
      { id: generateId(), text: 'TeamLab Planets' },
    ] },
  ];
  return [
    mk('Japan', 2025, 3, 1, 9, 4250, { categories: { Transport: 1200, Hotel: 1500, Food: 900, Shopping: 650 }, bestLocation: 'Osaka Castle', cities: ['Tokyo', 'Osaka', 'Kyoto'], notes: 'Sakura season', itinerary: japanItin }),
    mk('Japan', 2024, 11, 10, 7, 3900, { bestLocation: 'Mount Fuji', cities: ['Tokyo', 'Hakone'] }),
    mk('Japan', 2023, 4, 5, 8, 3600, { cities: ['Kyoto', 'Nara'] }),
    mk('Thailand', 2026, 1, 12, 5, 1800, { categories: { Transport: 400, Hotel: 600, Food: 500, Shopping: 300 }, bestLocation: 'Grand Palace', cities: ['Bangkok'], notes: 'Food trip' }),
    mk('Thailand', 2025, 6, 20, 4, 1500, { cities: ['Phuket'] }),
    mk('Thailand', 2024, 2, 14, 6, 2100, { cities: ['Chiang Mai'] }),
    mk('Thailand', 2023, 9, 3, 5, 1700, { cities: ['Krabi'] }),
    mk('Indonesia', 2025, 8, 8, 6, 2400, { bestLocation: 'Uluwatu', cities: ['Bali'], notes: 'Beach & villas' }),
    mk('Indonesia', 2023, 12, 22, 7, 2600, { cities: ['Jakarta', 'Bandung'] }),
    mk('South Korea', 2025, 10, 2, 7, 3800, { categories: { Transport: 1000, Hotel: 1300, Food: 800, Shopping: 700 }, bestLocation: 'Gyeongbokgung', cities: ['Seoul', 'Busan'], notes: 'Autumn leaves' }),
    mk('South Korea', 2022, 5, 18, 6, 3200, { cities: ['Seoul'] }),
    mk('Singapore', 2024, 7, 1, 3, 1600, { bestLocation: 'Gardens by the Bay', cities: ['Singapore'] }),
    mk('Vietnam', 2024, 3, 9, 5, 1400, { bestLocation: 'Ha Long Bay', cities: ['Hanoi', 'Ha Long'] }),
    mk('Australia', 2023, 1, 15, 10, 7800, { categories: { Transport: 2500, Hotel: 2800, Food: 1500, Shopping: 1000 }, bestLocation: 'Sydney Opera House', cities: ['Sydney', 'Melbourne'], notes: 'Summer trip' }),
    mk('United Kingdom', 2022, 8, 5, 9, 8200, { bestLocation: 'Tower Bridge', cities: ['London', 'Edinburgh'] }),
    mk('France', 2019, 6, 12, 8, 7400, { bestLocation: 'Eiffel Tower', cities: ['Paris', 'Nice'], notes: 'Honeymoon' }),
    mk('Turkey', 2023, 10, 20, 7, 5200, { bestLocation: 'Cappadocia', cities: ['Istanbul', 'Cappadocia'], notes: 'Hot air balloon' }),
    mk('Maldives', 2024, 12, 5, 5, 6800, { bestLocation: 'Overwater villa', cities: ['Malé'] }),
    mk('China', 2018, 9, 1, 8, 4100, { bestLocation: 'Great Wall', cities: ['Beijing', 'Shanghai'] }),
    mk('Egypt', 2021, 11, 3, 9, 6100, { bestLocation: 'Pyramids of Giza', cities: ['Cairo', 'Luxor'] }),
  ];
};

const TravelHistory: React.FC = () => {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [tab, setTab] = useState<'dashboard' | 'trips' | 'timeline'>('dashboard');
  const [mapFocus, setMapFocus] = useState<{ name: string; n: number } | null>(null);
  const [focusedCountry, setFocusedCountry] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = (m: string) => { setToast(m); if (toastTimer.current) clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2400); };
  const mapPanelRef = useRef<HTMLDivElement>(null);
  const focusOnMap = (country: string) => {
    const mapName = MAP_ALIAS[country] || country;
    setFocusedCountry(country);
    if (!COUNTRY_BOX[mapName] || !COUNTRY_BOX[mapName].d) {
      showToast(`📍 ${country} is too small to show on the map`);
      return;
    }
    setMapFocus(prev => ({ name: mapName, n: (prev?.n || 0) + 1 }));
    mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (Array.isArray(p)) setTrips(p.map((t: any) => ({ ...t, itinerary: Array.isArray(t.itinerary) ? t.itinerary : undefined })));
      } catch (e) {}
    }
    setIsLoaded(true);
  }, []);
  useEffect(() => { if (isLoaded) localStorage.setItem(STORAGE_KEY, JSON.stringify(trips)); }, [trips, isLoaded]);

  // --- Trip form (basic info only) ---
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [fCountry, setFCountry] = useState('');
  const [fFlag, setFFlag] = useState('');
  const [fTitle, setFTitle] = useState('');
  const [fStart, setFStart] = useState('');
  const [fEnd, setFEnd] = useState('');
  const [fBest, setFBest] = useState('');
  const [fCities, setFCities] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [countrySearch, setCountrySearch] = useState('');
  const [error, setError] = useState('');

  const resetForm = () => {
    setEditId(null); setFCountry(''); setFFlag(''); setFTitle(''); setFStart(''); setFEnd('');
    setFBest(''); setFCities(''); setFNotes(''); setCountrySearch(''); setError('');
  };
  const openAdd = () => { resetForm(); setShowForm(true); };
  const openEdit = (t: Trip) => {
    setEditId(t.id); setFCountry(t.country); setFFlag(t.flag); setFTitle(t.title);
    setFStart(t.startDate); setFEnd(t.endDate);
    setFBest(t.bestLocation || ''); setFCities((t.cities || []).join(', ')); setFNotes(t.notes || '');
    setCountrySearch(''); setError(''); setShowForm(true);
  };

  const pickCountry = (name: string, flag: string) => { setFCountry(name); setFFlag(flag); setCountrySearch(''); };

  const saveTrip = () => {
    if (!fCountry.trim()) { setError('Pick a country'); return; }
    if (!fStart || !fEnd) { setError('Add the date range'); return; }
    if (fEnd < fStart) { setError('End date is before start date'); return; }
    const title = fTitle.trim() || `${fCountry} ${yearOf(fStart)}`;
    const cities = fCities.split(',').map(s => s.trim()).filter(Boolean);
    const existing = editId ? trips.find(t => t.id === editId) : undefined;
    const trip: Trip = {
      id: editId || generateId(),
      country: fCountry.trim(), flag: fFlag, title,
      startDate: fStart, endDate: fEnd,
      bestLocation: fBest.trim() || undefined,
      cities: cities.length ? cities : undefined,
      notes: fNotes.trim() || undefined,
      // Preserve expenses + itinerary + checklist, which are managed separately on the Trips tab
      budget: existing?.budget ?? 0,
      categories: existing?.categories,
      itinerary: existing?.itinerary,
      checklist: existing?.checklist,
    };
    setTrips(prev => editId ? prev.map(t => t.id === editId ? trip : t) : [...prev, trip]);
    setShowForm(false);
  };
  const deleteTrip = (id: string) => { if (window.confirm('Delete this trip?')) setTrips(prev => prev.filter(t => t.id !== id)); };

  // --- Manage Expenses modal ---
  const blankDetail = () => DEFAULT_CATS.map(c => ({ name: c, amount: '' }));
  const [expTrip, setExpTrip] = useState<Trip | null>(null);
  const [expMode, setExpMode] = useState<'lump' | 'detailed'>('lump');
  const [expLump, setExpLump] = useState('');
  const [expDetail, setExpDetail] = useState<{ name: string; amount: string }[]>(blankDetail());
  const openExpenses = (t: Trip) => {
    setExpTrip(t);
    if (t.categories && Object.keys(t.categories).length) {
      setExpMode('detailed');
      const known = DEFAULT_CATS.map(c => ({ name: c, amount: t.categories![c] ? String(t.categories![c]) : '' }));
      const extra = Object.keys(t.categories).filter(k => !DEFAULT_CATS.includes(k)).map(k => ({ name: k, amount: String(t.categories![k]) }));
      setExpDetail([...known, ...extra]);
      setExpLump('');
    } else {
      setExpMode('lump'); setExpLump(t.budget ? String(t.budget) : ''); setExpDetail(blankDetail());
    }
  };
  const saveExpenses = () => {
    if (!expTrip) return;
    let budget = 0;
    let categories: Record<string, number> | undefined;
    if (expMode === 'detailed') {
      categories = {};
      expDetail.forEach(d => { const a = parseFloat(d.amount); if (d.name.trim() && a > 0) { categories![d.name.trim()] = a; budget += a; } });
      if (Object.keys(categories).length === 0) categories = undefined;
    } else {
      budget = parseFloat(expLump) || 0;
    }
    setTrips(prev => prev.map(t => t.id === expTrip.id ? { ...t, budget, categories } : t));
    setExpTrip(null);
  };

  // --- Manage Itinerary modal ---
  const [itinTripId, setItinTripId] = useState<string | null>(null);
  const itinTrip = trips.find(t => t.id === itinTripId) || null;
  const [draftAct, setDraftAct] = useState<Record<string, { text: string; time: string }>>({});
  const updateDay = (dayId: string, fn: (d: ItinDay) => ItinDay) =>
    setTrips(prev => prev.map(t => t.id === itinTripId ? { ...t, itinerary: (t.itinerary || []).map(d => d.id === dayId ? fn(d) : d) } : t));
  const addDay = () => setTrips(prev => prev.map(t => t.id === itinTripId
    ? { ...t, itinerary: [...(t.itinerary || []), { id: generateId(), label: `Day ${(t.itinerary?.length || 0) + 1}`, timed: false, activities: [] }] } : t));
  const deleteDay = (dayId: string) => setTrips(prev => prev.map(t => t.id === itinTripId ? { ...t, itinerary: (t.itinerary || []).filter(d => d.id !== dayId) } : t));
  const addActivity = (day: ItinDay) => {
    const d = draftAct[day.id] || { text: '', time: '' };
    if (!d.text.trim()) return;
    updateDay(day.id, dd => ({ ...dd, activities: [...dd.activities, { id: generateId(), text: d.text.trim(), time: dd.timed && d.time ? d.time : undefined }] }));
    setDraftAct(prev => ({ ...prev, [day.id]: { text: '', time: '' } }));
  };
  const deleteActivity = (dayId: string, actId: string) => updateDay(dayId, d => ({ ...d, activities: d.activities.filter(a => a.id !== actId) }));
  const moveActivity = (dayId: string, idx: number, dir: -1 | 1) => updateDay(dayId, d => {
    const j = idx + dir; if (j < 0 || j >= d.activities.length) return d;
    const arr = [...d.activities]; [arr[idx], arr[j]] = [arr[j], arr[idx]]; return { ...d, activities: arr };
  });

  // --- Manage Checklist modal ---
  const [checkTripId, setCheckTripId] = useState<string | null>(null);
  const checkTrip = trips.find(t => t.id === checkTripId) || null;
  const [checkExtraCats, setCheckExtraCats] = useState<string[]>([]);
  const [checkDraft, setCheckDraft] = useState<Record<string, string>>({});
  const [newCheckCat, setNewCheckCat] = useState('');
  const openChecklist = (id: string) => { setCheckTripId(id); setCheckExtraCats([]); setCheckDraft({}); setNewCheckCat(''); };
  const updateChecklist = (fn: (list: ChecklistItem[]) => ChecklistItem[]) =>
    setTrips(prev => prev.map(t => t.id === checkTripId ? { ...t, checklist: fn(t.checklist || []) } : t));
  const loadDefaultChecklist = () => {
    const add: ChecklistItem[] = [];
    Object.entries(DEFAULT_CHECKLIST).forEach(([cat, arr]) => arr.forEach(text => add.push({ id: generateId(), category: cat, text, done: false })));
    updateChecklist(list => [...list, ...add.filter(i => !list.some(x => x.category === i.category && x.text.toLowerCase() === i.text.toLowerCase()))]);
  };
  const addCheckItem = (cat: string) => {
    const text = (checkDraft[cat] || '').trim();
    if (!text) return;
    updateChecklist(list => [...list, { id: generateId(), category: cat, text, done: false }]);
    setCheckDraft(prev => ({ ...prev, [cat]: '' }));
  };
  const toggleCheckItem = (id: string) => updateChecklist(list => list.map(i => i.id === id ? { ...i, done: !i.done } : i));
  const deleteCheckItem = (id: string) => updateChecklist(list => list.filter(i => i.id !== id));
  const addCheckCategory = () => { const c = newCheckCat.trim(); if (c && !checkExtraCats.includes(c)) setCheckExtraCats(prev => [...prev, c]); setNewCheckCat(''); };
  const deleteCheckCategory = (cat: string) => {
    const count = (checkTrip?.checklist || []).filter(i => i.category === cat).length;
    if (count > 0 && !window.confirm(`Delete "${cat}" and its ${count} item${count > 1 ? 's' : ''}?`)) return;
    updateChecklist(list => list.filter(i => i.category !== cat));
    setCheckExtraCats(prev => prev.filter(c => c !== cat));
  };
  const clearChecklist = () => { if (window.confirm('Clear the whole packing list?')) { updateChecklist(() => []); setCheckExtraCats([]); } };

  // --- Stats ---
  const uniqueCountries = Array.from(new Set(trips.map(t => t.country)));
  const totalSpending = trips.reduce((s, t) => s + t.budget, 0);
  const sortedByDate = [...trips].sort((a, b) => b.startDate.localeCompare(a.startDate));
  const lastTrip = sortedByDate[0];
  const highest = trips.length ? trips.reduce((m, t) => t.budget > m.budget ? t : m) : null;
  const cheapest = trips.filter(t => t.budget > 0).reduce<Trip | null>((m, t) => !m || t.budget < m.budget ? t : m, null);
  const countryCounts = uniqueCountries.map(c => ({ country: c, flag: trips.find(t => t.country === c)?.flag || '', count: trips.filter(t => t.country === c).length, total: trips.filter(t => t.country === c).reduce((s, t) => s + t.budget, 0) }));
  const mostVisited = countryCounts.length ? countryCounts.reduce((m, c) => c.count > m.count ? c : m) : null;

  // --- Listing ---
  const [sort, setSort] = useState<'latest' | 'oldest' | 'highest' | 'lowest'>('latest');
  const [groupBy, setGroupBy] = useState<'none' | 'country' | 'year'>('none');
  const sortedTrips = [...trips].sort((a, b) => {
    if (sort === 'latest') return b.startDate.localeCompare(a.startDate);
    if (sort === 'oldest') return a.startDate.localeCompare(b.startDate);
    if (sort === 'highest') return b.budget - a.budget;
    return a.budget - b.budget;
  });

  const TripCard = ({ t }: { t: Trip }) => {
    const [showItin, setShowItin] = useState(false);
    const days = t.itinerary || [];
    return (
    <div className="glass-panel p-4 relative overflow-hidden">
      <CountryBg country={t.country} />
      <div className="relative z-10 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-bold text-text/90 truncate">{t.flag} {t.title}</h4>
          <p className="text-[11px] text-muted flex items-center gap-1 mt-0.5"><Calendar size={11} /> {longDate(t.startDate)} – {longDate(t.endDate)}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => openEdit(t)} className="text-muted hover:text-text p-1"><Pencil size={14} /></button>
          <button onClick={() => deleteTrip(t.id)} className="text-rose-400 opacity-60 hover:opacity-100 p-1"><Trash2 size={14} /></button>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs">
        {t.budget > 0 && <span className="font-mono font-bold text-cyan-400">RM{fmt(t.budget)}</span>}
        {t.bestLocation && <span className="text-muted flex items-center gap-1"><Star size={12} /> {t.bestLocation}</span>}
        {t.checklist && t.checklist.length > 0 && <span className="text-muted flex items-center gap-1"><Backpack size={12} /> {t.checklist.filter(i => i.done).length}/{t.checklist.length}</span>}
      </div>
      {t.categories && (
        <div className="flex flex-wrap gap-1">
          {Object.entries(t.categories).map(([k, v]) => (
            <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-text/5 text-muted">{k} RM{fmt(v)}</span>
          ))}
        </div>
      )}
      {t.cities && t.cities.length > 0 && (
        <p className="text-[11px] text-muted flex items-center gap-1"><MapPin size={11} /> {t.cities.join(' · ')}</p>
      )}
      {t.notes && <p className="text-xs text-text/70 italic">“{t.notes}”</p>}

      {/* Collapsible itinerary timeline */}
      {days.length > 0 && (
        <div>
          <button onClick={() => setShowItin(s => !s)} className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
            <MapIcon size={13} /> Itinerary · {days.length} day{days.length > 1 ? 's' : ''}
            <ChevronDown size={14} className={`transition-transform ${showItin ? 'rotate-180' : ''}`} />
          </button>
          {showItin && (
            <div className="mt-2 space-y-3">
              {days.map(day => {
                const acts = day.timed ? [...day.activities].sort((a, b) => (a.time || '').localeCompare(b.time || '')) : day.activities;
                return (
                  <div key={day.id}>
                    <p className="text-[11px] font-bold text-text/80 mb-1">{day.label}</p>
                    <div className="border-l-2 border-cyan-500/30 ml-1 pl-3 space-y-1.5">
                      {acts.length === 0 ? (
                        <p className="text-[11px] text-muted">No activities</p>
                      ) : acts.map(a => (
                        <div key={a.id} className="relative">
                          <span className="absolute -left-[15.5px] top-1.5 w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          <p className="text-xs text-text/80 leading-snug">
                            {day.timed && a.time && <span className="font-mono text-cyan-400 mr-1.5">{a.time}</span>}{a.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1.5 pt-1">
        <button onClick={() => openExpenses(t)} className="flex-1 py-2 rounded-lg bg-text/5 text-[11px] font-bold text-text/80 hover:bg-text/10 flex items-center justify-center gap-1"><Wallet size={13} /> Expenses</button>
        <button onClick={() => setItinTripId(t.id)} className="flex-1 py-2 rounded-lg bg-text/5 text-[11px] font-bold text-text/80 hover:bg-text/10 flex items-center justify-center gap-1"><MapIcon size={13} /> Itinerary</button>
        <button onClick={() => openChecklist(t.id)} className="flex-1 py-2 rounded-lg bg-text/5 text-[11px] font-bold text-text/80 hover:bg-text/10 flex items-center justify-center gap-1"><Backpack size={13} /> Packing</button>
      </div>
      </div>
    </div>
    );
  };

  const filteredCountries = COUNTRIES.filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()));

  return (
    <div className="max-w-md mx-auto p-4 pb-24 space-y-5 animate-fade-in">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-surface border border-text/10 shadow-2xl text-sm font-bold text-text text-center animate-fade-in pointer-events-none max-w-[80%]">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-cyan-500/20 rounded-xl"><Globe className="text-cyan-400" size={26} /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-text/90">My Travel History</h1>
            <p className="text-[10px] text-muted uppercase tracking-wider">Where have I been?</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-1 p-1 bg-text/5 rounded-xl">
        {([['dashboard', 'Dashboard', Globe], ['trips', 'Trips', Plane], ['timeline', 'Timeline', Clock]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)} className={`py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${tab === key ? 'bg-surface text-cyan-400 shadow-sm' : 'text-muted hover:text-text'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {trips.length === 0 ? (
        <div className="text-center p-8 text-muted text-sm border border-dashed border-text/10 rounded-2xl">No trips recorded yet. Add your first trip below!</div>
      ) : tab === 'dashboard' ? (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="glass-panel p-3 text-center"><p className="text-[9px] font-bold text-muted uppercase">Countries</p><p className="text-lg font-black text-cyan-400 mt-1">{uniqueCountries.length}</p></div>
            <div className="glass-panel p-3 text-center"><p className="text-[9px] font-bold text-muted uppercase">Trips</p><p className="text-lg font-black text-cyan-400 mt-1">{trips.length}</p></div>
            <div className="glass-panel p-3 text-center"><p className="text-[9px] font-bold text-muted uppercase">Spent</p><p className="text-sm font-black text-cyan-400 font-mono mt-1.5">RM{fmt(totalSpending)}</p></div>
          </div>

          {/* Visited countries */}
          <div ref={mapPanelRef} className="glass-panel p-4 space-y-3 scroll-mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm flex items-center gap-2"><MapPin size={16} className="text-cyan-400" /> Countries Visited</h3>
              <span className="text-xs font-bold text-cyan-400">{uniqueCountries.length} <span className="text-muted font-normal">/ {TOTAL_COUNTRIES}</span></span>
            </div>
            <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full" style={{ width: `${Math.min(100, (uniqueCountries.length / TOTAL_COUNTRIES) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-muted text-right">{((uniqueCountries.length / TOTAL_COUNTRIES) * 100).toFixed(1)}% of the world explored</p>
            <div className="-mx-1">
              <WorldMap counts={Object.fromEntries(countryCounts.map(c => [MAP_ALIAS[c.country] || c.country, c.count]))} focus={mapFocus} highlight={focusedCountry ? (MAP_ALIAS[focusedCountry] || focusedCountry) : null} />
            </div>
            <div className="flex flex-wrap gap-2">
              {(() => {
                const maxVisits = countryCounts.reduce((m, c) => Math.max(m, c.count), 1);
                return countryCounts.slice().sort((a, b) => b.count - a.count).map(c => {
                  const f = (c.count - 1) / Math.max(1, maxVisits - 1); // 0..1
                  return (
                    <button
                      key={c.country}
                      onClick={() => focusOnMap(c.country)}
                      title={`Show ${c.country} on the map`}
                      className={`px-2.5 py-1.5 rounded-xl border text-xs font-medium flex items-center gap-1.5 transition-transform active:scale-95 hover:brightness-110 ${focusedCountry === c.country ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-surface' : ''}`}
                      style={{ backgroundColor: `rgba(16,185,129,${0.1 + f * 0.5})`, borderColor: `rgba(16,185,129,${0.25 + f * 0.45})` }}
                    >
                      <span className="text-base leading-none">{c.flag}</span> {c.country}{c.count > 1 && <span className="font-black text-text">×{c.count}</span>}
                    </button>
                  );
                });
              })()}
            </div>
            <p className="text-[10px] text-muted">Very small countries may not show on the map — see the list above.</p>
          </div>

          {/* Highlights */}
          <div className="grid grid-cols-2 gap-3">
            {mostVisited && (
              <div className="glass-panel p-3"><p className="text-[9px] font-bold text-muted uppercase flex items-center gap-1"><TrendingUp size={11} /> Most visited</p><p className="text-sm font-bold mt-1">{mostVisited.flag} {mostVisited.country}</p><p className="text-[10px] text-muted">{mostVisited.count} trip{mostVisited.count > 1 ? 's' : ''}</p></div>
            )}
            {lastTrip && (
              <div className="glass-panel p-3"><p className="text-[9px] font-bold text-muted uppercase flex items-center gap-1"><Clock size={11} /> Last trip</p><p className="text-sm font-bold mt-1">{lastTrip.flag} {lastTrip.country}</p><p className="text-[10px] text-muted">{longDate(lastTrip.startDate)}</p></div>
            )}
            {highest && (
              <div className="glass-panel p-3"><p className="text-[9px] font-bold text-muted uppercase">Highest budget</p><p className="text-sm font-bold mt-1">{highest.flag} {highest.title}</p><p className="text-[10px] text-cyan-400 font-mono">RM{fmt(highest.budget)}</p></div>
            )}
            {cheapest && (
              <div className="glass-panel p-3"><p className="text-[9px] font-bold text-muted uppercase">Cheapest trip</p><p className="text-sm font-bold mt-1">{cheapest.flag} {cheapest.title}</p><p className="text-[10px] text-emerald-400 font-mono">RM{fmt(cheapest.budget)}</p></div>
            )}
          </div>
        </div>
      ) : tab === 'trips' ? (
        <div className="space-y-3">
          {/* Sort + group */}
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <ArrowUpDown size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <select value={sort} onChange={e => setSort(e.target.value as any)} className="input-field w-full pl-8 py-2 text-sm appearance-none">
                <option value="latest">Latest</option>
                <option value="oldest">Oldest</option>
                <option value="highest">Highest Budget</option>
                <option value="lowest">Lowest Budget</option>
              </select>
            </div>
            <div className="flex-1 relative">
              <Layers size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
              <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} className="input-field w-full pl-8 py-2 text-sm appearance-none">
                <option value="none">No grouping</option>
                <option value="country">Group: Country</option>
                <option value="year">Group: Year</option>
              </select>
            </div>
          </div>
  {/* Add trip button */}
      <button onClick={openAdd} className="w-full py-3 border-2 border-dashed border-text/20 rounded-2xl text-muted font-bold hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center"><Plus size={18} className="mr-2" /> Add Trip</button>
          {groupBy === 'none' && sortedTrips.map(t => <TripCard key={t.id} t={t} />)}

          {groupBy === 'country' && uniqueCountries
            .map(c => ({ c, list: sortedTrips.filter(t => t.country === c) }))
            .sort((a, b) => b.list.reduce((s, t) => s + t.budget, 0) - a.list.reduce((s, t) => s + t.budget, 0))
            .map(({ c, list }) => (
              <div key={c} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-sm">{list[0].flag} {c}</h3>
                  <span className="text-xs font-mono text-cyan-400">RM{fmt(list.reduce((s, t) => s + t.budget, 0))}</span>
                </div>
                {list.map(t => <TripCard key={t.id} t={t} />)}
              </div>
            ))}

          {groupBy === 'year' && Array.from(new Set(sortedTrips.map(t => yearOf(t.startDate)))).sort((a, b) => b.localeCompare(a)).map(yr => {
            const list = sortedTrips.filter(t => yearOf(t.startDate) === yr);
            return (
              <div key={yr} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="font-bold text-sm">{yr}</h3>
                  <span className="text-xs font-mono text-cyan-400">RM{fmt(list.reduce((s, t) => s + t.budget, 0))}</span>
                </div>
                {list.map(t => <TripCard key={t.id} t={t} />)}
              </div>
            );
          })}
        </div>
      ) : (
        /* TIMELINE */
        <div className="space-y-4">
          {Array.from(new Set(sortedByDate.map(t => yearOf(t.startDate)))).sort((a, b) => b.localeCompare(a)).map(yr => (
            <div key={yr} className="flex gap-3">
              <div className="shrink-0 w-12 text-right"><span className="text-lg font-black text-cyan-400">{yr}</span></div>
              <div className="flex-1 border-l-2 border-text/10 pl-4 space-y-2 pb-2">
                {sortedByDate.filter(t => yearOf(t.startDate) === yr).map(t => (
                  <div key={t.id} className="relative">
                    <span className="absolute -left-[22px] top-1.5 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-background" />
                    <button onClick={() => openEdit(t)} className="text-left w-full glass-panel p-3 hover:bg-text/5 transition-colors relative overflow-hidden">
                      <CountryBg country={t.country} />
                      <div className="relative z-10">
                        <p className="font-bold text-sm text-text/90">{t.flag} {t.title}</p>
                        <p className="text-[11px] text-muted">{longDate(t.startDate)} – {longDate(t.endDate)}{t.budget > 0 ? ` · RM${fmt(t.budget)}` : ''}</p>
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

    

      {/* Dev tools — only available on localhost / dev server */}
      {import.meta.env.DEV && (
        <div className="border border-dashed border-amber-500/30 rounded-2xl p-3 space-y-2">
          <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">Dev tools (localhost only)</p>
          <div className="flex gap-2">
            <button onClick={() => setTrips(makeSampleTrips())} className="flex-1 py-2 rounded-lg bg-amber-500/15 text-amber-400 text-xs font-bold hover:bg-amber-500/25">Generate sample data</button>
            <button onClick={() => { if (window.confirm('Clear all trips?')) setTrips([]); }} className="flex-1 py-2 rounded-lg bg-rose-500/15 text-rose-400 text-xs font-bold hover:bg-rose-500/25">Clear all data</button>
          </div>
        </div>
      )}

      {/* Trip form modal */}
      {showForm && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{editId ? 'Edit' : 'Add'} Trip</h3><button onClick={() => setShowForm(false)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>

            {/* Country */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted uppercase tracking-wider">Country</label>
              {fCountry ? (
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-sm font-bold flex-1"><span className="text-lg">{fFlag}</span> {fCountry}</span>
                  <button onClick={() => { setFCountry(''); setFFlag(''); }} className="p-2 text-muted hover:text-text"><X size={16} /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
                    <input value={countrySearch} onChange={e => setCountrySearch(e.target.value)} placeholder="Search country…" className="input-field w-full pl-9" />
                  </div>
                  <div className="max-h-40 overflow-y-auto custom-scrollbar grid grid-cols-2 gap-1 mt-1">
                    {filteredCountries.map(c => (
                      <button key={c.code} onClick={() => pickCountry(c.name, flagOf(c.code))} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-text/5 text-sm text-left"><span className="text-base">{flagOf(c.code)}</span> <span className="truncate">{c.name}</span></button>
                    ))}
                    {countrySearch.trim() && !filteredCountries.some(c => c.name.toLowerCase() === countrySearch.toLowerCase()) && (
                      <button onClick={() => pickCountry(countrySearch.trim(), '🌍')} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-text/5 text-sm text-left col-span-2"><span className="text-base">🌍</span> Use “{countrySearch.trim()}”</button>
                    )}
                  </div>
                </>
              )}
            </div>

            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder={`Trip name (optional, e.g. ${fCountry || 'Japan'} ${fStart ? yearOf(fStart) : '2025'})`} className="input-field w-full" />

            {/* Dates */}
            <div className="flex gap-2">
              <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-muted uppercase">From</label><input type="date" value={fStart} onChange={e => setFStart(e.target.value)} className="input-field w-full text-sm" /></div>
              <div className="flex-1 space-y-1"><label className="text-[10px] font-bold text-muted uppercase">To</label><input type="date" value={fEnd} onChange={e => setFEnd(e.target.value)} className="input-field w-full text-sm" /></div>
            </div>

            <div className="space-y-1"><label className="text-[10px] font-bold text-muted uppercase">Best place visited (optional)</label><input value={fBest} onChange={e => setFBest(e.target.value)} placeholder="e.g. Osaka Castle" className="input-field w-full text-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-muted uppercase">Cities / places visited (optional, comma separated)</label><input value={fCities} onChange={e => setFCities(e.target.value)} placeholder="Tokyo, Osaka, Kyoto" className="input-field w-full text-sm" /></div>
            <div className="space-y-1"><label className="text-[10px] font-bold text-muted uppercase">Notes (optional)</label><input value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="e.g. Sakura season" className="input-field w-full text-sm" /></div>

            <p className="text-[10px] text-muted">Add expenses and itinerary from the trip card on the Trips tab.</p>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button onClick={saveTrip} className="w-full py-3 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-600">{editId ? 'Save Changes' : 'Add Trip'}</button>
          </div>
        </div>
      ), document.body)}

      {/* Manage Expenses modal */}
      {expTrip && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setExpTrip(null)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-4 animate-slide-up max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{expTrip.flag} Expenses</h3><button onClick={() => setExpTrip(null)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>
            <div className="flex p-0.5 bg-text/5 rounded-lg text-xs font-bold w-fit">
              <button onClick={() => setExpMode('lump')} className={`px-3 py-1 rounded ${expMode === 'lump' ? 'bg-surface text-cyan-400 shadow-sm' : 'text-muted'}`}>Lump sum</button>
              <button onClick={() => setExpMode('detailed')} className={`px-3 py-1 rounded ${expMode === 'detailed' ? 'bg-surface text-cyan-400 shadow-sm' : 'text-muted'}`}>Detailed</button>
            </div>
            {expMode === 'lump' ? (
              <input type="number" value={expLump} onChange={e => setExpLump(e.target.value)} placeholder="Total budget (RM)" className="input-field w-full font-mono text-lg" />
            ) : (
              <div className="space-y-1.5">
                {expDetail.map((d, idx) => (
                  <div key={idx} className="flex gap-2">
                    <input value={d.name} onChange={e => setExpDetail(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} placeholder="Category" className="input-field flex-1 py-2 text-sm" />
                    <input type="number" value={d.amount} onChange={e => setExpDetail(prev => prev.map((x, i) => i === idx ? { ...x, amount: e.target.value } : x))} placeholder="RM" className="input-field w-24 py-2 text-sm font-mono" />
                    <button onClick={() => setExpDetail(prev => prev.filter((_, i) => i !== idx))} className="text-rose-400 px-1"><X size={16} /></button>
                  </div>
                ))}
                <div className="flex items-center justify-between">
                  <button onClick={() => setExpDetail(prev => [...prev, { name: '', amount: '' }])} className="text-xs text-cyan-400 font-bold">+ Add category</button>
                  <span className="text-xs font-mono text-muted">Total RM{fmt(expDetail.reduce((s, d) => s + (parseFloat(d.amount) || 0), 0))}</span>
                </div>
              </div>
            )}
            <button onClick={saveExpenses} className="w-full py-3 rounded-xl bg-cyan-500 text-white font-bold hover:bg-cyan-600">Save Expenses</button>
          </div>
        </div>
      ), document.body)}

      {/* Manage Itinerary modal */}
      {itinTrip && createPortal((
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setItinTripId(null)}>
          <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-3 animate-slide-up max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h3 className="font-bold text-lg">{itinTrip.flag} Itinerary</h3><button onClick={() => setItinTripId(null)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>

            {(itinTrip.itinerary || []).map(day => {
              const acts = day.timed ? [...day.activities].sort((a, b) => (a.time || '').localeCompare(b.time || '')) : day.activities;
              const d = draftAct[day.id] || { text: '', time: '' };
              return (
                <div key={day.id} className="glass-panel p-3 space-y-2 border-text/10">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-cyan-400">{day.label}</h4>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateDay(day.id, dd => ({ ...dd, timed: !dd.timed }))} className={`text-[10px] px-2 py-1 rounded-lg font-bold flex items-center gap-1 ${day.timed ? 'bg-cyan-500/20 text-cyan-400' : 'bg-text/5 text-muted'}`}><Clock size={11} /> {day.timed ? 'Timed' : 'List'}</button>
                      <button onClick={() => deleteDay(day.id)} className="text-rose-400 p-1"><Trash2 size={14} /></button>
                    </div>
                  </div>
                  {acts.map((a, idx) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      {day.timed ? (
                        <span className="font-mono text-[11px] text-cyan-400 w-12 shrink-0">{a.time || '--:--'}</span>
                      ) : (
                        <span className="flex flex-col shrink-0">
                          <button onClick={() => moveActivity(day.id, idx, -1)} disabled={idx === 0} className="text-muted hover:text-text disabled:opacity-20 leading-none"><ChevronUp size={13} /></button>
                          <button onClick={() => moveActivity(day.id, idx, 1)} disabled={idx === acts.length - 1} className="text-muted hover:text-text disabled:opacity-20 leading-none"><ChevronDown size={13} /></button>
                        </span>
                      )}
                      <span className="flex-1 text-text/90">{a.text}</span>
                      <button onClick={() => deleteActivity(day.id, a.id)} className="text-rose-400 opacity-50 hover:opacity-100"><X size={14} /></button>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    {day.timed && <input type="time" value={d.time} onChange={e => setDraftAct(prev => ({ ...prev, [day.id]: { ...d, time: e.target.value } }))} className="input-field w-24 py-1.5 text-sm" />}
                    <input value={d.text} onChange={e => setDraftAct(prev => ({ ...prev, [day.id]: { ...d, text: e.target.value } }))} onKeyDown={e => { if (e.key === 'Enter') addActivity(day); }} placeholder="Add activity…" className="input-field flex-1 py-1.5 text-sm" />
                    <button onClick={() => addActivity(day)} className="px-2 rounded-lg bg-cyan-500/20 text-cyan-400"><Plus size={16} /></button>
                  </div>
                </div>
              );
            })}

            <button onClick={addDay} className="w-full py-2.5 border-2 border-dashed border-text/20 rounded-xl text-muted font-bold text-sm hover:border-cyan-500/50 hover:text-cyan-400 transition-all flex items-center justify-center"><Plus size={16} className="mr-1.5" /> Add Day</button>
          </div>
        </div>
      ), document.body)}

      {/* Manage Checklist (packing) modal */}
      {checkTrip && createPortal((() => {
        const items = checkTrip.checklist || [];
        const done = items.filter(i => i.done).length;
        const total = items.length;
        const pct = total ? Math.round((done / total) * 100) : 0;
        const cats = Array.from(new Set([...items.map(i => i.category), ...checkExtraCats]));
        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setCheckTripId(null)}>
            <div className="bg-surface border border-text/10 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 space-y-3 animate-slide-up max-h-[88vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between"><h3 className="font-bold text-lg flex items-center gap-2"><Backpack size={18} className="text-cyan-400" /> {checkTrip.flag} Packing</h3><button onClick={() => setCheckTripId(null)} className="p-1 text-muted hover:text-text"><X size={20} /></button></div>

              {/* Packing progress */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted font-bold">{done}/{total} packed</span><span className="font-bold text-cyan-400">{pct}%</span></div>
                <div className="h-2 bg-black/20 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all" style={{ width: `${pct}%` }} /></div>
              </div>

              {total === 0 && (
                <button onClick={loadDefaultChecklist} className="w-full py-2.5 rounded-xl bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 font-bold text-sm">✨ Load travel essentials</button>
              )}

              {cats.map(cat => {
                const list = items.filter(i => i.category === cat);
                return (
                  <div key={cat} className="glass-panel p-3 space-y-1.5 border-text/10">
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-xs text-cyan-400">{cat}</h4>
                      <button onClick={() => deleteCheckCategory(cat)} className="text-rose-400 opacity-50 hover:opacity-100" title="Delete category"><Trash2 size={13} /></button>
                    </div>
                    {list.map(i => (
                      <div key={i.id} className="flex items-center gap-2">
                        <button onClick={() => toggleCheckItem(i.id)} className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${i.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-text/30 text-transparent'}`}><Check size={13} strokeWidth={3} /></button>
                        <span className={`flex-1 text-sm ${i.done ? 'line-through text-text/40' : 'text-text/90'}`}>{i.text}</span>
                        <button onClick={() => deleteCheckItem(i.id)} className="text-rose-400 opacity-40 hover:opacity-100"><X size={14} /></button>
                      </div>
                    ))}
                    <div className="flex gap-2 pt-1">
                      <input value={checkDraft[cat] || ''} onChange={e => setCheckDraft(prev => ({ ...prev, [cat]: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') addCheckItem(cat); }} placeholder="Add item…" className="input-field flex-1 py-1.5 text-sm" />
                      <button onClick={() => addCheckItem(cat)} className="px-2 rounded-lg bg-cyan-500/20 text-cyan-400"><Plus size={16} /></button>
                    </div>
                  </div>
                );
              })}

              {/* Add custom category */}
              <div className="flex gap-2">
                <input value={newCheckCat} onChange={e => setNewCheckCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addCheckCategory(); }} placeholder="New category (e.g. Baby, Hiking)" className="input-field flex-1 text-sm" />
                <button onClick={addCheckCategory} className="px-4 rounded-xl bg-cyan-500 text-white font-bold text-sm">Add</button>
              </div>
              {total > 0 && (
                <div className="flex gap-2">
                  <button onClick={loadDefaultChecklist} className="flex-1 py-2 text-xs font-bold text-cyan-400">+ Add essentials</button>
                  <button onClick={clearChecklist} className="flex-1 py-2 text-xs font-bold text-rose-400 flex items-center justify-center gap-1"><Trash2 size={13} /> Clear all</button>
                </div>
              )}
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
};

export default TravelHistory;
