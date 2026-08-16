// The Garaj shell: owns every byte of state and every write to storage. Every tab (Tasks 10-13)
// is presentational — it receives `data`/`setData` and the two navigation handles below, and
// renders. No tab touches `store` directly.
import { useState, useEffect } from 'react';
import { store } from '../../lib/store';
import { useT } from '../../lib/lang';
import { EMPTY_GARAGE, type GarageData } from '../../lib/garage';
import { Gauge, CarFront, BarChart3, Settings2 } from 'lucide-react';

const FLEET = 'garage_fleet';
const RECORDS = 'garage_records';
const LOGS = 'garage_logs';
// A device preference, not data: which phone is looking at which car is nobody else's business.
const SELECTED = 'garage_selected';
const OLD_KEY = 'vehicle_services_data';
const OLD_TITLES = 'vehicle_custom_titles';

const parse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
};

// Shapes of the three stored blobs — each a partial slice of GarageData, never `any`. Every
// field is optional because a blob may be missing (first run) or malformed (a hand-edited or
// truncated value); `readGarage` below falls back to `[]`/`{}` per field either way, so a
// partial blob degrades to empty fields instead of throwing.
interface FleetBlob { vehicles?: GarageData['vehicles']; presets?: GarageData['presets'] }
interface RecordsBlob { services?: GarageData['services']; docs?: GarageData['docs'] }
interface LogsBlob { energy?: GarageData['energy']; odo?: GarageData['odo']; reminders?: GarageData['reminders'] }

// store.getItem is synchronous localStorage access, so there is nothing to await — reading it in
// a lazy useState initializer (like `vehicleId` below) gives a correct first paint for free and
// needs no separate "loaded" flag, unlike loading it in a mount effect would.
function readGarage(): GarageData {
  const fleet = parse<FleetBlob>(store.getItem(FLEET), {});
  const records = parse<RecordsBlob>(store.getItem(RECORDS), {});
  const logs = parse<LogsBlob>(store.getItem(LOGS), {});
  return {
    vehicles: fleet.vehicles ?? EMPTY_GARAGE.vehicles,
    presets: fleet.presets ?? EMPTY_GARAGE.presets,
    services: records.services ?? EMPTY_GARAGE.services,
    docs: records.docs ?? EMPTY_GARAGE.docs,
    energy: logs.energy ?? EMPTY_GARAGE.energy,
    odo: logs.odo ?? EMPTY_GARAGE.odo,
    reminders: logs.reminders ?? EMPTY_GARAGE.reminders,
  };
}

export default function Garage() {
  const tr = useT();
  const [data, setDataState] = useState<GarageData>(readGarage);
  const [tab, setTab] = useState<'overview' | 'vehicles' | 'costs' | 'settings'>('overview');
  const [vehicleId, setVehicleId] = useState<string | null>(() => store.getItem(SELECTED));
  // Vehicle-detail navigation contract (established here for Task 11): when non-null, the
  // vehicle detail page renders in place of the active tab's body while the tab row stays put —
  // it is a stacked view, not a route, so it deliberately does not persist across a reload.
  const [detailId, setDetailId] = useState<string | null>(null);
  // The old tool's data is still on this device and has not been dealt with yet.
  const [legacy, setLegacy] = useState<string | null>(() => store.getItem(OLD_KEY));

  // All three keys on every change. They are split so a fill-up does not re-upload photos, but
  // store.setItem already returns early when a key's serialised value is unchanged — so the two
  // heavy keys cost nothing on a logs-only edit, and a structural change still keeps them
  // consistent with the cascade in the garage_fleet descriptor.
  useEffect(() => {
    store.setItem(FLEET, JSON.stringify({ vehicles: data.vehicles, presets: data.presets }));
    store.setItem(RECORDS, JSON.stringify({ services: data.services, docs: data.docs }));
    store.setItem(LOGS, JSON.stringify({ energy: data.energy, odo: data.odo, reminders: data.reminders }));
  }, [data]);

  useEffect(() => {
    if (vehicleId) store.setItem(SELECTED, vehicleId);
  }, [vehicleId]);

  if (legacy) {
    return <LegacyGate raw={legacy} onDone={() => {
      store.removeItem(OLD_KEY);
      store.removeItem(OLD_TITLES);
      setLegacy(null);
    }} />;
  }

  const TABS = [
    ['overview', tr('Utama', 'Overview'), Gauge],
    ['vehicles', tr('Kenderaan', 'Vehicles'), CarFront],
    ['costs', tr('Kos', 'Costs'), BarChart3],
    ['settings', tr('Tetapan', 'Settings'), Settings2],
  ] as const;

  // Every tab (Tasks 10-13) is handed this same bag as it gets wired in below: `data`/`setData`
  // is the whole store, `vehicleId`/`setVehicleId` is the persisted device preference, and
  // `detailId`/`setDetailId` is the ephemeral vehicle-detail handle Task 11 reads and clears.
  // Referenced (not yet rendered) so the setters aren't dead code ahead of that wiring.
  const tabProps = { data, setData: setDataState, vehicleId, setVehicleId, detailId, setDetailId };
  void tabProps;

  return (
    <div className="pb-28">
      <div className="grid grid-cols-4 gap-1 bg-text/5 p-1 rounded-xl mb-1">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
              tab === key ? 'bg-surface text-emerald-400 light:text-emerald-600 shadow-sm' : 'text-muted hover:text-text'}`}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>
      {detailId ? (
        // Task 11: vehicle detail page, given detailId and tabProps.onBack === () => setDetailId(null).
        null
      ) : (
        <>
          {/* Each tab is rendered here, gated on `tab`; see Tasks 10-13. */}
          {tab === 'overview' && null}
          {tab === 'vehicles' && null}
          {tab === 'costs' && null}
          {tab === 'settings' && null}
        </>
      )}
    </div>
  );
}

/**
 * The old tool's records are still on this device. The rebuild does not migrate them — that was
 * a deliberate call — but losing them silently would be a different thing entirely, so the raw
 * JSON is offered as a file first. No parsing, no interpretation: whatever was stored is what
 * comes out.
 */
function LegacyGate({ raw, onDone }: { raw: string; onDone: () => void }) {
  const tr = useT();
  const [downloaded, setDownloaded] = useState(false);

  const download = () => {
    const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `servis-kenderaan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
  };

  return (
    <div className="px-1 py-6">
      <h2 className="font-display text-2xl mb-2">{tr('Garaj menggantikan Servis Kenderaan', 'Garaj replaces Servis Kenderaan')}</h2>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        {tr('Rekod lama tidak dipindahkan ke Garaj. Muat turun salinan dahulu jika anda mahu menyimpannya — selepas ini ia akan dibuang dari peranti ini.',
            'Your old records are not carried over into Garaj. Download a copy first if you want to keep them — after this they are removed from this device.')}
      </p>
      <button onClick={download}
        className="w-full py-3.5 rounded-xl bg-emerald-600 text-[#ffffff] font-display uppercase tracking-wider mb-3">
        {tr('Muat turun rekod lama', 'Download my old records')}
      </button>
      <button onClick={() => {
        if (!downloaded && !window.confirm(tr(
          'Anda belum memuat turun salinan. Teruskan dan buang rekod lama?',
          "You haven't downloaded a copy. Continue and remove the old records?"))) return;
        onDone();
      }} className="w-full py-3.5 rounded-xl border border-text/15 text-muted font-display uppercase tracking-wider">
        {tr('Mula dari kosong', 'Start fresh')}
      </button>
    </div>
  );
}
