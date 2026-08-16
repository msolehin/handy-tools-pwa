import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../lib/store';
// Date helpers come from lib, never from the tool pages themselves — importing a page here would
// pin its whole chunk, and its libraries, into the first load every visitor pays for.
import { openServices, daysUntil, nextDueDate } from '../lib/horizon';
import { commitActive } from '../lib/savings';
import PrivacyNote from '../components/PrivacyNote';
import { 
  ArrowRight,
  Calendar, ShieldAlert,
  List, LayoutGrid, Bell, ArrowUpDown, Banknote, Repeat, Droplets, Layers, Search, ListChecks, HandCoins, ChevronDown, ChevronUp, Sparkles, Heart, ArrowDownAZ, Box
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  SortableContext
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// The registry now lives in lib; re-exported so existing importers keep working.
import { DEFAULT_TOOLS, HOT_IDS, CORE_TOOLS, EXTRA_TOOLS, duitRayaLook, toolDesc, categoryLabel } from '../lib/tools';
import { useLang, useT, t as tr, locale, type Lang } from '../lib/lang';
export { DEFAULT_TOOLS, HOT_IDS };


// Newly launched tools — show a "NEW" badge for 7 days, then HOT_IDS alone decides the badge
const NEW_TOOLS: Record<string, string> = {
  '/habit-tracker': '2026-06-08',
  '/expense-manager': '2026-06-08',
  '/travel-history': '2026-06-08',
  '/asset-warranty': '2026-06-08',
  '/important-numbers': '2026-06-08',
  '/vehicle-services': '2026-08-05',
  '/home-services': '2026-08-05',
  '/pdf-editor': '2026-07-07',
  '/tenancy': '2026-07-30',
};
const NEW_DAYS = 7;
const ALERT_TYPE_LABEL: Record<Lang, Record<string, string>> = {
  ms: {
    document: 'Dokumen', event: 'Acara', commitment: 'Komitmen', water: 'Air',
    debt: 'Hutang', expense: 'Belanja', habit: 'Tabiat', warranty: 'Waranti', service: 'Servis',
  },
  en: {
    document: 'Document', event: 'Event', commitment: 'Commitment', water: 'Water',
    debt: 'Debt', expense: 'Spending', habit: 'Habits', warranty: 'Warranty', service: 'Service',
  },
};
const badgeFor = (id: string): 'new' | 'hot' | null => {
  const launch = NEW_TOOLS[id];
  if (launch && (Date.now() - new Date(launch).getTime()) / 86400000 < NEW_DAYS) return 'new';
  return HOT_IDS.includes(id) ? 'hot' : null;
};

const SortableToolCard = ({ tool, sortableId, viewMode, isReordering, forceDisableDrag, animationsEnabled = true, isFavorite, onToggleFavorite, onToolClick }: { tool: typeof DEFAULT_TOOLS[0], sortableId?: string, viewMode: 'list' | 'grid', isReordering: boolean, forceDisableDrag?: boolean, animationsEnabled?: boolean, isFavorite?: boolean, onToggleFavorite?: (id: string) => void, onToolClick?: (id: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: sortableId || tool.id, disabled: forceDisableDrag || !isReordering });

  useLang();  // desc + category come from the registry, so this re-renders on a switch
  const navigate = useNavigate();
  const [favAnim, setFavAnim] = useState(false);

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavAnim(true);
    if (onToggleFavorite) onToggleFavorite(tool.id);
  };

  const handleNavigation = () => {
    if (onToolClick) onToolClick(tool.id);
    if (tool.to.startsWith('http')) {
      window.open(tool.to, '_blank', 'noopener,noreferrer');
    } else {
      navigate(tool.to);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.fav-btn')) {
      return;
    }

    // While reordering, taps must not navigate to the tool/app
    if (!isReordering) {
      handleNavigation();
    }
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    ...(isReordering && isDragging ? { touchAction: 'none' } : {})
  };

  const Icon = tool.Icon;
  const badge = badgeFor(tool.id);

  // Duit Raya / Angpao card swaps its look based on the saved theme
  const raya = tool.id === '/duit-raya' ? duitRayaLook() : null;
  const displayTitle = raya?.title ?? tool.title;
  const displayDesc = raya ? tr(raya.desc, raya.descEn) : toolDesc(tool);
  const displayIconBg = raya?.iconBgClass ?? tool.iconBgClass;
  const festiveEmoji = raya?.emoji ?? null;

  // Calculate water percentage if this is the water tracker tool
  let waterPercentage = 0;
  if (tool.id === '/water-tracker') {
    const waterStr = store.getItem('water_tracker_data');
    if (waterStr) {
      try {
        const water = JSON.parse(waterStr);
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        if (water.date === todayStr && typeof water.intake === 'number') {
          const goal = water.goal || 2500;
          waterPercentage = Math.min(100, Math.max(0, (water.intake / goal) * 100));
        }
      } catch(e) {}
    }
  }

  // Calculate debt total
  let debtTotal = 0;
  if (tool.id === '/debt-tracker') {
    const debtStr = store.getItem('debt_tracker_ious');
    if (debtStr) {
      try {
        const ious = JSON.parse(debtStr);
        debtTotal = ious.filter((i: any) => i.type === 'i_owe' && !i.isSettled).reduce((acc: number, curr: any) => acc + curr.amount, 0);
      } catch (e) {}
    }
  }

  // Choose which props to pass for drag
  const dragProps = isReordering ? { ...attributes, ...listeners } : {};

  if (viewMode === 'list') {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...dragProps}
        onPointerUpCapture={handlePointerUp}
      >
        <div className={`block group ${isReordering ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
          <div className={`glass-panel p-6 flex items-center justify-between transition-all duration-300 ${tool.borderClass} relative overflow-hidden`}>
            {waterPercentage > 0 && (
              <div 
                className="absolute left-[-25%] right-[-25%] bg-blue-600/30 z-0 origin-top" 
                style={{ bottom: '-25%', height: `calc(${Math.min(90, waterPercentage)}% + 25%)`, transform: 'rotate(var(--water-tilt, 0deg))', transition: 'height 1500ms ease-out, transform 250ms ease-out' }}
              >
                <div className="absolute w-[200%] h-6 left-0 -top-[23px] bg-repeat-x wave-anim" style={{ backgroundImage: `url("${waveSvg1}")`, backgroundSize: '200px 100%' }} />
                <div className="absolute w-[200%] h-6 left-0 -top-[23px] bg-repeat-x wave-anim-fast" style={{ backgroundImage: `url("${waveSvg2}")`, backgroundSize: '200px 100%' }} />
              </div>
            )}
            {debtTotal > 0 && (
              <div className="absolute inset-0 stripes-anim opacity-70 z-0" />
            )}
            {animationsEnabled && tool.id === '/document-expiry' && (
              <div className="absolute inset-0 overflow-hidden z-0 opacity-50 pointer-events-none">
                <div className="absolute left-0 right-0 h-[2px] blur-[1px] bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] scan-line-anim" style={{ top: '10%' }} />
              </div>
            )}
            {animationsEnabled && tool.id === '/countdown' && (
              <div className="absolute inset-0 overflow-hidden z-0 opacity-40 pointer-events-none">
                <div className="absolute -inset-[100%] spin-slow-anim" style={{ background: 'conic-gradient(from 0deg, transparent 0%, transparent 80%, rgba(236,72,153,0.4) 100%)' }} />
              </div>
            )}
            {animationsEnabled && tool.id === '/pace-calculator' && (
              <>
                <div className="absolute inset-0 overflow-hidden z-0 opacity-30 pointer-events-none flex flex-col justify-evenly py-4 -skew-x-[15deg]">
                  <div className="w-full h-[2px] run-track-anim" />
                  <div className="w-full h-[2px] run-track-anim" />
                  <div className="w-full h-[2px] run-track-anim" />
                </div>
                <div className="absolute inset-0 z-0 pointer-events-none flex flex-col justify-evenly py-4">
                  <div className="h-[2px]" />
                  <div className="h-[2px] relative">
                    <div className="absolute left-[35%] -top-[24px] text-2xl runner-bounce drop-shadow-sm">🏃</div>
                    <div className="absolute left-[65%] -top-[20px] text-xl runner-bounce drop-shadow-sm" style={{ animationDelay: '0.2s', filter: 'brightness(0.9)' }}>🏃‍♀️</div>
                  </div>
                  <div className="h-[2px]" />
                </div>
              </>
            )}
            {animationsEnabled && tool.id === '/randomizer' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-40">
                <div className="absolute top-[40%] left-[20%] text-2xl tumble-anim-1 drop-shadow-md">🎲</div>
                <div className="absolute top-[30%] right-[20%] font-black text-2xl text-purple-200 tumble-anim-2 drop-shadow-md">7</div>
                <div className="absolute top-[50%] left-[60%] text-2xl tumble-anim-3 drop-shadow-md">🍾</div>
                <div className="absolute top-[60%] right-[40%] text-2xl tumble-anim-4 drop-shadow-md">🪙</div>
              </div>
            )}
            {animationsEnabled && tool.id === '/grocery-budget' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-50">
                <div className="absolute top-0 left-[20%] text-xl item-drop-1 drop-shadow-md">🍎</div>
                <div className="absolute top-0 left-[50%] text-xl item-drop-2 drop-shadow-md">🥦</div>
                <div className="absolute top-0 right-[20%] text-xl item-drop-3 drop-shadow-md">🍞</div>
              </div>
            )}
            {animationsEnabled && tool.id === '/parking' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-60">
                <div className="absolute bottom-[40%] left-[50%] -translate-x-1/2">
                  <div className="text-3xl pin-drop-anim drop-shadow-md">📍</div>
                </div>
                <div className="absolute bottom-[15%] left-[50%] -translate-x-1/2">
                  <div className="text-2xl car-drive-anim drop-shadow-md">🚗</div>
                </div>
              </div>
            )}
            {animationsEnabled && tool.id === '/decision-maker' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-40 flex items-center justify-end pr-6">
                <div className="relative w-16 h-16">
                  <div className="w-full h-full spin-wheel-anim shadow-[0_0_15px_rgba(0,0,0,0.2)] border-[3px] border-white/30" />
                  <div className="spin-wheel-marker" />
                </div>
              </div>
            )}
            {animationsEnabled && tool.id === 'https://befday.com/' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-60">
                <div className="absolute top-[50%] left-[10%] text-2xl tumble-anim-1 drop-shadow-md">🎈</div>
                <div className="absolute top-[20%] right-[30%] text-xl item-drop-1 drop-shadow-md">🎊</div>
                <div className="absolute top-[60%] right-[10%] text-2xl tumble-anim-2 drop-shadow-md">🎁</div>
                <div className="absolute top-[10%] left-[40%] text-lg item-drop-2 drop-shadow-md">🎉</div>
              </div>
            )}
            <div className="flex items-center space-x-4 relative z-10">
              <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${displayIconBg}`}>
                {festiveEmoji ? <span className="text-2xl leading-none">{festiveEmoji}</span> : <Icon size={28} />}
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1 flex items-center">
                  {displayTitle}
                  {badge === 'hot' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-orange-500 text-white shadow-sm animate-pulse">HOT!!</span>
                  )}
                  {badge === 'new' && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-emerald-500 text-white shadow-sm animate-pulse">NEW</span>
                  )}
                </h3>
                <p className="text-sm text-muted">{displayDesc}</p>
              </div>
            </div>
            <div className="flex items-center space-x-1 relative z-20">
              <button
                onClick={handleToggleFavorite}
                className="fav-btn relative p-2 text-muted hover:text-rose-500 transition-colors"
              >
                {favAnim && isFavorite && (
                  <Heart size={20} className="absolute inset-0 m-auto fill-rose-500 text-rose-500 heart-burst-anim pointer-events-none" />
                )}
                <Heart
                  size={20}
                  onAnimationEnd={() => setFavAnim(false)}
                  className={`${isFavorite ? 'fill-rose-500 text-rose-500' : ''} ${favAnim ? 'heart-pop-anim' : ''}`}
                />
              </button>
              <ArrowRight className={`text-muted transition-colors ${tool.arrowClass}`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      {...dragProps}
      onPointerUpCapture={handlePointerUp}
    >
      <div className={`block h-full group ${isReordering ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
        <div className={`glass-panel p-5 flex flex-col items-center justify-center text-center h-full transition-all duration-300 ${tool.borderClass} relative overflow-hidden`}>
          {badge === 'hot' && (
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-orange-500 text-white shadow-sm animate-pulse">HOT!!</span>
          )}
          {badge === 'new' && (
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-emerald-500 text-white shadow-sm animate-pulse">NEW</span>
          )}
          {waterPercentage > 0 && (
            <div 
              className="absolute left-[-25%] right-[-25%] bg-blue-600/30 z-0 origin-top" 
              style={{ bottom: '-25%', height: `calc(${Math.min(90, waterPercentage)}% + 25%)`, transform: 'rotate(var(--water-tilt, 0deg))', transition: 'height 1500ms ease-out, transform 250ms ease-out' }}
            >
              <div className="absolute w-[200%] h-6 left-0 -top-[23px] bg-repeat-x wave-anim" style={{ backgroundImage: `url("${waveSvg1}")`, backgroundSize: '200px 100%' }} />
              <div className="absolute w-[200%] h-6 left-0 -top-[23px] bg-repeat-x wave-anim-fast" style={{ backgroundImage: `url("${waveSvg2}")`, backgroundSize: '200px 100%' }} />
            </div>
          )}
          {debtTotal > 0 && (
            <div className="absolute inset-0 stripes-anim opacity-70 z-0" />
          )}
          {animationsEnabled && tool.id === '/document-expiry' && (
            <div className="absolute inset-0 overflow-hidden z-0 opacity-50 pointer-events-none">
              <div className="absolute left-0 right-0 h-[2px] blur-[1px] bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] scan-line-anim" style={{ top: '10%' }} />
            </div>
          )}
          {animationsEnabled && tool.id === '/countdown' && (
            <div className="absolute inset-0 overflow-hidden z-0 opacity-40 pointer-events-none">
              <div className="absolute -inset-[100%] spin-slow-anim" style={{ background: 'conic-gradient(from 0deg, transparent 0%, transparent 80%, rgba(236,72,153,0.4) 100%)' }} />
            </div>
          )}
          {animationsEnabled && tool.id === '/pace-calculator' && (
            <>
              <div className="absolute inset-0 overflow-hidden z-0 opacity-30 pointer-events-none flex flex-col justify-evenly py-4 -skew-x-[15deg]">
                <div className="w-full h-[2px] run-track-anim" />
                <div className="w-full h-[2px] run-track-anim" />
                <div className="w-full h-[2px] run-track-anim" />
              </div>
              <div className="absolute inset-0 z-0 pointer-events-none flex flex-col justify-evenly py-4">
                <div className="h-[2px]" />
                <div className="h-[2px] relative">
                  <div className="absolute left-[35%] -top-[24px] text-2xl runner-bounce drop-shadow-sm">🏃</div>
                  <div className="absolute left-[65%] -top-[20px] text-xl runner-bounce drop-shadow-sm" style={{ animationDelay: '0.2s', filter: 'brightness(0.9)' }}>🏃‍♀️</div>
                </div>
                <div className="h-[2px]" />
              </div>
            </>
          )}
          {animationsEnabled && tool.id === '/randomizer' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-40">
              <div className="absolute top-[40%] left-[20%] text-3xl tumble-anim-1 drop-shadow-md">🎲</div>
              <div className="absolute top-[30%] right-[20%] font-black text-3xl text-purple-200 tumble-anim-2 drop-shadow-md">7</div>
              <div className="absolute top-[50%] left-[60%] text-3xl tumble-anim-3 drop-shadow-md">🍾</div>
              <div className="absolute top-[60%] right-[40%] text-3xl tumble-anim-4 drop-shadow-md">🪙</div>
            </div>
          )}
          {animationsEnabled && tool.id === '/grocery-budget' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-50">
              <div className="absolute top-0 left-[20%] text-2xl item-drop-1 drop-shadow-md">🍎</div>
              <div className="absolute top-0 left-[50%] text-2xl item-drop-2 drop-shadow-md">🥦</div>
              <div className="absolute top-0 right-[20%] text-2xl item-drop-3 drop-shadow-md">🍞</div>
            </div>
          )}
          {animationsEnabled && tool.id === '/parking' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-60">
              <div className="absolute bottom-[40%] left-[50%] -translate-x-1/2">
                <div className="text-3xl pin-drop-anim drop-shadow-md">📍</div>
              </div>
              <div className="absolute bottom-[15%] left-[50%] -translate-x-1/2">
                <div className="text-2xl car-drive-anim drop-shadow-md">🚗</div>
              </div>
            </div>
          )}
          {animationsEnabled && tool.id === '/decision-maker' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-40 flex items-center justify-center translate-y-4">
              <div className="relative w-24 h-24">
                <div className="w-full h-full spin-wheel-anim shadow-[0_0_15px_rgba(0,0,0,0.2)] border-[4px] border-white/30" />
                <div className="spin-wheel-marker" />
              </div>
            </div>
          )}
          {animationsEnabled && tool.id === 'https://befday.com/' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-60">
              <div className="absolute top-[50%] left-[10%] text-3xl tumble-anim-1 drop-shadow-md">🎈</div>
              <div className="absolute top-[20%] right-[30%] text-2xl item-drop-1 drop-shadow-md">🎊</div>
              <div className="absolute top-[60%] right-[10%] text-3xl tumble-anim-2 drop-shadow-md">🎁</div>
              <div className="absolute top-[10%] left-[40%] text-2xl item-drop-2 drop-shadow-md">🎉</div>
            </div>
          )}
          <button
            onClick={handleToggleFavorite}
            className="fav-btn absolute top-2 right-2 p-2 text-muted hover:text-rose-500 transition-colors z-20"
          >
            {favAnim && isFavorite && (
              <Heart size={18} className="absolute inset-0 m-auto fill-rose-500 text-rose-500 heart-burst-anim pointer-events-none" />
            )}
            <Heart
              size={18}
              onAnimationEnd={() => setFavAnim(false)}
              className={`${isFavorite ? 'fill-rose-500 text-rose-500' : ''} ${favAnim ? 'heart-pop-anim' : ''}`}
            />
          </button>
          <div className={`p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform ${displayIconBg} relative z-10`}>
            {festiveEmoji ? <span className="text-3xl leading-none">{festiveEmoji}</span> : <Icon size={32} />}
          </div>
          <h3 className="font-bold text-sm leading-tight relative z-10">{displayTitle}</h3>
        </div>
      </div>
    </div>
  );
};

interface AlertItem {
  id: string;
  type: 'document' | 'event' | 'commitment' | 'water' | 'debt' | 'expense' | 'habit' | 'warranty' | 'service';
  subtitle?: string;
  title: string;
  daysLeft: number;
  to: string;
  percentage?: number;
}

const waveSvg1 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 88.7'%3E%3Cpath d='M800 56.9c-155.5 0-204.9-50-405.5-49.9-200 0-250 49.9-394.5 49.9v31.8h800v-.2-31.6z' fill='%2360a5fa' opacity='0.4'/%3E%3C/svg%3E`;
const waveSvg2 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 88.7'%3E%3Cpath d='M800 56.9c-155.5 0-204.9-50-405.5-49.9-200 0-250 49.9-394.5 49.9v31.8h800v-.2-31.6z' fill='%233b82f6' opacity='0.6'/%3E%3C/svg%3E`;

const Home: React.FC = () => {
  const t = useT();
  const lang = useLang();
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'category' | 'alphabet'>(() => {
    return (localStorage.getItem('home_view_mode') as 'list' | 'grid' | 'category' | 'alphabet') || 'list';
  });
  const [isReordering, setIsReordering] = useState(false);
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(() => {
    const saved = parseInt(localStorage.getItem('home_grid_cols') || '');
    return saved === 3 || saved === 4 ? saved : 2;
  });
  useEffect(() => {
    localStorage.setItem('home_grid_cols', String(gridCols));
  }, [gridCols]);
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = localStorage.getItem('handy-animations');
    return saved ? JSON.parse(saved) : true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);
  const [alertsReorder, setAlertsReorder] = useState(false);
  const [alertOrder, setAlertOrder] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('home_alert_order') || '[]'); } catch (e) { return []; }
  });
  useEffect(() => { localStorage.setItem('home_alert_order', JSON.stringify(alertOrder)); }, [alertOrder]);

  // Transient toast feedback
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1600);
  };

  // Tilt the water animations (Drink card + water alert) with device orientation.
  // Sets a shared CSS variable read by every water-fill element.
  useEffect(() => {
    const DOE = (window as any).DeviceOrientationEvent;
    if (!DOE) return;
    const handle = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // left/right tilt
      const clamped = Math.max(-14, Math.min(14, gamma));
      document.documentElement.style.setProperty('--water-tilt', `${-clamped}deg`);
    };
    window.addEventListener('deviceorientation', handle);
    return () => window.removeEventListener('deviceorientation', handle);
  }, []);

  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  // Publish alerts (in the user's saved order) so the Layout bottom bar matches Home
  useEffect(() => {
    const ordered = [...alerts].sort((a, b) => {
      const ia = alertOrder.indexOf(a.id);
      const ib = alertOrder.indexOf(b.id);
      if (ia === -1 && ib === -1) return a.daysLeft - b.daysLeft;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    window.dispatchEvent(new CustomEvent('home:alerts', { detail: ordered }));
  }, [alerts, alertOrder]);

  // Favorites state
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('handy-tools-favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('handy-tools-favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(fId => fId !== id) : [...prev, id]
    );
  };

  // Recent tools state
  const [recentTools, setRecentTools] = useState<string[]>(() => {
    const saved = localStorage.getItem('handy-tools-recents');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('handy-tools-recents', JSON.stringify(recentTools));
  }, [recentTools]);

  const [recentMinimized, setRecentMinimized] = useState(() => {
    const saved = localStorage.getItem('handy-tools-recents-minimized');
    return saved ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    localStorage.setItem('handy-tools-recents-minimized', JSON.stringify(recentMinimized));
  }, [recentMinimized]);

  const handleToolClick = (id: string) => {
    setRecentTools(prev => {
      const newRecents = [id, ...prev.filter(tId => tId !== id)].slice(0, 5);
      return newRecents;
    });
  };

  useEffect(() => {
    localStorage.setItem('handy-animations', JSON.stringify(animationsEnabled));
  }, [animationsEnabled]);

  useEffect(() => {
    localStorage.setItem('home_view_mode', viewMode);
  }, [viewMode]);

  // The catalog order is fixed (spec §2 priority, see lib/tools.ts) — only Favorites reorder.
  // Drop the old per-device order so an existing user's stale shuffle doesn't linger unused.
  useEffect(() => {
    localStorage.removeItem('home_tool_order');
    localStorage.removeItem('hot_tools_promoted_v3');
  }, []);

  // Load Alerts
  useEffect(() => {
    const newAlerts: AlertItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const getDaysLeft = (targetDate: string) => {
      const target = new Date(targetDate);
      target.setHours(0, 0, 0, 0);
      const diffTime = target.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    // 1. Document Expiry Alerts (<= 30 days or expired)
    const docsStr = store.getItem('de_documents');
    if (docsStr) {
      try {
        const docs = JSON.parse(docsStr);
        docs.forEach((doc: any) => {
          const days = getDaysLeft(doc.expiryDate);
          if (days <= 30) {
            newAlerts.push({
              id: `doc-${doc.id}`,
              type: 'document',
              title: doc.customTitle || doc.type,
              daysLeft: days,
              to: '/document-expiry'
            });
          }
        });
      } catch (e) {}
    }

    // 2. Countdown Events (Upcoming in next 7 days, or today)
    const eventsStr = store.getItem('cd_events');
    if (eventsStr) {
      try {
        const events = JSON.parse(eventsStr);
        events.forEach((ev: any) => {
          const days = getDaysLeft(ev.targetDate);
          if (days >= 0 && days <= 7) {
            newAlerts.push({
              id: `ev-${ev.id}`,
              type: 'event',
              title: ev.title,
              daysLeft: days,
              to: '/countdown'
            });
          }
        });
      } catch (e) {}
    }

    // 3. Commitments (Upcoming in next 3 days)
    const subExpStr = store.getItem('expense_manager_data');
    if (subExpStr) {
      try {
        const data = JSON.parse(subExpStr);
        if (data.commitments && Array.isArray(data.commitments)) {
          const today = new Date();
          const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
          const maxDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
          
          data.commitments.forEach((c: any) => {
            // commitActive covers both ends of the window: one that was stopped, and one that has
            // not started yet, are neither of them a bill to nag about today.
            if (!c.archived && commitActive(c, currentMonth) && (!c.payments || !c.payments[currentMonth])) {
              const day = Math.min(c.paymentDay, maxDay);
              const renewalDate = new Date(today.getFullYear(), today.getMonth(), day);
              const days = daysUntil(renewalDate);
              
              if (days >= 0 && days <= 3) {
                newAlerts.push({
                  id: `com-${c.id}`,
                  type: 'commitment',
                  title: `${c.title} (RM${c.amount})`,
                  daysLeft: days,
                  to: '/commitments'
                });
              }
            }
          });
        }
      } catch (e) {}
    }

    // 4. Water Tracker
    const waterStr = store.getItem('water_tracker_data');
    if (waterStr) {
      try {
        const water = JSON.parse(waterStr);
        const d = new Date();
        const todayStr = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
        
        const goal = water.goal || 2500;
        let consumed = 0;
        if (water.date === todayStr && typeof water.intake === 'number') {
          consumed = water.intake;
        }
        
        // Show if not completed, or just show as summary
        if (consumed < goal) {
          const percentage = Math.min(100, Math.max(0, (consumed / goal) * 100));
          newAlerts.push({
            id: 'water',
            type: 'water',
            title: `${consumed} / ${goal} ml`,
            daysLeft: 0,
            percentage,
            to: '/water-tracker'
          });
        }
      } catch (e) {}
    }

    // 6. Debt Tracker
    const debtStr = store.getItem('debt_tracker_ious');
    if (debtStr) {
      try {
        const ious = JSON.parse(debtStr);
        const totalOwed = ious.filter((i: any) => i.type === 'i_owe' && !i.isSettled).reduce((acc: number, curr: any) => acc + curr.amount, 0);
        if (totalOwed > 0) {
          newAlerts.push({
            id: 'debt',
            type: 'debt',
            title: `RM${totalOwed.toFixed(2)}`,
            daysLeft: 0,
            to: '/debt-tracker'
          });
        }
      } catch (e) {}
    }

    // 7. Expense Manager — this month's spending vs income
    const expStr = store.getItem('expense_manager_data');
    if (expStr) {
      try {
        const data = JSON.parse(expStr);
        const now = new Date();
        const mk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const fmtRM = (n: number) => n.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const rawExpenses = (data.expenses || [])
          .filter((e: any) => typeof e.date === 'string' && e.date.slice(0, 7) === mk)
          .reduce((s: number, e: any) => s + (e.amount || 0), 0);
          
        const paidCommitments = (data.commitments || [])
          .filter((c: any) => c.payments && c.payments[mk])
          .reduce((s: number, c: any) => s + (c.amount || 0), 0);
          
        const spent = rawExpenses + paidCommitments;

        const income = (data.incomes || [])
          .filter((i: any) => {
            if (i.recurring) {
              if (i.startMonth && mk < i.startMonth) return false;
              if (i.endMonth && mk > i.endMonth) return false;
              
              if (typeof i.day === 'number') {
                const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
                if (mk === currentMonth && now.getDate() < i.day) {
                  return false;
                }
              }
              return true;
            }
            if (typeof i.date === 'string' && i.date.slice(0, 7) === mk) {
              const incomeDate = new Date(i.date);
              incomeDate.setHours(0, 0, 0, 0);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              if (incomeDate > today) return false;
              return true;
            }
            return false;
          })
          .reduce((s: number, i: any) => s + (i.amount || 0), 0);
          
        if (spent > 0 || income > 0) {
          newAlerts.push({
            id: 'expense',
            type: 'expense',
            title: tr(`Belanja RM${fmtRM(spent)}`, `Spent RM${fmtRM(spent)}`),
            daysLeft: 0,
            percentage: income > 0 ? Math.min(100, Math.round((spent / income) * 100)) : (spent > 0 ? 100 : 0),
            to: '/expense-manager'
          });
        }
      } catch (e) {}
    }

    // 8. Habit Tracker — habits still to do today
    const habitStr = store.getItem('habit_tracker_data');
    if (habitStr) {
      try {
        const habits = JSON.parse(habitStr);
        if (Array.isArray(habits) && habits.length > 0) {
          const now = new Date();
          const tkey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          const total = habits.length;
          const done = habits.filter((h: any) => Array.isArray(h.completedDates) && h.completedDates.includes(tkey)).length;
          const left = total - done;
          if (left > 0) {
            newAlerts.push({
              id: 'habit',
              type: 'habit',
              title: tr(`${left} lagi hari ini`, `${left} left today`),
              daysLeft: 0,
              percentage: Math.round((done / total) * 100),
              to: '/habit-tracker'
            });
          }
        }
      } catch (e) {}
    }

    // 9. Asset & Warranty Tracker — items expiring within 30 days
    const warrantyStr = store.getItem('asset_warranty_tracker_data');
    if (warrantyStr) {
      try {
        const assets = JSON.parse(warrantyStr);
        assets.forEach((asset: any) => {
          if (asset.expiryDate) {
            const days = getDaysLeft(asset.expiryDate);
            if (days >= 0 && days <= 30) {
              newAlerts.push({
                id: `warranty-${asset.id}`,
                type: 'warranty',
                title: asset.name,
                daysLeft: days,
                to: '/asset-warranty'
              });
            }
          }
        });
      } catch (e) {}
    }
    // 10. Vehicle Services — next service due within 30 days or overdue
    const vehicleStr = store.getItem('vehicle_services_data');
    if (vehicleStr) {
      try {
        const p = JSON.parse(vehicleStr);
        // Superseded visits keep a stale nextServiceDate; only the newest per service is still owed.
        const events = openServices(Array.isArray(p.events) ? p.events : []);
        events.forEach((s: any) => {
          if (s.nextServiceDate) {
            const days = getDaysLeft(s.nextServiceDate);
            if (days <= 30) {
              newAlerts.push({
                id: `v-service-${s.id}`,
                type: 'service',
                title: `${tr('Kenderaan', 'Vehicle')}: ${s.title}`,
                daysLeft: days,
                to: '/vehicle-services'
              });
            }
          }
        });
      } catch (e) {}
    }

    // 10b. Home Services — next service due within 30 days or overdue
    const homeStr = store.getItem('home_services_data');
    if (homeStr) {
      try {
        const p = JSON.parse(homeStr);
        const events = openServices(Array.isArray(p.events) ? p.events : []);
        events.forEach((s: any) => {
          if (s.nextServiceDate) {
            const days = getDaysLeft(s.nextServiceDate);
            if (days <= 30) {
              newAlerts.push({
                id: `h-service-${s.id}`,
                type: 'service',
                title: `${tr('Rumah', 'Home')}: ${s.title}`,
                daysLeft: days,
                to: '/home-services'
              });
            }
          }
        });
      } catch (e) {}
    }

    // 11. Sewa & Kontrak — contract ending within 60 days, and rent due within 3
    const contractStr = store.getItem('tenancy_data');
    if (contractStr) {
      try {
        const p = JSON.parse(contractStr);
        const contracts = Array.isArray(p.items) ? p.items : [];
        contracts.forEach((c: any) => {
          if (c.endDate) {
            const days = getDaysLeft(c.endDate);
            if (days <= 60) {
              newAlerts.push({ id: `contract-${c.id}`, type: 'document', title: c.title, daysLeft: days, to: '/tenancy' });
            }
          }
          if (c.amount > 0 && c.dueDay) {
            const dueIn = getDaysLeft(nextDueDate(c.dueDay));
            if (dueIn <= 3) {
              newAlerts.push({ id: `rent-${c.id}`, type: 'commitment', title: c.title, daysLeft: dueIn, to: '/tenancy' });
            }
          }
        });
      } catch (e) {}
    }

    newAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
    setAlerts(newAlerts);
    // Some alert titles are built here rather than at render, so switching language has to
    // rebuild them — otherwise the strip keeps yesterday's language until the next mount.
  }, [lang]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Only the Favorites section reorders (ids are prefixed with "fav-")
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const aId = String(active.id).slice(4);
    const oId = String(over.id).slice(4);
    setFavorites((items) => {
      const oldIndex = items.indexOf(aId);
      const newIndex = items.indexOf(oId);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Theme-aware title for the Duit Raya / Angpao tool (used for alphabet sort & search)
  const duitRaya = duitRayaLook();
  const titleOf = (tool: typeof DEFAULT_TOOLS[0]) => (tool.id === '/duit-raya' ? duitRaya.title : tool.title);
  const matchesSearch = (tool: typeof DEFAULT_TOOLS[0]) => {
    const q = searchQuery.toLowerCase();
    return titleOf(tool).toLowerCase().includes(q) || tool.desc.toLowerCase().includes(q);
  };

  // Column count for grid-based views (not list)
  const gridColClass = gridCols === 4 ? 'grid-cols-4' : gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  // Alerts in the user's saved order; new alerts (not yet ordered) fall to the end by urgency
  const orderedAlerts = [...alerts].sort((a, b) => {
    const ia = alertOrder.indexOf(a.id);
    const ib = alertOrder.indexOf(b.id);
    if (ia === -1 && ib === -1) return a.daysLeft - b.daysLeft;
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  const moveAlert = (id: string, dir: -1 | 1) => {
    const ids = orderedAlerts.map(a => a.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setAlertOrder(ids);
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast feedback */}
      {toast && (
        <div className="fixed bottom-36 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl bg-surface border border-text/10 shadow-xl text-sm font-bold text-text animate-fade-in pointer-events-none">
          {toast}
        </div>
      )}

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mt-4 mb-2 space-y-2">
          <div className="flex items-center justify-between text-text/80 mb-1 px-1">
            <div
              className="flex items-center space-x-2 cursor-pointer hover:text-text transition-colors"
              onClick={() => setIsAlertsExpanded(!isAlertsExpanded)}
            >
              <Bell size={18} className="text-yellow-400 animate-pulse" />
              <h3 className="font-bold text-sm">{t('Perlu Tindakan', 'Action Needed')} <span className="text-muted text-xs font-normal ml-1">({alerts.length})</span></h3>
            </div>
            <div className="flex items-center gap-1.5">
              {alerts.length > 1 && (
                <button
                  onClick={() => { setAlertsReorder(r => !r); setIsAlertsExpanded(true); }}
                  className={`px-2 py-1 rounded-full text-[10px] font-bold transition-colors flex items-center gap-1 ${alertsReorder ? 'bg-yellow-500/20 text-yellow-400' : 'bg-text/5 text-muted hover:text-text'}`}
                >
                  <ArrowUpDown size={13} /> {alertsReorder ? t('Siap', 'Done') : t('Susun', 'Reorder')}
                </button>
              )}
              <button onClick={() => setIsAlertsExpanded(!isAlertsExpanded)} className="p-1 rounded-full bg-text/5 hover:bg-text/10 text-muted transition-colors">
                {isAlertsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
            </div>
          </div>
          <div className={`flex gap-2 pb-2 transition-all ${isAlertsExpanded ? 'flex-col' : 'overflow-x-auto custom-scrollbar snap-x'}`}>
            {orderedAlerts.map((alert, idx) => (
              <div
                key={alert.id}
                onClick={alertsReorder ? undefined : () => navigate(alert.to)}
                className={`shrink-0 px-3 py-2.5 rounded-xl border transition-all relative overflow-hidden ${alertsReorder ? '' : 'cursor-pointer hover:scale-[1.02]'} ${
                  isAlertsExpanded ? 'w-full' : 'w-[220px] snap-start'
                } ${
                  alert.type === 'document' 
                    ? alert.daysLeft < 0 
                      ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                      : 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                    : alert.type === 'commitment'
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                      : alert.type === 'water'
                        ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                        : alert.type === 'debt'
                          ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                          : alert.type === 'expense'
                            ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                            : alert.type === 'habit'
                              ? 'bg-violet-500/10 border-violet-500/30 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
                              : alert.type === 'warranty'
                                ? 'bg-orange-500/10 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)]'
                                : alert.type === 'service'
                                  ? alert.daysLeft < 0
                                    ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]'
                                    : 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                                  : 'bg-pink-500/10 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]'
                }`}
              >
                {animationsEnabled && (alert.type === 'document' || alert.type === 'service') && (
                  <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
                    <div 
                      className={`absolute left-0 right-0 h-[2px] blur-[1px] scan-line-anim ${
                        alert.daysLeft < 0 ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)]' : 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,1)]'
                      }`} 
                      style={{ top: '10%' }}
                    />
                  </div>
                )}
                {animationsEnabled && alert.type === 'event' && (
                  <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-50">
                    <div className="absolute -inset-[100%] spin-slow-anim" style={{ background: 'conic-gradient(from 0deg, transparent 0%, transparent 80%, rgba(236,72,153,0.4) 100%)' }} />
                  </div>
                )}
                {animationsEnabled && alert.type === 'water' && alert.percentage !== undefined && alert.percentage > 0 && (
                  <div 
                    className="absolute left-[-25%] right-[-25%] bg-blue-600/30 z-0 origin-top" 
                    style={{ bottom: '-25%', height: `calc(${Math.min(90, alert.percentage)}% + 25%)`, transform: 'rotate(var(--water-tilt, 0deg))', transition: 'height 1500ms ease-out, transform 250ms ease-out' }} 
                  >
                    <div className="absolute w-[200%] h-6 left-0 -top-[23px] bg-repeat-x wave-anim" style={{ backgroundImage: `url("${waveSvg1}")`, backgroundSize: '200px 100%' }} />
                    <div className="absolute w-[200%] h-6 left-0 -top-[23px] bg-repeat-x wave-anim-fast" style={{ backgroundImage: `url("${waveSvg2}")`, backgroundSize: '200px 100%' }} />
                  </div>
                )}
                {animationsEnabled && alert.type === 'debt' && (
                  <div className="absolute inset-0 stripes-anim opacity-70 z-0" />
                )}
                {animationsEnabled && alert.type === 'habit' && alert.percentage !== undefined && alert.percentage > 0 && (
                  <div
                    className="absolute top-0 left-0 bottom-0 bg-violet-500/10 transition-all duration-1000 ease-out z-0 border-r border-violet-500/30 overflow-hidden"
                    style={{ width: `${alert.percentage}%`, minWidth: '5%' }}
                  >
                    <div className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-violet-400/20 to-transparent shimmer-anim" />
                  </div>
                )}
                {animationsEnabled && alert.type === 'expense' && alert.percentage !== undefined && alert.percentage > 0 && (
                  <div
                    className={`absolute top-0 left-0 bottom-0 transition-all duration-1000 ease-out z-0 border-r overflow-hidden ${alert.percentage >= 100 ? 'bg-red-500/15 border-red-500/40' : 'bg-emerald-500/10 border-emerald-500/30'}`}
                    style={{ width: `${alert.percentage}%`, minWidth: '5%' }}
                  >
                    <div className={`absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent to-transparent shimmer-anim ${alert.percentage >= 100 ? 'via-red-400/20' : 'via-emerald-400/20'}`} />
                  </div>
                )}
                
                <div className="flex items-center gap-2.5 relative z-10 pr-4">
                  {alert.type === 'document' ? (
                    <ShieldAlert size={18} className={`shrink-0 ${alert.daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'}`} />
                  ) : alert.type === 'commitment' ? (
                    <Repeat size={18} className="shrink-0 text-indigo-400" />
                  ) : alert.type === 'water' ? (
                    <Droplets size={18} className="shrink-0 text-blue-400" />
                  ) : alert.type === 'debt' ? (
                    <HandCoins size={18} className="shrink-0 text-rose-400" />
                  ) : alert.type === 'expense' ? (
                    <Banknote size={18} className="shrink-0 text-emerald-400" />
                  ) : alert.type === 'habit' ? (
                    <ListChecks size={18} className="shrink-0 text-violet-400" />
                  ) : alert.type === 'warranty' ? (
                    <Box size={18} className="shrink-0 text-orange-400" />
                  ) : (
                    <Calendar size={18} className="shrink-0 text-pink-400" />
                  )}
                  <div className="flex-1 min-w-0">
                  <p className="font-bold text-[13px] text-text truncate leading-tight">
                    {alert.type === 'document' ? t('Perbaharui: ', 'Renew: ') : alert.type === 'commitment' ? t('Bayar: ', 'Pay: ') : alert.type === 'water' ? t('Air: ', 'Water: ') : alert.type === 'debt' ? t('Hutang: ', 'Debt: ') : alert.type === 'habit' ? t('Tabiat: ', 'Habits: ') : alert.type === 'warranty' ? t('Waranti: ', 'Warranty: ') : ''}{alert.title}
                  </p>
                  <p className={`text-[11px] font-medium leading-tight truncate ${
                    alert.type === 'document'
                      ? alert.daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'
                      : alert.type === 'commitment' ? 'text-indigo-400'
                      : alert.type === 'water' ? 'text-blue-400'
                      : alert.type === 'debt' ? 'text-rose-400'
                      : alert.type === 'expense' ? 'text-emerald-400'
                      : alert.type === 'habit' ? 'text-violet-400'
                      : alert.type === 'warranty' ? 'text-orange-400'
                      : 'text-pink-400'
                  }`}>
                    <span className="text-text/50 font-bold uppercase tracking-wider text-[10px]">{alert.type === 'service' && alert.daysLeft < 0 ? t('Lewat', 'Overdue') : ALERT_TYPE_LABEL[lang][alert.type]} · </span>
                    {alert.type === 'water' ? t('Minum lagi!', 'Drink more!') : alert.type === 'debt' ? t('Perlu tindakan', 'Needs attention') : alert.type === 'expense' ? t(`${alert.percentage ?? 0}% pendapatan dibelanja`, `${alert.percentage ?? 0}% of income spent`) : alert.type === 'habit' ? t(`${alert.percentage ?? 0}% siap`, `${alert.percentage ?? 0}% done`) : alert.daysLeft < 0
                      ? (alert.type === 'service' ? t(`Lewat ${Math.abs(alert.daysLeft)} hari`, `${Math.abs(alert.daysLeft)} days overdue`) : t(`Tamat ${Math.abs(alert.daysLeft)} hari lepas`, `Expired ${Math.abs(alert.daysLeft)} days ago`))
                      : alert.daysLeft === 0
                        ? t('Hari ini!', 'Today!')
                        : t(`${alert.daysLeft} Hari Lagi`, `${alert.daysLeft} Days Left`)}
                  </p>
                  </div>
                </div>
                {alertsReorder && (
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-1">
                    <button onClick={(e) => { e.stopPropagation(); moveAlert(alert.id, -1); }} disabled={idx === 0} className="w-6 h-6 rounded-md bg-surface/90 border border-text/10 text-text flex items-center justify-center disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button onClick={(e) => { e.stopPropagation(); moveAlert(alert.id, 1); }} disabled={idx === orderedAlerts.length - 1} className="w-6 h-6 rounded-md bg-surface/90 border border-text/10 text-text flex items-center justify-center disabled:opacity-30"><ChevronDown size={14} /></button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end justify-between mt-4 mb-4">
        <section>
          <h2 className="text-3xl font-bold mb-1">{t('Selamat Datang', 'Welcome')}</h2>
          <p className="text-muted text-sm pr-4">{t('Pilih alat di bawah untuk mula. Berfungsi sepenuhnya luar talian.', 'Pick a tool below to start. Works fully offline.')}</p>
        </section>
        <div className="flex flex-col items-end space-y-2">
            {/* Reorder Button */}
            <div className="flex items-center space-x-2">
              {!searchQuery && (
                <button
                  onClick={() => {
                    const next = !animationsEnabled;
                    setAnimationsEnabled(next);
                    showToast(next ? t('✨ Animasi dihidupkan', '✨ Animations on') : t('⏸️ Animasi dimatikan', '⏸️ Animations off'));
                  }}
                  className={`p-2 rounded-xl transition-all border flex items-center justify-center active:scale-90 ${
                    animationsEnabled
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'bg-surface border-text/10 text-muted hover:bg-text/5 hover:text-text'
                  }`}
                  title={t('Hidup/Matikan Animasi', 'Toggle animations')}
                >
                  <Sparkles size={20} className={animationsEnabled ? 'animate-pulse' : ''} />
                </button>
              )}
              {favorites.length > 1 && viewMode !== 'category' && viewMode !== 'alphabet' && !searchQuery && (
                <button
                  onClick={() => setIsReordering(!isReordering)}
                  className={`p-2 rounded-xl transition-all border flex items-center justify-center ${
                    isReordering 
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                      : 'bg-surface border-text/10 text-muted hover:bg-text/5 hover:text-text'
                  }`}
                  title={t('Susun Kegemaran', 'Reorder favourites')}
                >
                  <ArrowUpDown size={20} className={isReordering ? 'animate-pulse' : ''} />
                </button>
              )}
            </div>
             

            {/* View Mode Toggle */}
            <div className="flex bg-text/5 p-1 rounded-xl">
              <button
                onClick={() => { setViewMode('list'); showToast(t('📋 Paparan senarai', '📋 List view')); }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'list' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title={t('Paparan Senarai', 'List view')}
              >
                <List size={18} />
              </button>
              <button
                onClick={() => { setViewMode('grid'); showToast(t('▦ Paparan grid', '▦ Grid view')); }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'grid' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title={t('Paparan Grid', 'Grid view')}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => {
                  setViewMode('category');
                  setIsReordering(false); // disable reordering in category mode
                  showToast(t('🗂️ Paparan kategori', '🗂️ Category view'));
                }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'category' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title={t('Paparan Kategori', 'Category view')}
              >
                <Layers size={18} />
              </button>
              <button
                onClick={() => {
                  setViewMode('alphabet');
                  setIsReordering(false); // disable reordering in alphabet mode
                  showToast(t('🔤 Disusun A–Z', '🔤 Sorted A–Z'));
                }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'alphabet' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title={t('Susun A–Z', 'Sort A–Z')}
              >
                <ArrowDownAZ size={18} />
              </button>
            </div>

            {/* Column count (grid-based views only) */}
            {viewMode !== 'list' && (
              <div className="flex bg-text/5 p-1 rounded-xl">
                {([2, 3] as const).map(n => (
                  <button
                    key={n}
                    onClick={() => { setGridCols(n); showToast(t(`▦ ${n} lajur`, `▦ ${n} columns`)); }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all active:scale-90 ${gridCols === n ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                    title={t(`${n} lajur`, `${n} columns`)}
                  >
                    x{n}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-muted" />
          </div>
          <input 
            type="text" 
            placeholder={t('Cari alat...', 'Search tools...')} 
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) setIsReordering(false);
            }}
            className="input-field w-full pl-10 bg-text/5 border-text/10 text-sm py-3"
          />
        </div>

        {isReordering && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-medium animate-fade-in">
            <ArrowUpDown size={16} className="shrink-0 animate-pulse" />
            <span>{t('Seret & lepas kegemaran anda untuk susun semula. Tekan butang sekali lagi bila dah siap.', 'Drag and drop your favourites to reorder. Press the button again when you are done.')}</span>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {viewMode === 'category' ? (
            <div className="space-y-8 animate-fade-in">
              {Array.from(new Set(DEFAULT_TOOLS.map(t => t.category))).map(cat => {
                const catTools = DEFAULT_TOOLS.filter(t => t.category === cat && matchesSearch(t));

                if (catTools.length === 0) return null;

                return (
                  <div key={cat!} className="space-y-4">
                    <div className="flex items-center space-x-3 px-1">
                      <div className="h-px bg-text/10 flex-1"></div>
                      <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{categoryLabel(cat)}</h3>
                      <div className="h-px bg-text/10 flex-1"></div>
                    </div>
                    <div className={`grid ${gridColClass} gap-4`}>
                      {catTools.map(tool => (
                        <SortableToolCard key={tool.id} tool={tool} viewMode="grid" isReordering={false} forceDisableDrag={true}
                          animationsEnabled={animationsEnabled} 
                          isFavorite={favorites.includes(tool.id)}
                          onToggleFavorite={toggleFavorite}
                          onToolClick={handleToolClick}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : viewMode === 'alphabet' ? (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center space-x-3 px-1">
                <div className="h-px bg-text/10 flex-1"></div>
                <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{t('Semua Alat (A–Z)', 'All Tools (A–Z)')}</h3>
                <div className="h-px bg-text/10 flex-1"></div>
              </div>
              <div className={`grid ${gridColClass} gap-4`}>
                {[...DEFAULT_TOOLS]
                  .filter(matchesSearch)
                  .sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
                  .map(tool => (
                    <SortableToolCard
                      key={tool.id}
                      tool={tool}
                      viewMode="grid"
                      isReordering={false}
                      forceDisableDrag={true}
                      animationsEnabled={animationsEnabled}
                      isFavorite={favorites.includes(tool.id)}
                      onToggleFavorite={toggleFavorite}
                      onToolClick={handleToolClick}
                    />
                  ))}
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {!searchQuery && favorites.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 px-1">
                    <div className="h-px bg-text/10 flex-1"></div>
                    <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{t('❤️ Kegemaran', '❤️ Favourites')}</h3>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                  <div className={viewMode === 'list' ? "grid gap-4" : `grid ${gridColClass} gap-4`}>
                    <SortableContext
                      items={favorites.map(id => `fav-${id}`)}
                      strategy={rectSortingStrategy}
                    >
                    {favorites.map(id => {
                      const tool = DEFAULT_TOOLS.find(t => t.id === id);
                      if (!tool) return null;
                      return (
                        <SortableToolCard
                          key={`fav-${tool.id}`}
                          sortableId={`fav-${tool.id}`}
                          tool={tool}
                          viewMode={viewMode}
                          isReordering={isReordering}
                          animationsEnabled={animationsEnabled}
                          isFavorite={true}
                          onToggleFavorite={toggleFavorite}
                          onToolClick={handleToolClick}
                        />
                      );
                    })}
                    </SortableContext>
                  </div>
                </div>
              )}

              {!searchQuery && !isReordering && recentTools.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 px-1">
                    <div className="h-px bg-text/10 flex-1"></div>
                    <button
                      type="button"
                      onClick={() => setRecentMinimized((prev: boolean) => !prev)}
                      className="text-sm font-bold text-muted uppercase tracking-widest flex items-center gap-1.5 hover:text-text transition-colors"
                      aria-expanded={!recentMinimized}
                    >
                      {t('🕒 Alat Terkini', '🕒 Recent Tools')}
                      <span className={`transition-transform duration-200 ${recentMinimized ? '' : 'rotate-180'}`}>▾</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentTools([])}
                      className="text-[10px] font-bold text-muted uppercase tracking-widest hover:text-red-500 transition-colors"
                      title={t('Kosongkan alat terkini', 'Clear recent tools')}
                    >
                      {t('Kosongkan', 'Clear')}
                    </button>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                  {!recentMinimized && (
                  <div className="grid grid-cols-2 gap-2">
                    {recentTools.map(id => {
                      const tool = DEFAULT_TOOLS.find(t => t.id === id);
                      if (!tool) return null;
                      const RecentIcon = tool.Icon;
                      const isDuitRaya = tool.id === '/duit-raya';
                      const recentEmoji = isDuitRaya ? duitRaya.emoji : null;
                      const recentIconBg = isDuitRaya ? duitRaya.iconBgClass : tool.iconBgClass;
                      const goTo = () => {
                        handleToolClick(tool.id);
                        if (tool.to.startsWith('http')) window.open(tool.to, '_blank', 'noopener,noreferrer');
                        else navigate(tool.to);
                      };
                      return (
                        <button
                          key={`rec-${tool.id}`}
                          onClick={goTo}
                          className="glass-panel flex items-center gap-2 p-2 rounded-xl hover:bg-text/5 transition-colors text-left"
                        >
                          <div className={`p-1.5 rounded-lg shrink-0 ${recentIconBg}`}>
                            {recentEmoji ? <span className="text-base leading-none">{recentEmoji}</span> : <RecentIcon size={16} />}
                          </div>
                          <span className="text-xs font-semibold truncate">{titleOf(tool)}</span>
                        </button>
                      );
                    })}
                  </div>
                  )}
                </div>
              )}

              <div className="space-y-4">
                {!searchQuery && (
                  <div className="flex items-center space-x-3 px-1">
                    <div className="h-px bg-text/10 flex-1"></div>
                    <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{t('Semua Alat', 'All Tools')}</h3>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                )}
                <div className={viewMode === 'list' ? "grid gap-4" : `grid ${gridColClass} gap-4`}>
                  {CORE_TOOLS.filter(matchesSearch).map(tool => (
                    <SortableToolCard
                      key={tool.id}
                      tool={tool}
                      viewMode={viewMode}
                      isReordering={false}
                      forceDisableDrag={true}
                      animationsEnabled={animationsEnabled}
                      isFavorite={favorites.includes(tool.id)}
                      onToggleFavorite={toggleFavorite}
                      onToolClick={handleToolClick}
                    />
                  ))}
                </div>
              </div>

              {/* Lain-lain — the small convenience tools that support the record tools */}
              {EXTRA_TOOLS.some(matchesSearch) && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3 px-1">
                    <div className="h-px bg-text/10 flex-1"></div>
                    <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{t('Lain-lain', 'Others')}</h3>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                  <div className={viewMode === 'list' ? "grid gap-4" : `grid ${gridColClass} gap-4`}>
                    {EXTRA_TOOLS.filter(matchesSearch).map(tool => (
                      <SortableToolCard
                        key={tool.id}
                        tool={tool}
                        viewMode={viewMode}
                        isReordering={false}
                        forceDisableDrag={true}
                        animationsEnabled={animationsEnabled}
                        isFavorite={favorites.includes(tool.id)}
                        onToggleFavorite={toggleFavorite}
                        onToolClick={handleToolClick}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DndContext>

      <PrivacyNote />
    </div>
  );
};

export default Home;
