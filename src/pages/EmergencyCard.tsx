import React, { useState, useEffect } from 'react';
import { HeartPulse, Edit2, Check, PhoneCall, AlertTriangle, Info } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

interface EmergencyData {
  name: string;
  bloodType: string;
  contactName: string;
  contactPhone: string;
  medicalNotes: string;
}

const STORAGE_KEY = 'emergency_card_data';

const EmergencyCard: React.FC = () => {
  const [data, setData] = useState<EmergencyData>({
    name: '',
    bloodType: 'A+',
    contactName: '',
    contactPhone: '',
    medicalNotes: ''
  });
  
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData(parsed);
      } catch (e) {}
    } else {
      setIsEditMode(true);
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setIsEditMode(false);
  };

  const qrPayload = `MEDICAL ID\nName: ${data.name}\nBlood: ${data.bloodType}\nEmergency Contact: ${data.contactName} (${data.contactPhone})\nNotes: ${data.medicalNotes}`;

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="flex items-center justify-between z-10 relative px-2">
        <div className="flex items-center space-x-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-500/20 text-red-400">
            <HeartPulse size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white/90">Medical ID</h1>
            <p className="text-[10px] text-muted uppercase tracking-wider">Emergency Info Card</p>
          </div>
        </div>
        <button 
          onClick={() => isEditMode ? handleSave() : setIsEditMode(true)}
          className={`p-3 rounded-xl transition-colors ${
            isEditMode ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30' : 'bg-white/5 text-muted hover:bg-white/10 hover:text-white'
          }`}
        >
          {isEditMode ? <Check size={20} /> : <Edit2 size={20} />}
        </button>
      </div>

      {isEditMode ? (
        <div className="glass-panel p-6 animate-fade-in space-y-4">
          <div className="flex items-center space-x-2 text-rose-400 mb-6">
            <AlertTriangle size={18} />
            <span className="text-sm font-bold uppercase tracking-widest">Edit Details</span>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Full Name</label>
            <input 
              type="text" 
              value={data.name} 
              onChange={e => setData({...data, name: e.target.value})}
              className="input-field w-full"
              placeholder="John Doe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Blood Type</label>
            <select 
              value={data.bloodType} 
              onChange={e => setData({...data, bloodType: e.target.value})}
              className="input-field w-full appearance-none"
            >
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
              <option value="Unknown">Unknown</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Emergency Contact Name</label>
            <input 
              type="text" 
              value={data.contactName} 
              onChange={e => setData({...data, contactName: e.target.value})}
              className="input-field w-full"
              placeholder="Jane Doe (Wife)"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Emergency Contact Phone</label>
            <input 
              type="tel" 
              value={data.contactPhone} 
              onChange={e => setData({...data, contactPhone: e.target.value})}
              className="input-field w-full"
              placeholder="+60 12-345 6789"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted uppercase tracking-wider">Medical Notes (Allergies, Conditions)</label>
            <textarea 
              value={data.medicalNotes} 
              onChange={e => setData({...data, medicalNotes: e.target.value})}
              className="input-field w-full h-24 resize-none"
              placeholder="e.g. Allergic to penicillin, Diabetic"
            />
          </div>
          
          <button onClick={handleSave} className="w-full btn-primary bg-emerald-500 hover:bg-emerald-600 mt-4 py-4 text-lg font-bold">
            Save Medical ID
          </button>
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Card View */}
          <div className="bg-gradient-to-br from-rose-500 to-red-700 rounded-3xl p-6 shadow-[0_10px_40px_rgba(225,29,72,0.3)] text-white relative overflow-hidden">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 -mt-8 -mr-8 text-white/10">
              <HeartPulse size={200} />
            </div>

            <div className="relative z-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight">{data.name || 'UNNAMED'}</h2>
                  <p className="text-white/80 text-sm font-medium">MEDICAL ID CARD</p>
                </div>
                <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl text-center border border-white/20 shadow-inner">
                  <p className="text-[10px] font-bold text-white/80 uppercase tracking-widest mb-0.5">BLOOD</p>
                  <p className="text-2xl font-black">{data.bloodType}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-xl border border-black/10 backdrop-blur-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">EMERGENCY CONTACT</p>
                    <p className="font-bold text-lg">{data.contactName || 'Not Set'}</p>
                    <p className="text-white/80 font-mono text-sm">{data.contactPhone || 'No number'}</p>
                  </div>
                  {data.contactPhone && (
                    <a href={`tel:${data.contactPhone}`} className="p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors">
                      <PhoneCall size={20} className="text-white" />
                    </a>
                  )}
                </div>

                <div className="bg-white/10 p-4 rounded-xl border border-white/10 backdrop-blur-sm">
                  <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider mb-1">MEDICAL NOTES</p>
                  <p className="text-sm leading-relaxed">{data.medicalNotes || 'None recorded.'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="glass-panel p-6 flex flex-col items-center text-center">
            <div className="mb-4">
              <h3 className="font-bold text-lg text-white">Scan for Details</h3>
              <p className="text-xs text-muted">Paramedics can scan this code to read your raw medical text offline.</p>
            </div>
            <div className="bg-white p-4 rounded-2xl shadow-xl inline-block">
              <QRCodeSVG 
                value={qrPayload} 
                size={220} 
                level="M" 
                includeMargin={false}
                fgColor="#000000"
                bgColor="#ffffff"
              />
            </div>
            <div className="mt-6 flex items-start text-xs text-muted bg-blue-500/10 p-3 rounded-lg border border-blue-500/20 text-left">
              <Info size={16} className="text-blue-400 mr-2 shrink-0 mt-0.5" />
              <p>This data is securely stored ONLY on this device. It is never uploaded to any server.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmergencyCard;
