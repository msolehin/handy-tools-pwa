import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MapPin, ArrowRight, Shield, PieChart, Timer, Wallet,
  Users, Calendar, Landmark, ShieldAlert, Wrench, Plane, Activity,
  List, LayoutGrid, Bell, ArrowUpDown, ShoppingCart, Briefcase, Fuel, Gift, ArrowRightLeft, Banknote, Dices, Repeat, Droplets, Layers, Search, HeartPulse, Car, ListChecks, HandCoins, Utensils, Gauge, ChevronDown, ChevronUp, Sparkles, Heart, ArrowDownAZ, IdCard
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
import { getNextRenewalDate, getDaysUntil } from './SubscriptionTracker';

export const DEFAULT_TOOLS = [
  { 
    id: '/ic-scanner', to: '/ic-scanner', title: 'IC Combiner', desc: 'Scan & generate PDF', Icon: IdCard, category: 'Utilities',
    borderClass: 'hover:border-primary/50 hover:shadow-primary/20', iconBgClass: 'bg-primary/20 text-primary', arrowClass: 'group-hover:text-primary'
  },
  { 
    id: '/parking', to: '/parking', title: 'Parking Locator', desc: 'Save & find your vehicle', Icon: MapPin, category: 'Auto & Travel',
    borderClass: 'hover:border-secondary/50 hover:shadow-secondary/20', iconBgClass: 'bg-secondary/20 text-secondary', arrowClass: 'group-hover:text-secondary'
  },
  { 
    id: '/decision-maker', to: '/decision-maker', title: 'Spin the wheel', desc: 'Make random decisions', Icon: PieChart, category: 'Fun',
    borderClass: 'hover:border-accent/50 hover:shadow-accent/20', iconBgClass: 'bg-accent/20 text-accent', arrowClass: 'group-hover:text-accent'
  },
  { 
    id: '/pace-calculator', to: '/pace-calculator', title: 'Pace Calculator', desc: 'Time, Distance & Pace', Icon: Timer, category: 'Health & Fitness',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  { 
    id: '/affordability', to: '/affordability', title: 'Can I Afford It?', desc: 'Cost vs Income Calculator', Icon: Wallet, category: 'Finance',
    borderClass: 'hover:border-green-400/50 hover:shadow-green-400/20', iconBgClass: 'bg-green-500/20 text-green-400', arrowClass: 'group-hover:text-green-400'
  },
  { 
    id: '/expense-splitter', to: '/expense-splitter', title: 'Expense Splitter', desc: 'Group Bills & Settle Up', Icon: Users, category: 'Finance',
    borderClass: 'hover:border-purple-400/50 hover:shadow-purple-400/20', iconBgClass: 'bg-purple-500/20 text-purple-400', arrowClass: 'group-hover:text-purple-400'
  },
  { 
    id: '/countdown', to: '/countdown', title: 'Countdown Day', desc: 'Track Events & Holidays', Icon: Calendar, category: 'Utilities',
    borderClass: 'hover:border-pink-500/50 hover:shadow-pink-500/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  { 
    id: '/financial-calculators', to: '/financial-calculators', title: 'Financial Hub', desc: 'Loans, savings, and salary tools', Icon: Landmark, category: 'Finance',
    borderClass: 'hover:border-orange-500/50 hover:shadow-orange-500/20', iconBgClass: 'bg-orange-500/20 text-orange-400', arrowClass: 'group-hover:text-orange-400'
  },
  { 
    id: '/document-expiry', to: '/document-expiry', title: 'Document Expiry', desc: 'Track Passport, Roadtax, etc.', Icon: ShieldAlert, category: 'Utilities',
    borderClass: 'hover:border-red-500/50 hover:shadow-red-500/20', iconBgClass: 'bg-red-500/20 text-red-400', arrowClass: 'group-hover:text-red-400'
  },
  { 
    id: '/vehicle-tracker', to: '/vehicle-tracker', title: 'Vehicle Tracker', desc: 'Log Service & Maintenance', Icon: Wrench, category: 'Auto & Travel',
    borderClass: 'hover:border-slate-400/50 hover:shadow-slate-400/20', iconBgClass: 'bg-slate-500/20 text-slate-400', arrowClass: 'group-hover:text-slate-400'
  },
  { 
    id: '/trip-budget', to: '/trip-budget', title: 'Trip Budget', desc: 'Plan Vacation Expenses', Icon: Plane, category: 'Auto & Travel',
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20', iconBgClass: 'bg-cyan-500/20 text-cyan-400', arrowClass: 'group-hover:text-cyan-400'
  },
  { 
    id: '/bmi-calculator', to: '/bmi-calculator', title: 'BMI Calculator', desc: 'Check Health Metrics', Icon: Activity, category: 'Health & Fitness',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  { 
    id: '/grocery-budget', to: '/grocery-budget', title: 'Grocery Budget', desc: 'Track cart total while shopping', Icon: ShoppingCart, category: 'Lifestyle',
    borderClass: 'hover:border-green-400/50 hover:shadow-green-400/20', iconBgClass: 'bg-green-500/20 text-green-400', arrowClass: 'group-hover:text-green-400'
  },
  { 
    id: '/packing-checklist', to: '/packing-checklist', title: 'Packing Checklist', desc: 'Never forget an item again', Icon: Briefcase, category: 'Lifestyle',
    borderClass: 'hover:border-purple-400/50 hover:shadow-purple-400/20', iconBgClass: 'bg-purple-500/20 text-purple-400', arrowClass: 'group-hover:text-purple-400'
  },
  { 
    id: '/fuel-calculator', to: '/fuel-calculator', title: 'Fuel & Tolls', desc: 'Calculate road trip costs', Icon: Fuel, category: 'Auto & Travel',
    borderClass: 'hover:border-orange-400/50 hover:shadow-orange-400/20', iconBgClass: 'bg-orange-500/20 text-orange-400', arrowClass: 'group-hover:text-orange-400'
  },
  { 
    id: '/unit-converter', to: '/unit-converter', title: 'Unit Converter', desc: 'Convert length, weight, temp', Icon: ArrowRightLeft, category: 'Utilities',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  { 
    id: '/currency-converter', to: '/currency-converter', title: 'Currency Converter', desc: 'Live & Offline FX rates', Icon: Banknote, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  { 
    id: '/randomizer', to: '/randomizer', title: 'Randomizer', desc: 'Coin, Dice, Numbers and Bottle', Icon: Dices, category: 'Fun',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  { 
    id: '/subscription-tracker', to: '/subscription-tracker', title: 'Subscriptions', desc: 'Track recurring payments', Icon: Repeat, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  { 
    id: '/water-tracker', to: '/water-tracker', title: 'Drink', desc: 'Hydration with fluid animations', Icon: Droplets, category: 'Health & Fitness',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  { 
    id: '/paycheck-countdown', to: '/paycheck-countdown', title: 'Payday Countdown', desc: 'Live ticking clock to next salary', Icon: Wallet, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  { 
    id: '/emergency-card', to: '/emergency-card', title: 'Medical ID', desc: 'Offline Emergency Info & QR', Icon: HeartPulse, category: 'Health & Fitness',
    borderClass: 'hover:border-rose-500/50 hover:shadow-rose-500/20', iconBgClass: 'bg-rose-500/20 text-rose-500', arrowClass: 'group-hover:text-rose-500'
  },
  { 
    id: '/carpool-splitter', to: '/carpool-splitter', title: 'Carpool Splitter', desc: 'Divide road trip fuel & tolls', Icon: Car, category: 'Auto & Travel',
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20', iconBgClass: 'bg-cyan-500/20 text-cyan-400', arrowClass: 'group-hover:text-cyan-400'
  },
  { 
    id: '/checklists', to: '/checklists', title: 'Checklists', desc: 'Templates & To-Dos', Icon: ListChecks, category: 'Lifestyle',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  { 
    id: '/debt-tracker', to: '/debt-tracker', title: 'Debt Tracker', desc: 'Track Simple IOUs', Icon: HandCoins, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  { 
    id: '/group-split-bill', to: '/group-split-bill', title: 'Group Split Bill', desc: 'Split Group Expenses', Icon: Users, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  { 
    id: 'https://befday.com/', to: 'https://befday.com/', title: 'Birthday Claim', desc: 'Know where to claim birthday (credit dzulhelmynazri)', Icon: Gift, category: 'Fun',
    borderClass: 'hover:border-pink-400/50 hover:shadow-pink-400/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  { 
    id: '/restaurant-splitter', to: '/restaurant-splitter', title: 'Restaurant Bill Splitter', desc: 'Split food & proportional tax', Icon: Utensils, category: 'Finance',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  {
    id: '/speed-test', to: '/speed-test', title: 'Speed Test', desc: 'Check internet ping & speed', Icon: Activity, category: 'Utilities',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/speedometer', to: '/speedometer', title: 'Speedometer', desc: 'GPS Live Speed Tracker', Icon: Gauge, category: 'Utilities',
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20', iconBgClass: 'bg-cyan-500/20 text-cyan-400', arrowClass: 'group-hover:text-cyan-400'
  },
  {
    id: '/duit-raya', to: '/duit-raya', title: 'Duit Raya Manager', desc: 'Plan & track Raya / Angpao money', Icon: Gift, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  }
];

// Tools flagged as "HOT" — shown with a badge and promoted to the top of the list
export const HOT_IDS = ['/ic-scanner', '/decision-maker', '/duit-raya', '/restaurant-splitter'];

const SortableToolCard = ({ tool, sortableId, viewMode, isReordering, forceDisableDrag, animationsEnabled = true, isFavorite, onToggleFavorite, onToolClick }: { tool: typeof DEFAULT_TOOLS[0], sortableId?: string, viewMode: 'list' | 'grid', isReordering: boolean, forceDisableDrag?: boolean, animationsEnabled?: boolean, isFavorite?: boolean, onToggleFavorite?: (id: string) => void, onToolClick?: (id: string) => void }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: sortableId || tool.id, disabled: forceDisableDrag || !isReordering });

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
  const isHot = HOT_IDS.includes(tool.id);

  // Duit Raya / Angpao card swaps its look based on the saved theme
  let displayTitle = tool.title;
  let displayDesc = tool.desc;
  let displayIconBg = tool.iconBgClass;
  let festiveEmoji: string | null = null;
  if (tool.id === '/duit-raya') {
    let drTheme = 'raya';
    try {
      const drStr = localStorage.getItem('duit_raya_manager_data');
      if (drStr) drTheme = JSON.parse(drStr).theme || 'raya';
    } catch (e) {}
    if (drTheme === 'angpao') {
      displayTitle = 'Angpao Manager';
      displayDesc = 'Plan & track CNY packets';
      displayIconBg = 'bg-red-500/20 text-red-400';
      festiveEmoji = '🧧';
    } else {
      displayTitle = 'Duit Raya Manager';
      displayDesc = 'Plan & track Raya money';
      displayIconBg = 'bg-emerald-500/20 text-emerald-400';
      festiveEmoji = '🌙';
    }
  }

  // Calculate water percentage if this is the water tracker tool
  let waterPercentage = 0;
  if (tool.id === '/water-tracker') {
    const waterStr = localStorage.getItem('water_tracker_data');
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

  // Calculate payday percentage
  let paydayPercentage = 0;
  if (tool.id === '/paycheck-countdown') {
    const paydayStr = localStorage.getItem('paycheck_config');
    if (paydayStr) {
      try {
        const config = JSON.parse(paydayStr);
        const t = new Date();
        t.setHours(0, 0, 0, 0);
        let nextDate;
        let cycleDays = 30;
        if (config.type === 'monthly') {
          nextDate = new Date(t.getFullYear(), t.getMonth(), config.dayOfMonth);
          if (t.getTime() >= nextDate.getTime()) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
        } else {
          cycleDays = 14;
          const ref = new Date(config.referenceDate);
          ref.setHours(0, 0, 0, 0);
          if (t.getTime() < ref.getTime()) {
            nextDate = ref;
          } else {
            const msPer14Days = 14 * 24 * 60 * 60 * 1000;
            const diff = t.getTime() - ref.getTime();
            const periodsPassed = Math.floor(diff / msPer14Days);
            nextDate = new Date(ref.getTime() + (periodsPassed + 1) * msPer14Days);
          }
        }
        nextDate.setHours(0, 0, 0, 0);
        const diffTime = nextDate.getTime() - t.getTime();
        const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        paydayPercentage = Math.max(0, Math.min(100, 100 - (daysLeft / cycleDays) * 100));
      } catch (e) {}
    }
  }

  // Calculate debt total
  let debtTotal = 0;
  if (tool.id === '/debt-tracker') {
    const debtStr = localStorage.getItem('debt_tracker_ious');
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
            {paydayPercentage > 0 && (
              <div 
                className="absolute top-0 left-0 bottom-0 bg-emerald-500/10 transition-all duration-1000 ease-out z-0 border-r border-emerald-500/30 overflow-hidden" 
                style={{ width: `${paydayPercentage}%`, minWidth: '5%' }} 
              >
                <div className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent shimmer-anim" />
                <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-emerald-500/20" />
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
            {animationsEnabled && tool.id === '/trip-budget' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-50 text-cyan-400">
                <div className="wind-line wind-1" />
                <div className="wind-line wind-2" />
                <div className="wind-line wind-3" />
                <div className="absolute top-[30%] right-0 text-2xl flight-anim drop-shadow-md">✈️</div>
              </div>
            )}
            {animationsEnabled && tool.id === '/speedometer' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-30">
                <div className="absolute bottom-[20%] left-[50%] w-1 h-[40%] bg-rose-500 rounded-t-full needle-anim drop-shadow-sm -translate-x-1/2" />
                <div className="absolute bottom-[18%] left-[50%] w-3 h-3 bg-rose-600 rounded-full -translate-x-1/2" />
              </div>
            )}
            {animationsEnabled && tool.id === '/speed-test' && (
              <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none text-blue-500">
                <div className="absolute bottom-0 left-0 right-0 h-1/2 speed-graph-anim" />
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
                  {isHot && (
                    <span className="ml-2 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-orange-500 text-white shadow-sm animate-pulse">HOT!!</span>
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
          {isHot && (
            <span className="absolute top-2 left-2 z-20 px-1.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wide bg-orange-500 text-white shadow-sm animate-pulse">HOT!!</span>
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
          {paydayPercentage > 0 && (
            <div 
              className="absolute top-0 left-0 bottom-0 bg-emerald-500/10 transition-all duration-1000 ease-out z-0 border-r border-emerald-500/30 overflow-hidden" 
              style={{ width: `${paydayPercentage}%`, minWidth: '5%' }} 
            >
              <div className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent shimmer-anim" />
              <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-emerald-500/20" />
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
          {animationsEnabled && tool.id === '/trip-budget' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-50 text-cyan-400">
              <div className="wind-line wind-1" />
              <div className="wind-line wind-2" />
              <div className="wind-line wind-3" />
              <div className="absolute top-[40%] right-0 text-3xl flight-anim drop-shadow-md">✈️</div>
            </div>
          )}
          {animationsEnabled && tool.id === '/speedometer' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none opacity-30">
              <div className="absolute bottom-[20%] left-[50%] w-1 h-[40%] bg-rose-500 rounded-t-full needle-anim drop-shadow-sm -translate-x-1/2" />
              <div className="absolute bottom-[18%] left-[50%] w-3 h-3 bg-rose-600 rounded-full -translate-x-1/2" />
            </div>
          )}
          {animationsEnabled && tool.id === '/speed-test' && (
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none text-blue-500">
              <div className="absolute bottom-0 left-0 right-0 h-1/2 speed-graph-anim" />
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
  type: 'document' | 'event' | 'subscription' | 'payday' | 'water' | 'debt';
  title: string;
  daysLeft: number;
  to: string;
  percentage?: number;
}

const waveSvg1 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 88.7'%3E%3Cpath d='M800 56.9c-155.5 0-204.9-50-405.5-49.9-200 0-250 49.9-394.5 49.9v31.8h800v-.2-31.6z' fill='%2360a5fa' opacity='0.4'/%3E%3C/svg%3E`;
const waveSvg2 = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 88.7'%3E%3Cpath d='M800 56.9c-155.5 0-204.9-50-405.5-49.9-200 0-250 49.9-394.5 49.9v31.8h800v-.2-31.6z' fill='%233b82f6' opacity='0.6'/%3E%3C/svg%3E`;

const Home: React.FC = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'category' | 'alphabet'>(() => {
    return (localStorage.getItem('home_view_mode') as 'list' | 'grid' | 'category' | 'alphabet') || 'list';
  });
  const [isReordering, setIsReordering] = useState(false);
  const [animationsEnabled, setAnimationsEnabled] = useState(() => {
    const saved = localStorage.getItem('handy-animations');
    return saved ? JSON.parse(saved) : true;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);

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

  // Publish alerts so the Layout bottom bar can show them as notifications
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('home:alerts', { detail: alerts }));
  }, [alerts]);

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

  const [tools, setTools] = useState(() => {
    const savedOrder = localStorage.getItem('home_tool_order');
    let base = DEFAULT_TOOLS as typeof DEFAULT_TOOLS;
    if (savedOrder) {
      const orderIds = JSON.parse(savedOrder);
      // Reconstruct the array based on saved IDs
      const orderedTools = orderIds
        .map((id: string) => DEFAULT_TOOLS.find(t => t.id === id))
        .filter(Boolean);

      // Append any new tools that aren't in the saved order yet
      const newTools = DEFAULT_TOOLS.filter(t => !orderIds.includes(t.id));
      base = [...orderedTools, ...newTools];
    }

    // One-time promotion: move HOT tools to the top (respects manual reordering afterwards)
    if (!localStorage.getItem('hot_tools_promoted_v2')) {
      const hot = HOT_IDS.map(id => base.find(t => t.id === id)).filter(Boolean) as typeof DEFAULT_TOOLS;
      const rest = base.filter(t => !HOT_IDS.includes(t.id));
      base = [...hot, ...rest];
      localStorage.setItem('hot_tools_promoted_v2', '1');
    }
    return base;
  });

  useEffect(() => {
    localStorage.setItem('home_view_mode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem('home_tool_order', JSON.stringify(tools.map(t => t.id)));
  }, [tools]);

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
    const docsStr = localStorage.getItem('de_documents');
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
    const eventsStr = localStorage.getItem('cd_events');
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

    // 3. Subscriptions (Upcoming in next 3 days)
    const subsStr = localStorage.getItem('sub_tracker_data');
    if (subsStr) {
      try {
        const subs = JSON.parse(subsStr);
        subs.forEach((sub: any) => {
          const nextDate = getNextRenewalDate(sub.startDate, sub.cycle);
          const days = getDaysUntil(nextDate);
          
          if (days >= 0 && days <= 3) {
            newAlerts.push({
              id: `sub-${sub.id}`,
              type: 'subscription',
              title: `${sub.name} (RM${sub.price})`,
              daysLeft: days,
              to: '/subscription-tracker'
            });
          }
        });
      } catch (e) {}
    }

    // 4. Payday Countdown
    const paydayStr = localStorage.getItem('paycheck_config');
    if (paydayStr) {
      try {
        const config = JSON.parse(paydayStr);
        const getNextPayday = (conf: any) => {
          const t = new Date();
          if (conf.type === 'monthly') {
            const candidate = new Date(t.getFullYear(), t.getMonth(), conf.dayOfMonth);
            if (t.getTime() >= candidate.getTime()) {
              candidate.setMonth(candidate.getMonth() + 1);
            }
            return candidate;
          } else {
            const ref = new Date(conf.referenceDate);
            ref.setHours(0, 0, 0, 0);
            if (t.getTime() < ref.getTime()) return ref;
            const msPer14Days = 14 * 24 * 60 * 60 * 1000;
            const diff = t.getTime() - ref.getTime();
            const periodsPassed = Math.floor(diff / msPer14Days);
            return new Date(ref.getTime() + (periodsPassed + 1) * msPer14Days);
          }
        };
        const nextDate = getNextPayday(config);
        const days = getDaysLeft(nextDate.toISOString().split('T')[0]);
        if (days >= 0 && days <= 7) {
          const cycleDays = config.type === 'monthly' ? 30 : 14;
          const percentage = Math.max(0, Math.min(100, 100 - (days / cycleDays) * 100));
          newAlerts.push({
            id: 'payday',
            type: 'payday',
            title: `Next in ${days} Days`,
            daysLeft: days,
            percentage,
            to: '/paycheck-countdown'
          });
        }
      } catch (e) {}
    }

    // 5. Water Tracker
    const waterStr = localStorage.getItem('water_tracker_data');
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
    const debtStr = localStorage.getItem('debt_tracker_ious');
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

    newAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
    setAlerts(newAlerts);
  }, []);

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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Reordering within the Favorites section (ids are prefixed with "fav-")
    if (activeId.startsWith('fav-') && overId.startsWith('fav-')) {
      const aId = activeId.slice(4);
      const oId = overId.slice(4);
      setFavorites((items) => {
        const oldIndex = items.indexOf(aId);
        const newIndex = items.indexOf(oId);
        if (oldIndex === -1 || newIndex === -1) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
      return;
    }

    setTools((items) => {
      const oldIndex = items.findIndex(t => t.id === activeId);
      const newIndex = items.findIndex(t => t.id === overId);
      if (oldIndex === -1 || newIndex === -1) return items;
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  // Theme-aware title for the Duit Raya / Angpao tool (used for alphabet sort & search)
  const duitRayaTitle = (() => {
    try {
      const s = localStorage.getItem('duit_raya_manager_data');
      if (s && JSON.parse(s).theme === 'angpao') return 'Angpao Manager';
    } catch (e) {}
    return 'Duit Raya Manager';
  })();
  const titleOf = (tool: typeof DEFAULT_TOOLS[0]) => (tool.id === '/duit-raya' ? duitRayaTitle : tool.title);

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
        <div className="mt-4 mb-2 space-y-3">
          <div 
            className="flex items-center justify-between text-text/80 mb-2 px-1 cursor-pointer hover:text-text transition-colors"
            onClick={() => setIsAlertsExpanded(!isAlertsExpanded)}
          >
            <div className="flex items-center space-x-2">
              <Bell size={18} className="text-yellow-400 animate-pulse" />
              <h3 className="font-bold text-sm">Action Needed <span className="text-muted text-xs font-normal ml-1">({alerts.length})</span></h3>
            </div>
            <button className="p-1 rounded-full bg-text/5 hover:bg-text/10 text-muted transition-colors">
              {isAlertsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          <div className={`flex gap-3 pb-2 transition-all ${isAlertsExpanded ? 'flex-col' : 'overflow-x-auto custom-scrollbar snap-x'}`}>
            {alerts.map(alert => (
              <div 
                key={alert.id}
                onClick={() => navigate(alert.to)}
                className={`shrink-0 cursor-pointer p-4 rounded-2xl border transition-all hover:scale-[1.02] relative overflow-hidden ${
                  isAlertsExpanded ? 'w-full' : 'w-[220px] snap-start'
                } ${
                  alert.type === 'document' 
                    ? alert.daysLeft < 0 
                      ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                      : 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                    : alert.type === 'subscription'
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                      : alert.type === 'payday'
                        ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_15px_rgba(52,211,153,0.15)]'
                        : alert.type === 'water'
                          ? 'bg-blue-500/10 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)]'
                          : alert.type === 'debt'
                            ? 'bg-rose-500/10 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.15)]'
                            : 'bg-pink-500/10 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]'
                }`}
              >
                {animationsEnabled && alert.type === 'document' && (
                  <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
                    <div 
                      className={`absolute left-0 right-0 h-[2px] blur-[1px] scan-line-anim ${
                        alert.daysLeft < 0 ? 'bg-red-500 shadow-[0_0_12px_rgba(239,68,68,1)]' : 'bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,1)]'
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
                {animationsEnabled && alert.type === 'payday' && alert.percentage !== undefined && alert.percentage > 0 && (
                  <div 
                    className="absolute top-0 left-0 bottom-0 bg-emerald-500/10 transition-all duration-1000 ease-out z-0 border-r border-emerald-500/30 overflow-hidden" 
                    style={{ width: `${alert.percentage}%`, minWidth: '5%' }} 
                  >
                    <div className="absolute top-0 bottom-0 w-1/2 bg-gradient-to-r from-transparent via-emerald-400/20 to-transparent shimmer-anim" />
                    <div className="absolute top-0 right-0 bottom-0 w-8 bg-gradient-to-r from-transparent to-emerald-500/20" />
                  </div>
                )}
                {animationsEnabled && alert.type === 'debt' && (
                  <div className="absolute inset-0 stripes-anim opacity-70 z-0" />
                )}
                
                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center space-x-2 mb-2">
                    {alert.type === 'document' ? (
                      <ShieldAlert size={20} className={alert.daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'} />
                    ) : alert.type === 'subscription' ? (
                      <Repeat size={20} className="text-indigo-400" />
                    ) : alert.type === 'payday' ? (
                      <Wallet size={20} className="text-emerald-400" />
                    ) : alert.type === 'water' ? (
                      <Droplets size={20} className="text-blue-400" />
                    ) : alert.type === 'debt' ? (
                      <HandCoins size={20} className="text-rose-400" />
                    ) : (
                      <Calendar size={20} className="text-pink-400" />
                    )}
                    <span className="text-[10px] font-bold text-text/60 uppercase tracking-wider">{alert.type}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 pr-4 relative z-10">
                  <p className="font-bold text-[13px] text-text truncate leading-tight mb-1">
                    {alert.type === 'document' ? 'Renew: ' : alert.type === 'subscription' ? 'Due: ' : alert.type === 'payday' ? 'Payday: ' : alert.type === 'water' ? 'Water: ' : alert.type === 'debt' ? 'Owe: ' : ''}{alert.title}
                  </p>
                  <p className={`text-[11px] font-medium leading-none ${
                    alert.type === 'document' 
                      ? alert.daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'
                      : alert.type === 'subscription' ? 'text-indigo-400'
                      : alert.type === 'payday' ? 'text-emerald-400'
                      : alert.type === 'water' ? 'text-blue-400' 
                      : alert.type === 'debt' ? 'text-rose-400'
                      : 'text-pink-400'
                  }`}>
                    {alert.type === 'water' ? 'Drink up!' : alert.type === 'debt' ? 'Action Required' : alert.daysLeft < 0 
                      ? `Expired ${Math.abs(alert.daysLeft)} days ago` 
                      : alert.daysLeft === 0 
                        ? 'Today!' 
                        : `${alert.daysLeft} Days Left`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-end justify-between mt-4 mb-4">
        <section>
          <h2 className="text-3xl font-bold mb-1">Welcome</h2>
          <p className="text-muted text-sm pr-4">Select a tool below to get started. Works fully offline.</p>
        </section>
        <div className="flex flex-col items-end space-y-2">
            {/* Reorder Button */}
            <div className="flex items-center space-x-2">
              {!searchQuery && (
                <button
                  onClick={() => {
                    const next = !animationsEnabled;
                    setAnimationsEnabled(next);
                    showToast(next ? '✨ Animations on' : '⏸️ Animations off');
                  }}
                  className={`p-2 rounded-xl transition-all border flex items-center justify-center active:scale-90 ${
                    animationsEnabled
                      ? 'bg-blue-500/20 border-blue-500/50 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.3)]'
                      : 'bg-surface border-text/10 text-muted hover:bg-text/5 hover:text-text'
                  }`}
                  title="Toggle Animations"
                >
                  <Sparkles size={20} className={animationsEnabled ? 'animate-pulse' : ''} />
                </button>
              )}
              {viewMode !== 'category' && viewMode !== 'alphabet' && !searchQuery && (
                <button
                  onClick={() => setIsReordering(!isReordering)}
                  className={`p-2 rounded-xl transition-all border flex items-center justify-center ${
                    isReordering 
                      ? 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.3)]' 
                      : 'bg-surface border-text/10 text-muted hover:bg-text/5 hover:text-text'
                  }`}
                  title="Reorder Tools"
                >
                  <ArrowUpDown size={20} className={isReordering ? 'animate-pulse' : ''} />
                </button>
              )}
            </div>
             

            {/* View Mode Toggle */}
            <div className="flex bg-text/5 p-1 rounded-xl">
              <button
                onClick={() => { setViewMode('list'); showToast('📋 List view'); }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'list' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="List View"
              >
                <List size={18} />
              </button>
              <button
                onClick={() => { setViewMode('grid'); showToast('▦ Grid view'); }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'grid' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => {
                  setViewMode('category');
                  setIsReordering(false); // disable reordering in category mode
                  showToast('🗂️ Category view');
                }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'category' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="Category View"
              >
                <Layers size={18} />
              </button>
              <button
                onClick={() => {
                  setViewMode('alphabet');
                  setIsReordering(false); // disable reordering in alphabet mode
                  showToast('🔤 Sorted A–Z');
                }}
                className={`p-2 rounded-lg transition-all active:scale-90 ${viewMode === 'alphabet' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="Sort A–Z"
              >
                <ArrowDownAZ size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-muted" />
          </div>
          <input 
            type="text" 
            placeholder="Search tools..." 
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
            <span>Drag &amp; drop tools to reorder them. Tap the button again when you're done.</span>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          {viewMode === 'category' ? (
            <div className="space-y-8 animate-fade-in">
              {Array.from(new Set(tools.map(t => t.category))).map(cat => {
                const catTools = tools.filter(t => 
                  t.category === cat && 
                  (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                   t.desc.toLowerCase().includes(searchQuery.toLowerCase()))
                );
                
                if (catTools.length === 0) return null;

                return (
                  <div key={cat!} className="space-y-4">
                    <div className="flex items-center space-x-3 px-1">
                      <div className="h-px bg-text/10 flex-1"></div>
                      <h3 className="text-sm font-bold text-muted uppercase tracking-widest">{cat}</h3>
                      <div className="h-px bg-text/10 flex-1"></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <h3 className="text-sm font-bold text-muted uppercase tracking-widest">All Tools (A–Z)</h3>
                <div className="h-px bg-text/10 flex-1"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[...tools]
                  .filter(t => titleOf(t).toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase()))
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
                    <h3 className="text-sm font-bold text-muted uppercase tracking-widest">❤️ Favorites</h3>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                  <div className={viewMode === 'list' ? "grid gap-4" : "grid grid-cols-2 md:grid-cols-3 gap-4"}>
                    <SortableContext
                      items={favorites.map(id => `fav-${id}`)}
                      strategy={rectSortingStrategy}
                    >
                    {favorites.map(id => {
                      const tool = tools.find(t => t.id === id) || DEFAULT_TOOLS.find(t => t.id === id);
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
                      🕒 Recent Tools
                      <span className={`transition-transform duration-200 ${recentMinimized ? '' : 'rotate-180'}`}>▾</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecentTools([])}
                      className="text-[10px] font-bold text-muted uppercase tracking-widest hover:text-red-500 transition-colors"
                      title="Clear recent tools"
                    >
                      Clear
                    </button>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                  {!recentMinimized && (
                  <div className="grid grid-cols-2 gap-2">
                    {recentTools.map(id => {
                      const tool = tools.find(t => t.id === id) || DEFAULT_TOOLS.find(t => t.id === id);
                      if (!tool) return null;
                      const RecentIcon = tool.Icon;
                      const isDuitRaya = tool.id === '/duit-raya';
                      const recentEmoji = isDuitRaya ? (duitRayaTitle === 'Angpao Manager' ? '🧧' : '🌙') : null;
                      const recentIconBg = isDuitRaya
                        ? (duitRayaTitle === 'Angpao Manager' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400')
                        : tool.iconBgClass;
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
                {!searchQuery && (favorites.length > 0 || recentTools.length > 0) && (
                  <div className="flex items-center space-x-3 px-1">
                    <div className="h-px bg-text/10 flex-1"></div>
                    <h3 className="text-sm font-bold text-muted uppercase tracking-widest">All Tools</h3>
                    <div className="h-px bg-text/10 flex-1"></div>
                  </div>
                )}
                <div className={viewMode === 'list' ? "grid gap-4" : "grid grid-cols-2 md:grid-cols-3 gap-4"}>
              <SortableContext 
                items={tools
                  .filter(t => t.id !== 'https://befday.com/' && (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase())))
                  .map(t => t.id)}
                strategy={rectSortingStrategy}
              >
                {tools
                  .filter(t => t.id !== 'https://befday.com/' && (t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.desc.toLowerCase().includes(searchQuery.toLowerCase())))
                  .map(tool => (
                    <SortableToolCard 
                      key={tool.id} 
                      tool={tool} 
                      viewMode={viewMode} 
                      isReordering={isReordering} 
                      animationsEnabled={animationsEnabled} 
                      isFavorite={favorites.includes(tool.id)}
                      onToggleFavorite={toggleFavorite}
                      onToolClick={handleToolClick}
                    />
                  ))}
              </SortableContext>
              
              {/* Birthday Claim at the end if it matches search */}
              {(tools.find(t => t.id === 'https://befday.com/') || DEFAULT_TOOLS.find(t => t.id === 'https://befday.com/')) && 
               DEFAULT_TOOLS.find(t => t.id === 'https://befday.com/')?.title.toLowerCase().includes(searchQuery.toLowerCase()) && (
                <SortableToolCard 
                  key="https://befday.com/" 
                  tool={DEFAULT_TOOLS.find(t => t.id === 'https://befday.com/')!} 
                  viewMode={viewMode} 
                  isReordering={false} 
                  forceDisableDrag={true}
                  animationsEnabled={animationsEnabled} 
                  isFavorite={favorites.includes('https://befday.com/')}
                  onToggleFavorite={toggleFavorite}
                  onToolClick={handleToolClick}
                />
              )}
                </div>
              </div>
            </div>
          )}
        </DndContext>

      <div className="mt-8 p-5 bg-primary/5 border border-primary/10 rounded-2xl">
        <div className="flex items-start space-x-4">
          <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
            <Shield className="text-primary" size={24} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-text/90 mb-1.5">100% Private & Local</h4>
            <p className="text-xs text-muted leading-relaxed">
              Designed as a quick, zero-setup tool to solve your problem in under a minute, no login required. 
              All processing happens entirely on your device, and no data is ever sent to a server. 
              Everything is stored locally in your browser, meaning your data will be permanently removed if you clear your browser cache.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
