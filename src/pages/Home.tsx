import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileImage, MapPin, ArrowRight, Shield, PieChart, Timer, Wallet, 
  Users, Calendar, Landmark, ShieldAlert, Wrench, Plane, Activity,
  List, LayoutGrid, Bell, ArrowUpDown, ShoppingCart, Briefcase, Fuel, Gift, ArrowRightLeft, Banknote, Dices, Repeat, Droplets, Layers, Search, HeartPulse, Car, ListChecks, HandCoins, Utensils, Gauge
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
    id: '/ic-scanner', to: '/ic-scanner', title: 'IC Combiner', desc: 'Scan & generate PDF', Icon: FileImage, category: 'Utilities',
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
    id: '/randomizer', to: '/randomizer', title: 'Randomizer', desc: 'Coin, Dice, and Numbers', Icon: Dices, category: 'Fun',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  { 
    id: '/subscription-tracker', to: '/subscription-tracker', title: 'Subscriptions', desc: 'Track recurring payments', Icon: Repeat, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  { 
    id: '/water-tracker', to: '/water-tracker', title: 'Water Tracker', desc: 'Hydration with fluid animations', Icon: Droplets, category: 'Health & Fitness',
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
  }
];

const SortableToolCard = ({ tool, viewMode, isReordering, forceDisableDrag }: { tool: typeof DEFAULT_TOOLS[0], viewMode: 'list' | 'grid', isReordering: boolean, forceDisableDrag?: boolean }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tool.id, disabled: forceDisableDrag || !isReordering });

  const navigate = useNavigate();
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isReordering) setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handleNavigation = () => {
    if (tool.to.startsWith('http')) {
      window.open(tool.to, '_blank', 'noopener,noreferrer');
    } else {
      navigate(tool.to);
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isReordering && startPos) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If pointer moved less than 10px, treat it as a click
      if (distance < 10) {
        handleNavigation();
      }
    } else if (!isReordering) {
      handleNavigation();
    }
    setStartPos(null);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    ...(isReordering && isDragging ? { touchAction: 'none' } : {})
  };

  const Icon = tool.Icon;
  
  // Choose which props to pass for drag
  const dragProps = isReordering ? { ...attributes, ...listeners } : {};

  if (viewMode === 'list') {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...dragProps}
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
      >
        <div className={`block group ${isReordering ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
          <div className={`glass-panel p-6 flex items-center justify-between transition-all duration-300 ${tool.borderClass}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${tool.iconBgClass}`}>
                <Icon size={28} />
              </div>
              <div>
                <h3 className="font-bold text-lg mb-1">{tool.title}</h3>
                <p className="text-sm text-muted">{tool.desc}</p>
              </div>
            </div>
            <ArrowRight className={`text-muted transition-colors ${tool.arrowClass}`} />
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
      onPointerDownCapture={handlePointerDown}
      onPointerUpCapture={handlePointerUp}
    >
      <div className={`block h-full group ${isReordering ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}>
        <div className={`glass-panel p-5 flex flex-col items-center justify-center text-center h-full transition-all duration-300 ${tool.borderClass}`}>
          <div className={`p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform ${tool.iconBgClass}`}>
            <Icon size={32} />
          </div>
          <h3 className="font-bold text-sm leading-tight">{tool.title}</h3>
        </div>
      </div>
    </div>
  );
};

interface AlertItem {
  id: string;
  type: 'document' | 'event' | 'subscription';
  title: string;
  daysLeft: number;
  to: string;
}

const Home: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'grid' | 'category'>(() => {
    return (localStorage.getItem('home_view_mode') as 'list' | 'grid' | 'category') || 'list';
  });
  const [isReordering, setIsReordering] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<AlertItem[]>([]);

  const [tools, setTools] = useState(() => {
    const savedOrder = localStorage.getItem('home_tool_order');
    if (savedOrder) {
      const orderIds = JSON.parse(savedOrder);
      // Reconstruct the array based on saved IDs
      const orderedTools = orderIds
        .map((id: string) => DEFAULT_TOOLS.find(t => t.id === id))
        .filter(Boolean);
      
      // Append any new tools that aren't in the saved order yet
      const newTools = DEFAULT_TOOLS.filter(t => !orderIds.includes(t.id));
      return [...orderedTools, ...newTools];
    }
    return DEFAULT_TOOLS;
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

    if (over && active.id !== over.id) {
      setTools((items) => {
        const oldIndex = items.findIndex(t => t.id === active.id);
        const newIndex = items.findIndex(t => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="mt-4 mb-2 space-y-3">
          <div className="flex items-center space-x-2 text-text/80 mb-2 px-1">
            <Bell size={18} className="text-yellow-400 animate-pulse" />
            <h3 className="font-bold text-sm">Action Needed</h3>
          </div>
          <div className="flex overflow-x-auto gap-3 pb-2 custom-scrollbar snap-x">
            {alerts.map(alert => (
              <div 
                key={alert.id}
                onClick={() => navigate(alert.to)}
                className={`shrink-0 w-[220px] snap-start cursor-pointer p-4 rounded-2xl border transition-all hover:scale-[1.02] ${
                  alert.type === 'document' 
                    ? alert.daysLeft < 0 
                      ? 'bg-red-500/10 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)]' 
                      : 'bg-yellow-500/10 border-yellow-500/30 shadow-[0_0_15px_rgba(234,179,8,0.1)]'
                    : alert.type === 'subscription'
                      ? 'bg-indigo-500/10 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                      : 'bg-pink-500/10 border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2 mb-2">
                    {alert.type === 'document' ? (
                      <ShieldAlert size={20} className={alert.daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'} />
                    ) : alert.type === 'subscription' ? (
                      <Repeat size={20} className="text-indigo-400" />
                    ) : (
                      <Calendar size={20} className="text-pink-400" />
                    )}
                    <span className="text-[10px] font-bold text-text/60 uppercase tracking-wider">{alert.type}</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0 pr-4">
                  <p className="font-bold text-[13px] text-text truncate leading-tight mb-1">
                    {alert.type === 'document' ? 'Renew: ' : alert.type === 'subscription' ? 'Due: ' : ''}{alert.title}
                  </p>
                  <p className={`text-[11px] font-medium leading-none ${
                    alert.type === 'document' 
                      ? alert.daysLeft < 0 ? 'text-red-400' : 'text-yellow-400'
                      : alert.type === 'subscription' ? 'text-indigo-400' : 'text-pink-400'
                  }`}>
                    {alert.daysLeft < 0 
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
            {viewMode !== 'category' && !searchQuery && (
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

            {/* View Mode Toggle */}
            <div className="flex bg-text/5 p-1 rounded-xl">
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="List View"
              >
                <List size={18} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => {
                  setViewMode('category');
                  setIsReordering(false); // disable reordering in category mode
                }}
                className={`p-2 rounded-lg transition-all ${viewMode === 'category' ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'}`}
                title="Category View"
              >
                <Layers size={18} />
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
                        <SortableToolCard key={tool.id} tool={tool} viewMode="grid" isReordering={false} forceDisableDrag={true} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
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
                    <SortableToolCard key={tool.id} tool={tool} viewMode={viewMode} isReordering={isReordering} />
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
                />
              )}
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
