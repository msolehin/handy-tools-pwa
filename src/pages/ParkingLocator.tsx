import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Save, Trash2, Crosshair, Plus, Map as MapIcon, Compass, Camera, Upload, X, Satellite } from 'lucide-react';
import L from 'leaflet';
import { db, type ParkingLocation } from '../db';
import { CompassNavigator } from '../components/CompassNavigator';
import { useLiveQuery } from 'dexie-react-hooks';
import { v4 as uuidv4 } from 'uuid';

// Fix Leaflet's default icon issue
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const ParkingLocator: React.FC = () => {
  const [currentLocation, setCurrentLocation] = useState<[number, number] | null>(null);
  const [title, setTitle] = useState('');
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [navigatingTo, setNavigatingTo] = useState<ParkingLocation | null>(null);
  const [fullImage, setFullImage] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const showToast = (message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 1800);
  };

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageBlob(file);
      const reader = new FileReader();
      reader.onload = (event) => setImagePreview(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const BlobImage = ({ blob }: { blob: Blob }) => {
    const [url, setUrl] = useState<string>('');
    useEffect(() => {
      const objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    }, [blob]);
    if (!url) return null;
    return <img src={url} alt="Lokasi Parking" className="mt-3 w-full h-40 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setFullImage(url)} />;
  };

  const locations = useLiveQuery(() => db.parkingLocations.orderBy('createdAt').reverse().toArray());

  const getLocation = (manual = false) => {
    setIsLocating(true);
    if (manual) showToast('📍 Mencari lokasi anda…');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([position.coords.latitude, position.coords.longitude]);
          setAccuracy(position.coords.accuracy);
          setIsLocating(false);
          if (manual) showToast('✅ Lokasi dikemas kini');
        },
        (error) => {
          console.error("Error getting location", error);
          showToast('⚠️ Gagal dapatkan lokasi');
          alert("Tidak dapat lokasi tepat anda. Pastikan perkhidmatan lokasi dihidupkan.");
          setIsLocating(false);
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
      );
    } else {
      showToast('⚠️ Geolokasi tidak disokong');
      alert("Geolokasi tidak disokong oleh pelayar ini.");
      setIsLocating(false);
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLocation) return alert("Lokasi belum diperoleh.");
    if (!title.trim()) return alert("Sila masukkan tajuk.");

    setIsSaving(true);
    try {
      // Only one parking location is kept at a time — saving replaces the previous one.
      await db.parkingLocations.clear();
      await db.parkingLocations.add({
        uuid: uuidv4(),
        title,
        note,
        latitude: currentLocation[0],
        longitude: currentLocation[1],
        image: imageBlob || undefined,
        createdAt: Date.now()
      });
      setTitle('');
      setNote('');
      setImageBlob(null);
      setImagePreview(null);
      setShowForm(false);
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan lokasi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Anda pasti mahu padam lokasi parking ini?")) {
      await db.parkingLocations.delete(id);
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  };

  const openInWaze = (lat: number, lng: number) => {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  // Derive GNSS signal quality from location accuracy (smaller = better)
  const signalLevel = accuracy == null ? 0 : accuracy <= 10 ? 4 : accuracy <= 25 ? 3 : accuracy <= 50 ? 2 : 1;
  const signalMeta = [
    { label: 'Tiada isyarat', text: 'text-muted', bar: 'bg-emerald-400' },
    { label: 'Lemah', text: 'text-red-400', bar: 'bg-red-400' },
    { label: 'Sederhana', text: 'text-amber-400', bar: 'bg-amber-400' },
    { label: 'Baik', text: 'text-lime-400', bar: 'bg-lime-400' },
    { label: 'Cemerlang', text: 'text-emerald-400', bar: 'bg-emerald-400' },
  ][signalLevel];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast feedback */}
      {toast && (
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 px-5 py-3 rounded-xl bg-surface border border-text/10 shadow-xl text-sm font-bold text-text animate-fade-in pointer-events-none">
          {toast}
        </div>
      )}
      {navigatingTo && (
        <CompassNavigator 
          targetLat={navigatingTo.latitude} 
          targetLng={navigatingTo.longitude} 
          onClose={() => setNavigatingTo(null)} 
        />
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Lupa parking?</h2>
        <button
          onClick={() => getLocation(true)}
          disabled={isLocating}
          className={`p-2 rounded-full transition-colors active:scale-90 ${isLocating ? 'bg-primary/20 text-primary' : 'bg-surface hover:bg-surface/80 text-primary'}`}
        >
          <Crosshair size={20} className={isLocating ? "animate-spin" : ""} />
        </button>
      </div>

      {/* GNSS Signal */}
      <div className="glass-panel px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Satellite size={20} className={`${signalMeta.text} ${isLocating ? 'animate-pulse' : ''}`} />
          <div>
            <p className="text-xs font-bold text-text/90">Isyarat GNSS</p>
            <p className={`text-[11px] ${signalMeta.text}`}>
              {isLocating
                ? 'Sedang mengunci…'
                : accuracy == null
                  ? 'Belum dapat lokasi'
                  : `${signalMeta.label} · ±${Math.round(accuracy)}m`}
            </p>
          </div>
        </div>
        <div className="flex items-end gap-1 h-6">
          {[1, 2, 3, 4].map(b => (
            <div
              key={b}
              className={`w-2 rounded-sm transition-all ${b <= signalLevel ? signalMeta.bar : 'bg-text/15'}`}
              style={{ height: `${b * 25}%` }}
            />
          ))}
        </div>
      </div>

      {/* Map Preview */}
      <div className="glass-panel p-2 h-64 relative overflow-hidden rounded-2xl z-0">
        {currentLocation ? (
          <MapContainer center={currentLocation} zoom={16} scrollWheelZoom={false} className="h-full w-full rounded-xl z-0">
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={currentLocation}>
              <Popup>Anda di sini</Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-background/50 animate-pulse rounded-xl">
            <p className="text-muted">Mendapatkan lokasi...</p>
          </div>
        )}
      </div>

      {/* Save Current Location */}
      {!showForm ? (
        <button 
          onClick={() => setShowForm(true)}
          className="btn-primary w-full flex items-center justify-center space-x-2 py-3"
          disabled={!currentLocation}
        >
          <Plus size={20} />
          <span>Simpan Lokasi Semasa</span>
        </button>
      ) : (
        <form onSubmit={handleSave} className="glass-panel p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Tajuk</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="cth. Basement 2, Tiang A5"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Nota (Pilihan)</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Tambah butiran lain untuk bantu anda cari kenderaan..."
              className="input-field resize-none h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Gambar (Pilihan)</label>
            
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                 <Camera size={18} />
                 <span>Ambil Gambar</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-text/5 hover:bg-text/10 text-text/80 py-2 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2 border border-text/10"
              >
                 <Upload size={18} />
                 <span>Muat Naik Fail</span>
              </button>
            </div>
            
            <input 
              type="file" 
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleImageUpload}
            />
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            {imagePreview && (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-xl cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setFullImage(imagePreview)} />
                <button 
                  type="button"
                  onClick={() => {
                    setImageBlob(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-text hover:bg-black/80 transition-colors backdrop-blur-sm"
                >
                  <X size={16} />
                </button>
              </div>
            )}
          </div>
          <div className="flex space-x-2">
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="btn-secondary flex-1"
            >
              Batal
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="btn-primary flex-1 flex justify-center items-center space-x-2"
            >
              <Save size={18} />
              <span>{isSaving ? 'Menyimpan...' : 'Simpan'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Saved Location */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-text/90">Lokasi Disimpan</h3>
        <div className="space-y-4">
          {locations?.length === 0 && (
            <p className="text-muted text-sm text-center py-8">Belum ada lokasi parking disimpan.</p>
          )}
          {locations?.map((loc: ParkingLocation) => (
            <div key={loc.id} className="glass-panel p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{loc.title}</h4>
                  <p className="text-xs text-muted mt-1">
                    {new Date(loc.createdAt).toLocaleString('ms-MY', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <button
                    onClick={() => navigator.clipboard?.writeText(`${loc.latitude}, ${loc.longitude}`)}
                    title="Tekan untuk salin koordinat"
                    className="flex items-center gap-1.5 mt-1.5 text-[11px] font-mono text-muted hover:text-text transition-colors"
                  >
                    <Crosshair size={12} className="shrink-0 text-primary" />
                    {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                  </button>
                  {loc.note && <p className="text-sm mt-2 text-text/80">{loc.note}</p>}
                </div>
                <button 
                  onClick={() => loc.id && handleDelete(loc.id)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              {loc.image && <BlobImage blob={loc.image} />}
              <div className="mt-4 flex flex-col space-y-2">
                <button 
                  onClick={() => setNavigatingTo(loc)}
                  className="w-full bg-primary/10 hover:bg-primary/20 py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2 text-primary border border-primary/20"
                >
                  <Compass size={18} />
                  <span>Panduan Kompas Dalam App</span>
                </button>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => openInGoogleMaps(loc.latitude, loc.longitude)}
                    className="flex-1 bg-text/5 hover:bg-text/10 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-2 text-text/80"
                  >
                    <MapIcon size={14} />
                    <span>Google Maps</span>
                  </button>
                  <button 
                    onClick={() => openInWaze(loc.latitude, loc.longitude)}
                    className="flex-1 bg-text/5 hover:bg-text/10 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-2 text-text/80"
                  >
                    <Navigation size={14} />
                    <span>Waze</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {fullImage && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col animate-fade-in p-4 backdrop-blur-sm cursor-pointer" onClick={() => setFullImage(null)}>
          <div className="absolute top-4 right-4 z-10">
            <button 
              onClick={(e) => { e.stopPropagation(); setFullImage(null); }}
              className="p-2 bg-text/10 rounded-full text-text hover:bg-text/20 transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className="flex-1 w-full h-full flex items-center justify-center overflow-hidden py-8">
            <img 
              src={fullImage} 
              alt="Pratonton penuh" 
              className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" 
              onClick={(e) => e.stopPropagation()} 
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingLocator;
