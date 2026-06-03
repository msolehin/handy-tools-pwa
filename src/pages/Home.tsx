import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileImage, MapPin, ArrowRight, Shield, PieChart, Timer, Wallet, 
  Users, Calendar, Landmark, ShieldAlert, Wrench, Plane, Activity,
  List, LayoutGrid
} from 'lucide-react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DEFAULT_TOOLS = [
  { 
    id: '/ic-scanner', to: '/ic-scanner', title: 'IC Combiner', desc: 'Scan & generate PDF', Icon: FileImage, 
    borderClass: 'hover:border-primary/50 hover:shadow-primary/20',
    iconBgClass: 'bg-primary/20 text-primary',
    arrowClass: 'group-hover:text-primary'
  },
  { 
    id: '/parking', to: '/parking', title: 'Parking Locator', desc: 'Save & find your vehicle', Icon: MapPin, 
    borderClass: 'hover:border-secondary/50 hover:shadow-secondary/20',
    iconBgClass: 'bg-secondary/20 text-secondary',
    arrowClass: 'group-hover:text-secondary'
  },
  { 
    id: '/decision-maker', to: '/decision-maker', title: 'Random Decision Maker', desc: 'Spin the wheel to decide', Icon: PieChart, 
    borderClass: 'hover:border-accent/50 hover:shadow-accent/20',
    iconBgClass: 'bg-accent/20 text-accent',
    arrowClass: 'group-hover:text-accent'
  },
  { 
    id: '/pace-calculator', to: '/pace-calculator', title: 'Pace Calculator', desc: 'Time, Distance & Pace', Icon: Timer, 
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20',
    iconBgClass: 'bg-blue-500/20 text-blue-400',
    arrowClass: 'group-hover:text-blue-400'
  },
  { 
    id: '/affordability', to: '/affordability', title: 'Can I Afford It?', desc: 'Cost vs Income Calculator', Icon: Wallet, 
    borderClass: 'hover:border-green-400/50 hover:shadow-green-400/20',
    iconBgClass: 'bg-green-500/20 text-green-400',
    arrowClass: 'group-hover:text-green-400'
  },
  { 
    id: '/expense-splitter', to: '/expense-splitter', title: 'Expense Splitter', desc: 'Group Bills & Settle Up', Icon: Users, 
    borderClass: 'hover:border-purple-400/50 hover:shadow-purple-400/20',
    iconBgClass: 'bg-purple-500/20 text-purple-400',
    arrowClass: 'group-hover:text-purple-400'
  },
  { 
    id: '/countdown', to: '/countdown', title: 'Countdown Day', desc: 'Track Events & Holidays', Icon: Calendar, 
    borderClass: 'hover:border-pink-500/50 hover:shadow-pink-500/20',
    iconBgClass: 'bg-pink-500/20 text-pink-400',
    arrowClass: 'group-hover:text-pink-400'
  },
  { 
    id: '/loan-calculator', to: '/loan-calculator', title: 'Loan Calculator', desc: 'Estimate Auto & Home Loans', Icon: Landmark, 
    borderClass: 'hover:border-orange-500/50 hover:shadow-orange-500/20',
    iconBgClass: 'bg-orange-500/20 text-orange-400',
    arrowClass: 'group-hover:text-orange-400'
  },
  { 
    id: '/document-expiry', to: '/document-expiry', title: 'Document Expiry', desc: 'Track Passport, Roadtax, etc.', Icon: ShieldAlert, 
    borderClass: 'hover:border-red-500/50 hover:shadow-red-500/20',
    iconBgClass: 'bg-red-500/20 text-red-400',
    arrowClass: 'group-hover:text-red-400'
  },
  { 
    id: '/vehicle-tracker', to: '/vehicle-tracker', title: 'Vehicle Tracker', desc: 'Log Service & Maintenance', Icon: Wrench, 
    borderClass: 'hover:border-slate-400/50 hover:shadow-slate-400/20',
    iconBgClass: 'bg-slate-500/20 text-slate-400',
    arrowClass: 'group-hover:text-slate-400'
  },
  { 
    id: '/trip-budget', to: '/trip-budget', title: 'Trip Budget', desc: 'Plan Vacation Expenses', Icon: Plane, 
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20',
    iconBgClass: 'bg-cyan-500/20 text-cyan-400',
    arrowClass: 'group-hover:text-cyan-400'
  },
  { 
    id: '/bmi-calculator', to: '/bmi-calculator', title: 'BMI Calculator', desc: 'Check Health Metrics', Icon: Activity, 
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20',
    iconBgClass: 'bg-emerald-500/20 text-emerald-400',
    arrowClass: 'group-hover:text-emerald-400'
  },
];

const SortableToolCard = ({ tool, viewMode }: { tool: typeof DEFAULT_TOOLS[0], viewMode: 'list' | 'grid' }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: tool.id });

  const navigate = useNavigate();
  const [startPos, setStartPos] = useState<{x: number, y: number} | null>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    setStartPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (startPos) {
      const dx = e.clientX - startPos.x;
      const dy = e.clientY - startPos.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // If pointer moved less than 10px, treat it as a click
      if (distance < 10) {
        navigate(tool.to);
      }
    }
    setStartPos(null);
  };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
    touchAction: 'none' // Prevent scrolling when dragging
  };

  const Icon = tool.Icon;
  
  if (viewMode === 'list') {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners}
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
      >
        <div className="block group cursor-pointer">
          <div className={`glass-panel p-6 flex items-center justify-between transition-all duration-300 ${tool.borderClass}`}>
            <div className="flex items-center space-x-4">
              <div className={`p-3 rounded-xl group-hover:scale-110 transition-transform ${tool.iconBgClass}`}>
                <Icon size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{tool.title}</h3>
                <p className="text-sm text-muted">{tool.desc}</p>
              </div>
            </div>
            <ArrowRight className={`text-muted transition-colors ${tool.arrowClass}`} />
          </div>
        </div>
      </div>
    );
  } else {
    return (
      <div 
        ref={setNodeRef} 
        style={style} 
        {...attributes} 
        {...listeners} 
        className="h-full"
        onPointerDownCapture={handlePointerDown}
        onPointerUpCapture={handlePointerUp}
      >
        <div className="block group cursor-pointer h-full">
          <div className={`glass-panel p-5 flex flex-col items-center justify-center text-center h-full transition-all duration-300 ${tool.borderClass}`}>
            <div className={`p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform ${tool.iconBgClass}`}>
              <Icon size={32} />
            </div>
            <h3 className="text-sm font-bold mb-1 leading-tight">{tool.title}</h3>
            <p className="text-[10px] text-muted leading-tight">{tool.desc}</p>
          </div>
        </div>
      </div>
    );
  }
};

const Home: React.FC = () => {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    return (localStorage.getItem('home_view_mode') as 'list' | 'grid') || 'list';
  });

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

  const sensors = useSensors(
    useSensor(PointerSensor, {
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
      <div className="flex items-start justify-between mt-4 mb-6">
        <section>
          <h2 className="text-3xl font-bold mb-1">Welcome</h2>
          <p className="text-muted text-sm pr-4">Select a tool below to get started. Works fully offline.</p>
        </section>
        <div className="flex space-x-1 shrink-0 bg-black/20 p-1 rounded-xl">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'}`}
          >
            <List size={20} />
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-primary/20 text-primary' : 'text-muted hover:text-white'}`}
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </div>

      <DndContext 
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <div className={viewMode === 'list' ? "grid gap-4" : "grid grid-cols-2 md:grid-cols-3 gap-4"}>
          <SortableContext 
            items={tools.map(t => t.id)}
            strategy={rectSortingStrategy}
          >
            {tools.map(tool => (
              <SortableToolCard key={tool.id} tool={tool} viewMode={viewMode} />
            ))}
          </SortableContext>
        </div>
      </DndContext>

      <div className="mt-8 p-5 bg-primary/5 border border-primary/10 rounded-2xl">
        <div className="flex items-start space-x-4">
          <div className="p-2.5 bg-primary/10 rounded-xl shrink-0">
            <Shield className="text-primary" size={24} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white/90 mb-1.5">100% Private & Local</h4>
            <p className="text-xs text-muted leading-relaxed">
              Designed as a quick, zero-setup tool to solve your problem in under a minute—no login required. 
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
