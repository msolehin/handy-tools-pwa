import React, { useState, useEffect, useRef } from 'react';
import { Calendar, Plus, X, Image as ImageIcon, Trash2 } from 'lucide-react';

interface CountdownEvent {
  id: string;
  title: string;
  targetDate: string;
  imageUrl?: string;
}

const Countdown: React.FC = () => {
  const [events, setEvents] = useState<CountdownEvent[]>(() => {
    const saved = localStorage.getItem('cd_events');
    return saved ? JSON.parse(saved) : [];
  });

  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newImage, setNewImage] = useState<string | undefined>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('cd_events', JSON.stringify(events));
  }, [events]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setNewImage(canvas.toDataURL('image/jpeg', 0.7)); // compress to 70% quality JPEG
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const addEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newDate) return;

    setEvents([
      ...events,
      {
        id: Math.random().toString(),
        title: newTitle.trim(),
        targetDate: newDate,
        imageUrl: newImage,
      }
    ]);

    setNewTitle('');
    setNewDate('');
    setNewImage(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeEvent = (id: string) => {
    setEvents(events.filter(ev => ev.id !== id));
  };

  const getDaysLeft = (targetDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Sort events so nearest upcoming is first, then later dates, then past dates.
  const sortedEvents = [...events].sort((a, b) => {
    const daysA = getDaysLeft(a.targetDate);
    const daysB = getDaysLeft(b.targetDate);
    
    // Both future or both past
    if ((daysA >= 0 && daysB >= 0) || (daysA < 0 && daysB < 0)) {
      return daysA - daysB;
    }
    // A is future, B is past -> A comes first
    if (daysA >= 0 && daysB < 0) return -1;
    // B is future, A is past -> B comes first
    return 1;
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-pink-500/20 text-pink-400 rounded-xl">
          <Calendar size={24} />
        </div>
        <h2 className="text-2xl font-bold">Countdown Day</h2>
      </div>

      {/* Add Event Form */}
      <div className="glass-panel p-5 border-text/10">
        <h3 className="font-semibold mb-4 text-sm text-muted">Add New Event</h3>
        <form onSubmit={addEvent} className="space-y-4">
          <div>
            <input 
              type="text" 
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Event Title (e.g. Vacation, Birthday)"
              className="input-field w-full"
              required
            />
          </div>
          <div className="flex space-x-3">
            <input 
              type="date" 
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="input-field flex-1"
              required
            />
            
            <div className="relative">
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                ref={fileInputRef}
                className="hidden"
                id="cd-image-upload"
              />
              <label 
                htmlFor="cd-image-upload"
                className={`flex items-center justify-center h-full px-4 rounded-xl border cursor-pointer transition-colors ${
                  newImage 
                    ? 'bg-pink-500/20 border-pink-500/50 text-pink-400' 
                    : 'bg-text/5 border-text/10 text-muted hover:bg-text/10 hover:text-text'
                }`}
              >
                {newImage ? <Check size={20} /> : <ImageIcon size={20} />}
              </label>
              {newImage && (
                <button 
                  type="button"
                  onClick={() => {
                    setNewImage(undefined);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute -top-2 -right-2 bg-red-500 text-text rounded-full p-0.5 shadow-lg"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>
          
          <button 
            type="submit" 
            disabled={!newTitle || !newDate}
            className="w-full py-3 bg-pink-500 hover:bg-pink-600 text-text font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Plus size={18} />
            <span>Add to Countdown</span>
          </button>
        </form>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {sortedEvents.map(event => {
          const daysLeft = getDaysLeft(event.targetDate);
          const isPast = daysLeft < 0;
          const displayDays = Math.abs(daysLeft);
          
          return (
            <div 
              key={event.id}
              className={`relative overflow-hidden rounded-2xl border transition-all ${
                isPast ? 'border-text/5 opacity-70' : 'border-text/10 shadow-lg'
              }`}
            >
              {event.imageUrl ? (
                <>
                  <div 
                    className="absolute inset-0 bg-cover bg-center z-0"
                    style={{ backgroundImage: `url(${event.imageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-black/60 z-0 backdrop-blur-[2px]" />
                </>
              ) : (
                <div className={`absolute inset-0 z-0 bg-gradient-to-br ${
                  isPast ? 'from-surface to-surface/80' : 'from-pink-500/20 to-purple-500/20'
                }`} />
              )}
              
              <div className="relative z-10 p-5 flex justify-between items-center">
                <div className="flex-1 pr-4">
                  <h3 className={`font-bold text-xl mb-1 ${isPast ? 'text-text/70' : 'text-text'}`}>
                    {event.title}
                  </h3>
                  <p className="text-sm text-text/60">
                    {new Date(event.targetDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                
                <div className={`flex flex-col items-center justify-center px-4 py-3 rounded-xl backdrop-blur-md border ${
                  isPast 
                    ? 'bg-black/30 border-text/10' 
                    : 'bg-pink-500/30 border-pink-500/50 shadow-[0_0_15px_rgba(236,72,153,0.3)]'
                }`}>
                  <span className={`text-3xl font-black ${isPast ? 'text-text/70' : 'text-pink-400'}`}>
                    {displayDays}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${isPast ? 'text-text/50' : 'text-pink-300/80'}`}>
                    {daysLeft === 0 ? 'Today!' : (isPast ? 'Days Ago' : 'Days Left')}
                  </span>
                </div>

                <button 
                  onClick={() => removeEvent(event.id)}
                  className="absolute top-2 right-2 p-1.5 bg-black/40 text-text/50 hover:text-red-400 hover:bg-black/60 rounded-lg transition-colors backdrop-blur-md"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          );
        })}

        {events.length === 0 && (
          <div className="glass-panel p-8 text-center text-muted border-dashed">
            <Calendar size={48} className="mx-auto mb-3 opacity-20" />
            <p>No countdowns added yet.<br/>Add a future event to start tracking!</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

// Simple Check icon component for internal use since it's not imported globally
const Check = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default Countdown;
