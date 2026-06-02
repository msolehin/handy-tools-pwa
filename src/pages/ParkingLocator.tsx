import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Save, Trash2, Crosshair, Plus, Map as MapIcon, Compass, Camera, Upload, X } from 'lucide-react';
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
  const [isCameraActive, setIsCameraActive] = useState(false);

  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });
      streamRef.current = stream;
      setIsCameraActive(true);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(e => console.error("Video play error:", e));
        }
      }, 100);
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Falling back to file upload.");
      fileInputRef.current?.click();
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const captureImage = () => {
    if (videoRef.current && isCameraActive) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert canvas to blob
        canvas.toBlob((blob) => {
          if (blob) {
            setImageBlob(blob);
            const reader = new FileReader();
            reader.onload = (event) => setImagePreview(event.target?.result as string);
            reader.readAsDataURL(blob);
            stopCamera();
          }
        }, 'image/jpeg', 0.9);
      }
    }
  };

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
    return <img src={url} alt="Parking Location" className="mt-3 w-full h-40 object-cover rounded-xl" />;
  };

  const locations = useLiveQuery(() => db.parkingLocations.orderBy('createdAt').reverse().toArray());

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation([position.coords.latitude, position.coords.longitude]);
        },
        (error) => {
          console.error("Error getting location", error);
          alert("Could not get your precise location. Please ensure location services are enabled.");
        },
        { enableHighAccuracy: true }
      );
    } else {
      alert("Geolocation is not supported by this browser.");
    }
  };

  useEffect(() => {
    getLocation();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentLocation) return alert("Location not acquired yet.");
    if (!title.trim()) return alert("Please enter a title.");

    setIsSaving(true);
    try {
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
      alert("Failed to save location.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (confirm("Are you sure you want to delete this parking location?")) {
      await db.parkingLocations.delete(id);
    }
  };

  const openInGoogleMaps = (lat: number, lng: number) => {
    window.open(`https://maps.google.com/?q=${lat},${lng}`, '_blank');
  };

  const openInWaze = (lat: number, lng: number) => {
    window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {navigatingTo && (
        <CompassNavigator 
          targetLat={navigatingTo.latitude} 
          targetLng={navigatingTo.longitude} 
          onClose={() => setNavigatingTo(null)} 
        />
      )}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Parking Locator</h2>
        <button onClick={getLocation} className="p-2 bg-surface rounded-full hover:bg-surface/80 text-primary transition-colors">
          <Crosshair size={20} />
        </button>
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
              <Popup>You are here</Popup>
            </Marker>
          </MapContainer>
        ) : (
          <div className="h-full flex items-center justify-center bg-background/50 animate-pulse rounded-xl">
            <p className="text-muted">Acquiring location...</p>
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
          <span>Save Current Location</span>
        </button>
      ) : (
        <form onSubmit={handleSave} className="glass-panel p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Title</label>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Basement 2, Pillar A5"
              className="input-field"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Notes (Optional)</label>
            <textarea 
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add any extra details to help you find your vehicle..."
              className="input-field resize-none h-20"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted mb-1">Photo (Optional)</label>
            
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={startCamera}
                className="flex-1 bg-primary/20 hover:bg-primary/30 text-primary py-2 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2"
              >
                 <Camera size={18} />
                 <span>Take Photo</span>
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white/80 py-2 px-4 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center space-x-2 border border-white/10"
              >
                 <Upload size={18} />
                 <span>Upload File</span>
              </button>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageUpload}
            />
            {imagePreview && (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full h-32 object-cover rounded-xl" />
                <button 
                  type="button"
                  onClick={() => {
                    setImageBlob(null);
                    setImagePreview(null);
                  }}
                  className="absolute top-2 right-2 bg-black/60 p-1.5 rounded-full text-white hover:bg-black/80 transition-colors backdrop-blur-sm"
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
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving}
              className="btn-primary flex-1 flex justify-center items-center space-x-2"
            >
              <Save size={18} />
              <span>{isSaving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Saved Locations List */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4 text-white/90">Saved Locations</h3>
        <div className="space-y-4">
          {locations?.length === 0 && (
            <p className="text-muted text-sm text-center py-8">No saved parking locations yet.</p>
          )}
          {locations?.map((loc: ParkingLocation) => (
            <div key={loc.id} className="glass-panel p-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-semibold text-lg">{loc.title}</h4>
                  <p className="text-xs text-muted mt-1">
                    {new Date(loc.createdAt).toLocaleString()}
                  </p>
                  {loc.note && <p className="text-sm mt-2 text-white/80">{loc.note}</p>}
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
                  <span>In-App Compass Guide</span>
                </button>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => openInGoogleMaps(loc.latitude, loc.longitude)}
                    className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-2 text-white/80"
                  >
                    <MapIcon size={14} />
                    <span>Google Maps</span>
                  </button>
                  <button 
                    onClick={() => openInWaze(loc.latitude, loc.longitude)}
                    className="flex-1 bg-white/5 hover:bg-white/10 py-2 rounded-xl text-xs font-medium transition-colors flex items-center justify-center space-x-2 text-white/80"
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

      {isCameraActive && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-fade-in">
          <div className="flex-1 relative flex flex-col justify-center items-center overflow-hidden">
            <video 
              ref={videoRef} 
              autoPlay 
              playsInline 
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>
          <div className="p-6 bg-black pb-12 space-y-4">
            <div className="flex justify-between items-center px-4 max-w-sm mx-auto w-full">
              <button 
                onClick={() => {
                  stopCamera();
                  if (fileInputRef.current) fileInputRef.current.value = '';
                  fileInputRef.current?.click();
                }}
                className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                title="Upload from Gallery"
              >
                <Upload size={24} />
              </button>
              <button 
                onClick={captureImage}
                className="w-20 h-20 bg-white rounded-full border-4 border-white/20 flex items-center justify-center hover:bg-white/90 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]"
              >
                <div className="w-16 h-16 rounded-full border-2 border-black/10 flex items-center justify-center bg-transparent" />
              </button>
              <button 
                onClick={stopCamera}
                className="p-4 bg-white/10 rounded-full text-white hover:bg-white/20 transition-colors"
                title="Cancel"
              >
                <X size={24} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParkingLocator;
