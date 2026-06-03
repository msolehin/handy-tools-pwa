import React from 'react';
import { Link } from 'react-router-dom';
import { FileImage, MapPin, ArrowRight } from 'lucide-react';

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
      </div>
    </div>
  );
};

export default Home;
