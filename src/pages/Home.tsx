import React from 'react';
import { Link } from 'react-router-dom';
import { FileImage, MapPin, ArrowRight, Shield, PieChart, Timer, Wallet, Users, Calendar, Landmark } from 'lucide-react';

const Home: React.FC = () => {
  return (
    <div className="space-y-6 animate-fade-in">
      <section className="mt-4 mb-8">
        <h2 className="text-3xl font-bold mb-2">Welcome</h2>
        <p className="text-muted">Select a tool below to get started. Works fully offline.</p>
      </section>

      <div className="grid gap-4">
        <Link to="/ic-scanner" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-primary/50 hover:shadow-primary/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/20 text-primary rounded-xl group-hover:scale-110 transition-transform">
                <FileImage size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">IC Combiner</h3>
                <p className="text-sm text-muted">Scan & generate PDF</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-primary transition-colors" />
          </div>
        </Link>

        <Link to="/parking" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-secondary/50 hover:shadow-secondary/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-secondary/20 text-secondary rounded-xl group-hover:scale-110 transition-transform">
                <MapPin size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Parking Locator</h3>
                <p className="text-sm text-muted">Save & find your vehicle</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-secondary transition-colors" />
          </div>
        </Link>

        <Link to="/decision-maker" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-accent/50 hover:shadow-accent/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-accent/20 text-accent rounded-xl group-hover:scale-110 transition-transform">
                <PieChart size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Random Decision Maker</h3>
                <p className="text-sm text-muted">Spin the wheel to decide</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-accent transition-colors" />
          </div>
        </Link>

        <Link to="/pace-calculator" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-blue-400/50 hover:shadow-blue-400/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-500/20 text-blue-400 rounded-xl group-hover:scale-110 transition-transform">
                <Timer size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Pace Calculator</h3>
                <p className="text-sm text-muted">Time, Distance & Pace</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-blue-400 transition-colors" />
          </div>
        </Link>

        <Link to="/affordability" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-green-400/50 hover:shadow-green-400/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-green-500/20 text-green-400 rounded-xl group-hover:scale-110 transition-transform">
                <Wallet size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Can I Afford It?</h3>
                <p className="text-sm text-muted">Cost vs Income Calculator</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-green-400 transition-colors" />
          </div>
        </Link>

        <Link to="/expense-splitter" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-purple-400/50 hover:shadow-purple-400/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-500/20 text-purple-400 rounded-xl group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Expense Splitter</h3>
                <p className="text-sm text-muted">Group Bills & Settle Up</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-purple-400 transition-colors" />
          </div>
        </Link>

        <Link to="/countdown" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-pink-500/50 hover:shadow-pink-500/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-pink-500/20 text-pink-400 rounded-xl group-hover:scale-110 transition-transform">
                <Calendar size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Countdown Day</h3>
                <p className="text-sm text-muted">Track Events & Holidays</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-pink-400 transition-colors" />
          </div>
        </Link>

        <Link to="/loan-calculator" className="block group">
          <div className="glass-panel p-6 flex items-center justify-between transition-all duration-300 hover:border-orange-500/50 hover:shadow-orange-500/20">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-orange-500/20 text-orange-400 rounded-xl group-hover:scale-110 transition-transform">
                <Landmark size={28} />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Loan Calculator</h3>
                <p className="text-sm text-muted">Estimate Auto & Home Loans</p>
              </div>
            </div>
            <ArrowRight className="text-muted group-hover:text-orange-400 transition-colors" />
          </div>
        </Link>
      </div>

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
