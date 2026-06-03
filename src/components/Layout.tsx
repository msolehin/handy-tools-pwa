import React from 'react';
import { Outlet, NavLink } from 'react-router-dom';
import { Home, FileImage, MapPin, PieChart, Timer, Wallet, Users } from 'lucide-react';

const Layout: React.FC = () => {
  return (
    <div className="flex flex-col min-h-screen bg-background text-text">
      {/* Top Navbar */}
      <header className="sticky top-0 z-50 glass-panel rounded-none border-x-0 border-t-0 rounded-b-2xl">
        <div className="max-w-md mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Handy Tools
          </h1>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-md w-full mx-auto p-4 pb-24 overflow-x-hidden">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-md mx-auto mb-4 px-4">
          <div className="glass-panel flex justify-start sm:justify-around items-center p-2 overflow-x-auto gap-2 custom-scrollbar">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <Home size={24} />
              <span className="text-[10px] mt-1 font-medium">Home</span>
            </NavLink>
            <NavLink
              to="/ic-scanner"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <FileImage size={24} />
              <span className="text-[10px] mt-1 font-medium">IC Combiner</span>
            </NavLink>
            <NavLink
              to="/parking"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <MapPin size={24} />
              <span className="text-[10px] mt-1 font-medium">Parking</span>
            </NavLink>
            <NavLink
              to="/decision-maker"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <PieChart size={24} />
              <span className="text-[10px] mt-1 font-medium">Decide</span>
            </NavLink>
            <NavLink
              to="/pace-calculator"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <Timer size={24} />
              <span className="text-[10px] mt-1 font-medium">Pace</span>
            </NavLink>
            <NavLink
              to="/affordability"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <Wallet size={24} />
              <span className="text-[10px] mt-1 font-medium">Afford</span>
            </NavLink>
            <NavLink
              to="/expense-splitter"
              className={({ isActive }) =>
                `flex flex-col items-center p-2 rounded-xl transition-all duration-200 shrink-0 min-w-[60px] ${
                  isActive ? 'text-primary bg-primary/10' : 'text-muted hover:text-white'
                }`
              }
            >
              <Users size={24} />
              <span className="text-[10px] mt-1 font-medium">Split</span>
            </NavLink>
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Layout;
