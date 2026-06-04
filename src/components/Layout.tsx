import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  Home, FileImage, MapPin, PieChart, Timer, Wallet, Users, Calendar,
  Landmark, ShieldAlert, Wrench, Plane, Activity, MoreHorizontal, X, ShoppingCart, Briefcase, Fuel, ArrowRightLeft, Banknote, Gift, Dices, Repeat, Droplets, HeartPulse, Car, ListChecks, HandCoins, Utensils, Sun, Moon, Settings, Check
} from 'lucide-react';
import { DEFAULT_TOOLS } from '../pages/Home';

const Layout: React.FC = () => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const location = useLocation();

  const [pinnedToolPaths, setPinnedToolPaths] = useState<string[]>(() => {
    const saved = localStorage.getItem('pinnedTools');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) { }
    }
    return ['/ic-scanner', '/parking', '/decision-maker', '/restaurant-splitter'];
  });

  useEffect(() => {
    localStorage.setItem('pinnedTools', JSON.stringify(pinnedToolPaths));
  }, [pinnedToolPaths]);

  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    if (isLightMode) {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    } else {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const moreTools = [
    ...DEFAULT_TOOLS.map(tool => ({
      to: tool.to,
      icon: tool.Icon,
      label: tool.title,
      iconBgClass: tool.iconBgClass,
      title: tool.title
    })),
    { to: "#settings", icon: Settings, label: "Customize", title: "Customize", iconBgClass: "bg-slate-500/20 text-slate-400" }
  ];

  // Check if current route is in the "more" menu so we can highlight the "Others" tab
  const isMoreActive = moreTools.some(t => location.pathname === t.to);

  return (
    <div className="sm:flex sm:items-center sm:justify-center sm:min-h-screen sm:py-8 sm:w-full">
      <div className="flex flex-col min-h-screen sm:min-h-0 sm:h-[min(850px,calc(100vh-4rem))] max-w-md mx-auto w-full bg-background text-text shadow-[0_0_40px_rgba(0,0,0,0.15)] dark:shadow-[0_0_40px_rgba(0,0,0,0.5)] relative sm:rounded-[2.5rem] sm:border-[8px] sm:border-slate-800 dark:sm:border-slate-900 sm:overflow-hidden">
        {/* Top Navbar */}
        <header className="sticky top-0 z-40 glass-panel rounded-none border-x-0 border-t-0 rounded-b-2xl">
          <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold flex items-center space-x-1.5">
                <img src="/favicon.png" alt="Logo" className="w-6 h-6 object-contain" />
                <div className="flex tracking-tight">
                  <span className="text-text">Senang</span>
                  <span className="bg-gradient-to-r from-pink-500 to-orange-400 bg-clip-text text-transparent">Kit</span>
                </div>
              </h1>
              <span className="bg-pink-500/10 text-pink-500 border border-pink-500/30 text-[10px] px-2 py-0.5 rounded text-center font-bold tracking-widest shadow-sm">
                MY
              </span>
            </div>
            <button
              onClick={() => setIsLightMode(!isLightMode)}
              className="p-2 rounded-xl bg-surface/50 text-muted hover:text-primary transition-colors border border-text/10"
              aria-label="Toggle Theme"
            >
              {isLightMode ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main id="main-scroll-area" className="flex-1 max-w-md w-full mx-auto p-4 pb-24 overflow-x-hidden sm:overflow-y-auto relative z-0">
          <Outlet />
        </main>

        {/* Bottom Navigation */}
        <nav className="fixed bottom-0 sm:absolute sm:bottom-0 left-0 right-0 mx-auto w-full max-w-md z-40">
          <div className="max-w-md mx-auto mb-4 px-4">
            <div className="glass-panel flex justify-between items-center p-2">
              <NavLink
                to="/"
                onClick={() => setShowMoreMenu(false)}
                className={({ isActive }) =>
                  `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${isActive ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
                  }`
                }
              >
                <Home size={22} />
                <span className="text-[9px] mt-1 font-medium truncate w-full text-center">Home</span>
              </NavLink>
              {pinnedToolPaths.map(path => {
                const tool = moreTools.find(t => t.to === path);
                if (!tool) return null;
                const Icon = tool.icon;

                if (tool.to.startsWith('http')) {
                  return (
                    <a
                      key={path}
                      href={tool.to}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] text-muted hover:text-text"
                    >
                      <Icon size={22} />
                      <span className="text-[9px] mt-1 font-medium truncate w-full text-center">{tool.label}</span>
                    </a>
                  );
                }

                return (
                  <NavLink
                    key={path}
                    to={tool.to}
                    onClick={() => setShowMoreMenu(false)}
                    className={({ isActive }) =>
                      `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${isActive ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
                      }`
                    }
                  >
                    <Icon size={22} />
                    <span className="text-[9px] mt-1 font-medium truncate w-full text-center">{tool.label}</span>
                  </NavLink>
                );
              })}

              {/* Others Menu Trigger */}
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${showMoreMenu || (isMoreActive && !showMoreMenu) ? 'bg-surface text-text shadow-sm' : 'text-muted hover:text-text'
                  }`}
              >
                {showMoreMenu ? <X size={22} /> : <MoreHorizontal size={22} />}
                <span className="text-[9px] mt-1 font-medium truncate w-full text-center">
                  {showMoreMenu ? 'Close' : 'Others'}
                </span>
              </button>
            </div>
          </div>
        </nav>

        {/* Others Bottom Sheet Modal */}
        {showMoreMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 z-30 backdrop-blur-sm animate-fade-in"
              onClick={() => setShowMoreMenu(false)}
            />

            {/* Sheet */}
            <div className="fixed bottom-0 sm:absolute sm:bottom-0 left-0 right-0 z-30 max-w-md mx-auto animate-slide-up">
              <div className="glass-panel border-x-0 border-b-0 rounded-t-3xl rounded-b-none shadow-2xl bg-background/95 max-h-[85vh] flex flex-col">
                <div className="flex justify-between items-center p-6 pb-4 shrink-0">
                  <h3 className="text-xl font-bold">More Tools</h3>
                </div>

                <div className="grid grid-cols-4 gap-y-6 gap-x-2 p-6 pt-0 pb-28 overflow-y-auto overscroll-contain">
                  {moreTools.filter(t => t.to === '#settings' || !pinnedToolPaths.includes(t.to)).map((tool, idx) => {
                    const Icon = tool.icon;
                    const homeTool = DEFAULT_TOOLS.find(h => h.id === tool.to);
                    const displayName = homeTool ? homeTool.title : tool.label;

                    if (tool.to === '#settings') {
                      return (
                        <button
                          key={idx}
                          onClick={() => { setShowMoreMenu(false); setShowSettings(true); }}
                          className="flex flex-col items-center transition-all duration-200 group"
                        >
                          <div className={`p-4 rounded-2xl mb-2 transition-all shadow-sm ${tool.iconBgClass} group-hover:scale-110 group-hover:shadow-md`}>
                            <Icon size={24} />
                          </div>
                          <span className="text-[10px] font-medium text-center text-muted group-hover:text-text">{displayName}</span>
                        </button>
                      );
                    }
                    if (tool.to.startsWith('http')) {
                      return (
                        <a
                          key={idx}
                          href={tool.to}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={() => setShowMoreMenu(false)}
                          className="flex flex-col items-center transition-all duration-200 group"
                        >
                          <div className={`p-4 rounded-2xl mb-2 transition-all shadow-sm ${tool.iconBgClass} group-hover:scale-110 group-hover:shadow-md`}>
                            <Icon size={24} />
                          </div>
                          <span className="text-[10px] font-medium text-center text-muted group-hover:text-text line-clamp-2 leading-tight">{displayName}</span>
                        </a>
                      );
                    }
                    const isActive = location.pathname === tool.to;
                    return (
                      <NavLink
                        key={idx}
                        to={tool.to}
                        onClick={() => setShowMoreMenu(false)}
                        className="flex flex-col items-center transition-all duration-200 group"
                      >
                        <div className={`p-4 rounded-2xl mb-2 transition-all shadow-sm ${tool.iconBgClass} ${isActive ? 'scale-110 shadow-md ring-2 ring-primary/20' : 'group-hover:scale-110 group-hover:shadow-md'}`}>
                          <Icon size={24} />
                        </div>
                        <span className={`text-[10px] font-medium text-center line-clamp-2 leading-tight ${isActive ? 'text-text font-bold' : 'text-muted group-hover:text-text'}`}>
                          {displayName}
                        </span>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}

        {/* Settings Bottom Sheet Modal */}
        {showSettings && (
          <>
            <div
              className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fade-in"
              onClick={() => setShowSettings(false)}
            />
            <div className="fixed bottom-0 sm:absolute sm:bottom-0 left-0 right-0 z-50 max-w-md mx-auto animate-slide-up">
              <div className="glass-panel border-x-0 border-b-0 rounded-t-3xl rounded-b-none shadow-2xl bg-background/95 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center p-6 pb-4 shrink-0 border-b border-text/5">
                  <div>
                    <h3 className="text-xl font-bold">Customize Menu</h3>
                    <p className="text-xs text-muted mt-1">Select 3 to 4 tools for your quick access bar.</p>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="p-2 bg-text/5 rounded-full text-muted hover:text-text transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-2 overscroll-contain">
                  {moreTools.filter(t => t.to !== '#settings').map(tool => {
                    const isSelected = pinnedToolPaths.includes(tool.to);
                    const Icon = tool.icon;
                    const homeTool = DEFAULT_TOOLS.find(h => h.id === tool.to);
                    const displayName = homeTool ? homeTool.title : tool.label;

                    return (
                      <button
                        key={tool.to}
                        onClick={() => {
                          if (isSelected) {
                            if (pinnedToolPaths.length <= 3) {
                              alert("You must pin at least 3 tools to your navigation bar.");
                              return;
                            }
                            setPinnedToolPaths(prev => prev.filter(p => p !== tool.to));
                          } else {
                            if (pinnedToolPaths.length >= 4) {
                              // Replace the oldest one (index 0) with the new one
                              setPinnedToolPaths(prev => [...prev.slice(1), tool.to]);
                            } else {
                              setPinnedToolPaths(prev => [...prev, tool.to]);
                            }
                          }
                        }}
                        className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all border ${isSelected ? 'bg-primary/10 border-primary/30' : 'bg-surface border-text/5 hover:border-text/10'
                          }`}
                      >
                        <div className="flex items-center gap-3 text-left">
                          <div className={`p-2 rounded-xl shrink-0 ${tool.iconBgClass}`}>
                            <Icon size={20} />
                          </div>
                          <span className={`font-medium line-clamp-1 ${isSelected ? 'text-primary' : 'text-text'}`}>{displayName}</span>
                        </div>
                        <div className={`w-6 h-6 rounded-full shrink-0 flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-primary border-primary text-white' : 'border-text/20'
                          }`}>
                          {isSelected && <Check size={14} />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Layout;
