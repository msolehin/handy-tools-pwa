import React, { useState, useEffect } from 'react';
import { ShieldAlert, Plus, Trash2, FileWarning, FileCheck, AlertTriangle } from 'lucide-react';

interface ExpiryDocument {
  id: string;
  type: string;
  customTitle?: string;
  expiryDate: string;
}

const DOCUMENT_TYPES = [
  'Passport',
  'Roadtax',
  'Driving License',
  'Identity Card',
  'Medical Card',
  'Visa',
  'Custom'
];

const DocumentExpiry: React.FC = () => {
  const [documents, setDocuments] = useState<ExpiryDocument[]>(() => {
    const saved = localStorage.getItem('de_documents');
    return saved ? JSON.parse(saved) : [];
  });

  const [newType, setNewType] = useState(DOCUMENT_TYPES[0]);
  const [newCustomTitle, setNewCustomTitle] = useState('');
  const [newDate, setNewDate] = useState('');

  useEffect(() => {
    localStorage.setItem('de_documents', JSON.stringify(documents));
  }, [documents]);

  const addDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate) return;
    if (newType === 'Custom' && !newCustomTitle.trim()) return;

    setDocuments([
      ...documents,
      {
        id: Math.random().toString(),
        type: newType,
        customTitle: newType === 'Custom' ? newCustomTitle.trim() : undefined,
        expiryDate: newDate,
      }
    ]);

    setNewType(DOCUMENT_TYPES[0]);
    setNewCustomTitle('');
    setNewDate('');
  };

  const removeDocument = (id: string) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const getDaysLeft = (targetDate: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(targetDate);
    target.setHours(0, 0, 0, 0);
    const diffTime = target.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Sort by nearest expiry first
  const sortedDocuments = [...documents].sort((a, b) => {
    return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
  });

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-red-500/20 text-red-400 rounded-xl">
          <ShieldAlert size={24} />
        </div>
        <h2 className="text-2xl font-bold">Document Expiry</h2>
      </div>

      {/* Add Document Form */}
      <div className="glass-panel p-5 border-white/10">
        <h3 className="font-semibold mb-4 text-sm text-muted">Add Document Tracker</h3>
        <form onSubmit={addDocument} className="space-y-4">
          <div className="flex space-x-2">
            <select 
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-red-400 transition-colors appearance-none flex-1"
            >
              {DOCUMENT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            
            <input 
              type="date" 
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="input-field flex-1"
              required
            />
          </div>

          {newType === 'Custom' && (
            <div>
              <input 
                type="text" 
                value={newCustomTitle}
                onChange={(e) => setNewCustomTitle(e.target.value)}
                placeholder="Enter custom document name..."
                className="input-field w-full"
                required={newType === 'Custom'}
              />
            </div>
          )}
          
          <button 
            type="submit" 
            disabled={!newDate || (newType === 'Custom' && !newCustomTitle)}
            className="w-full py-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Plus size={18} />
            <span>Track Document</span>
          </button>
        </form>
      </div>

      {/* Documents List */}
      <div className="space-y-4">
        {sortedDocuments.map(doc => {
          const daysLeft = getDaysLeft(doc.expiryDate);
          const isExpired = daysLeft < 0;
          const isWarning = daysLeft >= 0 && daysLeft <= 30;
          
          const title = doc.type === 'Custom' ? doc.customTitle : doc.type;
          const displayDays = Math.abs(daysLeft);
          
          // Determine styles based on urgency
          let cardStyle = "border-white/10 bg-white/5";
          let iconStyle = "text-green-400 bg-green-500/20";
          let textStyle = "text-green-400";
          let statusText = `${displayDays} Days Left`;
          let IconComponent = FileCheck;

          if (isExpired) {
            cardStyle = "border-red-500/50 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.15)]";
            iconStyle = "text-red-400 bg-red-500/20";
            textStyle = "text-red-400 font-bold";
            statusText = `EXPIRED (${displayDays} days ago)`;
            IconComponent = ShieldAlert;
          } else if (isWarning) {
            cardStyle = "border-yellow-500/50 bg-yellow-500/10 shadow-[0_0_15px_rgba(234,179,8,0.1)]";
            iconStyle = "text-yellow-400 bg-yellow-500/20";
            textStyle = "text-yellow-400 font-bold";
            IconComponent = AlertTriangle;
          }
          
          return (
            <div 
              key={doc.id}
              className={`relative overflow-hidden rounded-2xl border p-4 transition-all flex items-center justify-between ${cardStyle}`}
            >
              <div className="flex items-center space-x-4">
                <div className={`p-3 rounded-xl ${iconStyle}`}>
                  <IconComponent size={24} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-white mb-0.5">{title}</h3>
                  <p className="text-xs text-white/60 mb-1">
                    Expires: {new Date(doc.expiryDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </p>
                  <p className={`text-sm ${textStyle}`}>
                    {statusText}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => removeDocument(doc.id)}
                className="p-2 text-white/40 hover:text-red-400 hover:bg-black/20 rounded-lg transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          );
        })}

        {documents.length === 0 && (
          <div className="glass-panel p-8 text-center text-muted border-dashed">
            <FileWarning size={48} className="mx-auto mb-3 opacity-20" />
            <p>No documents tracked yet.<br/>Add a document to get expiry alerts!</p>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default DocumentExpiry;
