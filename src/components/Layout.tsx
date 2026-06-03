import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { 
  Home, FileImage, MapPin, PieChart, Timer, Wallet, Users, Calendar, 
  Landmark, ShieldAlert, Wrench, Plane, Activity, MoreHorizontal, X, ShoppingCart, Briefcase
} from 'lucide-react';

const Layout: React.FC = () => {
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const location = useLocation();

  const moreTools = [
    { to: "/pace-calculator", icon: Timer, label: "Pace" },
    { to: "/affordability", icon: Wallet, label: "Afford" },
    { to: "/countdown", icon: Calendar, label: "Events" },
    { to: "/loan-calculator", icon: Landmark, label: "Loans" },
    { to: "/document-expiry", icon: ShieldAlert, label: "Docs" },
    { to: "/vehicle-tracker", icon: Wrench, label: "Vehicle" },
    { to: "/trip-budget", icon: Plane, label: "Trips" },
    { to: "/bmi-calculator", icon: Activity, label: "BMI" },
    { to: "/grocery-budget", icon: ShoppingCart, label: "Grocery" },
    { to: "/packing-checklist", icon: Briefcase, label: "Packing" },
  ];

  // Check if current route is in the "more" menu so we can highlight the "Others" tab
  const isMoreActive = moreTools.some(t => location.pathname === t.to);

  return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 glass-panel rounded-none border-x-0 border-t-0 rounded-b-2xl">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Handy Tools
            </h1>
            <span className="bg-primary/20 text-primary border border-primary/30 text-[10px] px-2 py-0.5 rounded text-center font-bold tracking-widest shadow-sm">
              MY
            </span>
          </div>
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
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
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
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
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
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
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
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
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
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
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
                isMoreActive && !showMoreMenu ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
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
                  className="p-2 bg-white/5 rounded-full text-muted hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              
              <div className="grid grid-cols-4 gap-y-6 gap-x-2">
                {moreTools.map((tool, idx) => {
                  const Icon = tool.icon;
                  const isActive = location.pathname === tool.to;
                  return (
                    <NavLink
                      key={idx}
                      to={tool.to}
                      onClick={() => setShowMoreMenu(false)}
                      className={`flex flex-col items-center p-3 rounded-2xl transition-all duration-200 ${
                        isActive 
                          ? 'bg-primary/20 text-primary shadow-[0_0_15px_rgba(var(--color-primary),0.2)]' 
                          : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
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
