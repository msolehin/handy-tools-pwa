import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  Home, FileImage, MapPin, PieChart, Timer, Wallet, Users, Calendar, 
  Landmark, ShieldAlert, Wrench, Plane, Activity, MoreHorizontal, X, ShoppingCart, Briefcase, Fuel, ArrowRightLeft, Banknote, Gift, Dices, Repeat, Droplets, HeartPulse, Car, ListChecks, HandCoins, Utensils, Sun, Moon, Zap
} from 'lucide-react';

const Layout: React.FC = () => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const location = useLocation();
  
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
    { to: "/pace-calculator", icon: Timer, label: "Pace" },
    { to: "/affordability", icon: Wallet, label: "Afford" },
    { to: "/countdown", icon: Calendar, label: "Events" },
    { to: "/financial-calculators", icon: Landmark, label: "Finance" },
    { to: "/document-expiry", icon: ShieldAlert, label: "Docs" },
    { to: "/vehicle-tracker", icon: Wrench, label: "Vehicle" },
    { to: "/trip-budget", icon: Plane, label: "Trips" },
    { to: "/bmi-calculator", icon: Activity, label: "BMI" },
    { to: "/grocery-budget", icon: ShoppingCart, label: "Grocery" },
    { to: "/packing-checklist", icon: Briefcase, label: "Packing" },
    { to: "/fuel-calculator", icon: Fuel, label: "Fuel" },
    { to: "/unit-converter", icon: ArrowRightLeft, label: "Units" },
    { to: "/currency-converter", icon: Banknote, label: "Currency" },
    { to: "/randomizer", icon: Dices, label: "Random" },
    { to: "/subscription-tracker", icon: Repeat, label: "Subs" },
    { to: "/water-tracker", icon: Droplets, label: "Water" },
    { to: "/paycheck-countdown", icon: Wallet, label: "Payday" },
    { to: "/emergency-card", icon: HeartPulse, label: "Medical" },
    { to: "/carpool-splitter", icon: Car, label: "Carpool" },
    { to: "/checklists", icon: ListChecks, label: "Lists" },
    { to: "/debt-tracker", icon: HandCoins, label: "Debts" },
    { to: "/restaurant-splitter", icon: Utensils, label: "Restaurant" },
    { to: "https://befday.com/", icon: Gift, label: "Birthday" },
  ];

  // Check if current route is in the "more" menu so we can highlight the "Others" tab
  const isMoreActive = moreTools.some(t => location.pathname === t.to);

  return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 glass-panel rounded-none border-x-0 border-t-0 rounded-b-2xl">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent flex items-center space-x-1">
              <Zap size={22} className="text-primary" />
              <span>SenangKit</span>
            </h1>
            <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-2 py-0.5 rounded text-center font-bold tracking-widest shadow-sm">
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
      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-24 overflow-x-hidden relative z-0">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40">
        <div className="max-w-md mx-auto mb-4 px-4">
          <div className="glass-panel flex justify-between items-center p-2">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
                }`
              }
            >
              <Home size={22} />
              <span className="text-[9px] mt-1 font-medium truncate w-full text-center">Home</span>
            </NavLink>
            <NavLink
              to="/ic-scanner"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
                }`
              }
            >
              <FileImage size={22} />
              <span className="text-[9px] mt-1 font-medium truncate w-full text-center">IC</span>
            </NavLink>
            <NavLink
              to="/parking"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
                }`
              }
            >
              <MapPin size={22} />
              <span className="text-[9px] mt-1 font-medium truncate w-full text-center">Parking</span>
            </NavLink>
            <NavLink
              to="/decision-maker"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
                }`
              }
            >
              <PieChart size={22} />
              <span className="text-[9px] mt-1 font-medium truncate w-full text-center">Decide</span>
            </NavLink>
            <NavLink
              to="/expense-splitter"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
                }`
              }
            >
              <Users size={22} />
              <span className="text-[9px] mt-1 font-medium truncate w-full text-center">Split</span>
            </NavLink>
            
            {/* Others Menu Trigger */}
            <button
              onClick={() => setShowMoreMenu(true)}
              className={`flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 w-[16%] ${
                isMoreActive && !showMoreMenu ? 'text-primary bg-primary/10' : 'text-muted hover:text-text'
              }`}
            >
              <MoreHorizontal size={22} />
              <span className="text-[9px] mt-1 font-medium truncate w-full text-center">Others</span>
            </button>
          </div>
        </div>
      </nav>

      {/* Others Bottom Sheet Modal */}
      {showMoreMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/60 z-50 backdrop-blur-sm animate-fade-in" 
            onClick={() => setShowMoreMenu(false)}
          />
          
          {/* Sheet */}
          <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto animate-slide-up">
            <div className="glass-panel border-x-0 border-b-0 rounded-t-3xl rounded-b-none p-6 pb-12 shadow-2xl bg-background/95">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold">More Tools</h3>
                <button 
                  onClick={() => setShowMoreMenu(false)}
                  className="p-2 bg-text/5 rounded-full text-muted hover:text-text transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                {moreTools.map((tool, idx) => {
                  const Icon = tool.icon;
                  if (tool.to.startsWith('http')) {
                    return (
                      <a
                        key={idx}
                        href={tool.to}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setShowMoreMenu(false)}
                        className="flex flex-col items-center p-3 rounded-2xl transition-all duration-200 bg-text/5 text-muted hover:bg-text/10 hover:text-text"
                      >
                        <Icon size={26} className="mb-2" />
                        <span className="text-[10px] font-medium text-center">{tool.label}</span>
                      </a>
                    );
                  }
                  const isActive = location.pathname === tool.to;
                  return (
                    <NavLink
                      key={idx}
                      to={tool.to}
                      onClick={() => setShowMoreMenu(false)}
                      className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--color-primary),0.2)]' 
                          : 'bg-text/5 text-muted hover:bg-text/10 hover:text-text'
                      }`}
                    >
                      <Icon size={26} className="mb-2" />
                      <span className="text-[10px] font-medium text-center">{tool.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Layout;
