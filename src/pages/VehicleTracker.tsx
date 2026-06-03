import React, { useState, useEffect } from 'react';
import { Wrench, Plus, Trash2, Gauge, Calendar, CarFront } from 'lucide-react';

interface ServiceRecord {
  id: string;
  serviceType: string;
  customService?: string;
  date: string;
  mileage: string;
}

const SERVICE_TYPES = [
  'Engine Oil',
  'Tyres',
  'Brake Pads',
  'Battery',
  'Spark Plugs',
  'Air Filter',
  'Other'
];

const VehicleTracker: React.FC = () => {
  const [records, setRecords] = useState<ServiceRecord[]>(() => {
    const saved = localStorage.getItem('vt_records');
    return saved ? JSON.parse(saved) : [];
  });

  const [newType, setNewType] = useState(SERVICE_TYPES[0]);
  const [newCustom, setNewCustom] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newMileage, setNewMileage] = useState('');

  useEffect(() => {
    localStorage.setItem('vt_records', JSON.stringify(records));
  }, [records]);

  const addRecord = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    if (newType === 'Other' && !newCustom.trim()) return;

    setRecords([
      ...records,
      {
        id: Math.random().toString(),
        serviceType: newType,
        customService: newType === 'Other' ? newCustom.trim() : undefined,
        date: newDate,
        mileage: newMileage,
      }
    ]);

    setNewType(SERVICE_TYPES[0]);
    setNewCustom('');
    setNewDate('');
    setNewMileage('');
  };

  const removeRecord = (id: string) => {
    setRecords(records.filter(r => r.id !== id));
  };

  // Sort by newest date first
  const sortedRecords = [...records].sort((a, b) => {
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-slate-500/20 text-slate-400 rounded-xl">
          <Wrench size={24} />
        </div>
        <h2 className="text-2xl font-bold">Vehicle Service Tracker</h2>
      </div>

      <div className="glass-panel p-5 border-white/10">
        <h3 className="font-semibold mb-4 text-sm text-muted">Log New Service</h3>
        <form onSubmit={addRecord} className="space-y-4">
          <div className="space-y-3">
            <select 
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-slate-400 transition-colors appearance-none"
            >
              {SERVICE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>

            {newType === 'Other' && (
              <input 
                type="text" 
                value={newCustom}
                onChange={(e) => setNewCustom(e.target.value)}
                placeholder="Enter custom service..."
                className="input-field w-full"
                required={newType === 'Other'}
              />
            )}

            <div className="flex space-x-2 w-full">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Calendar className="text-muted" size={16} />
                </div>
                <input 
                  type="date" 
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white focus:outline-none focus:border-slate-400 transition-colors"
                  required
                />
              </div>
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Gauge className="text-muted" size={16} />
                </div>
                <input 
                  type="number" 
                  min="0"
                  value={newMileage}
                  onChange={(e) => setNewMileage(e.target.value)}
                  placeholder="Mileage (Optional)"
                  className="w-full bg-background border border-white/10 rounded-xl pl-10 pr-3 py-3 text-white focus:outline-none focus:border-slate-400 transition-colors"
                />
              </div>
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={!newDate || (newType === 'Other' && !newCustom)}
            className="w-full py-3 bg-slate-500 hover:bg-slate-600 text-white font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Plus size={18} />
            <span>Save Log</span>
          </button>
        </form>
      </div>

      <div className="space-y-4">
        {sortedRecords.map(record => (
          <div key={record.id} className="glass-panel p-4 border-white/10 flex justify-between items-start group">
            <div>
              <h4 className="font-bold text-lg text-white mb-1">
                {record.serviceType === 'Other' ? record.customService : record.serviceType}
              </h4>
              <div className="flex flex-col space-y-1 text-sm text-white/60">
                <div className="flex items-center space-x-2">
                  <Calendar size={14} />
                  <span>{new Date(record.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                </div>
                {record.mileage && (
                  <div className="flex items-center space-x-2">
                    <Gauge size={14} />
                    <span>{parseInt(record.mileage).toLocaleString()} km</span>
                  </div>
                )}
              </div>
            </div>
            
            <button 
              onClick={() => removeRecord(record.id)}
              className="p-2 text-white/30 hover:text-red-400 hover:bg-black/20 rounded-lg transition-colors"
            >
              <Trash2 size={18} />
            </button>
          </div>
        ))}

        {records.length === 0 && (
          <div className="glass-panel p-8 text-center text-muted border-dashed">
            <CarFront size={48} className="mx-auto mb-3 opacity-20" />
            <p>No service records yet.<br/>Log your first maintenance to keep track!</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default VehicleTracker;
