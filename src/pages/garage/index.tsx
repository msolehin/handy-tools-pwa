// The Garaj shell: owns every byte of state and every write to storage. Every tab (Tasks 10-13)
// is presentational — it receives `data`/`setData` and the two navigation handles below, and
// renders. No tab touches `store` directly.
import { useState, useEffect, useRef } from 'react';
import { store } from '../../lib/store';
import { useT } from '../../lib/lang';
import { EMPTY_GARAGE, type GarageData } from '../../lib/garage';
import { Gauge, CarFront, BarChart3, Settings2, ChevronLeft } from 'lucide-react';
import Vehicles from './Vehicles';
import VehicleDetail from './VehicleDetail';
import Overview from './Overview';

const FLEET = 'garage_fleet';
const RECORDS = 'garage_records';
const LOGS = 'garage_logs';
// A device preference, not data: which phone is looking at which car is nobody else's business.
const SELECTED = 'garage_selected';
const OLD_KEY = 'vehicle_services_data';
const OLD_TITLES = 'vehicle_custom_titles';
// store.ts's account-mirror prefix. Reached around directly below because neither legacy key is
// a SYNCED_KEYS member (they never carry over into Garaj), so store.getItem/removeItem only ever
// see the plain tier — see readLegacyTier's own comment for why that tier alone isn't enough.
const ACCT = 'acct:';

const parse = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    const v: unknown = JSON.parse(raw);
    // JSON.parse("null") succeeds and returns null without throwing. That literal string is
    // reachable in practice — runFlush PUTs `data: null` for a cleared key, and applyPulled
    // writes JSON.stringify(null) verbatim — so guard against any non-object result, not just
    // the missing/malformed cases `raw` being falsy or JSON.parse throwing already cover.
    return v && typeof v === 'object' ? (v as T) : fallback;
  } catch {
    return fallback;
  }
};

// Both tiers, account first: the old tool wrote through store.setItem while its key was still a
// SYNCED_KEYS member, so a signed-in user's records live under the `acct:` mirror and were never
// in the plain tier at all. Reading only the plain tier either finds nothing for that user (gate
// never fires, history silently orphaned) or a stale pre-sign-in snapshot that looks like a
// successful backup while actually exporting months-old data.
const readLegacyTier = (key: string): string | null =>
  localStorage.getItem(ACCT + key) ?? localStorage.getItem(key);

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
  // `setData` is threaded straight to whichever tab is mounted (Vehicles first, Tasks 11-13
  // after). Every write a tab makes MUST produce a new object — never mutate `data` in place and
  // never pass back the exact object a tab was handed — because the save effect below tells a
  // real edit apart from its own mount by comparing `data` to `mountedWith.current` by identity.
  const [data, setData] = useState<GarageData>(readGarage);
  const [tab, setTab] = useState<'overview' | 'vehicles' | 'costs' | 'settings'>('overview');
  const [vehicleId, setVehicleId] = useState<string | null>(() => store.getItem(SELECTED));
  // Vehicle-detail navigation contract (established here for Task 11): when non-null, the
  // vehicle detail page renders in place of the active tab's body while the tab row stays put —
  // it is a stacked view, not a route, so it deliberately does not persist across a reload. Kept
  // live (not voided away) because the way back is genuinely the shell's own job, not a tab's.
  const [detailId, setDetailId] = useState<string | null>(null);
  // The old tool's data is still on this device and has not been dealt with yet.
  const [legacy, setLegacy] = useState<string | null>(() => readLegacyTier(OLD_KEY));

  // A mount is not an edit. The value this component mounted with, compared by identity rather
  // than a toggled boolean: React StrictMode double-invokes passive effects in dev
  // (commitDoubleInvokeEffectsInDEV re-runs the same setup after its no-op cleanup), so a
  // one-shot ref that flips false on first run would perform the very write this guards against
  // on that second, dev-only invocation. Comparing `data` to what we mounted with is idempotent —
  // it gives the same answer no matter how many times it runs — and on a signed-in device whose
  // boot pull hasn't landed yet, readGarage() legitimately finds nothing, so skipping this write
  // matters for real: bootstrap() flushes dirty keys BEFORE applying a pull that arrives after,
  // so an empty push here would win that race, and garage_fleet is the only key in the app with a
  // server-side cascading delete behind it — destroying every service, document, energy log,
  // odometer reading and reminder along with it. All three keys still write together on every
  // REAL change — this only defers the first tick, it does not narrow which keys a change writes.
  const mountedWith = useRef(data);
  useEffect(() => {
    if (data === mountedWith.current) return;
    store.setItem(FLEET, JSON.stringify({ vehicles: data.vehicles, presets: data.presets }));
    store.setItem(RECORDS, JSON.stringify({ services: data.services, docs: data.docs }));
    store.setItem(LOGS, JSON.stringify({ energy: data.energy, odo: data.odo, reminders: data.reminders }));
  }, [data]);

  // Unsynced and non-cascading (see the SELECTED comment up top), so — unlike the fleet write
  // above — writing the same value back on mount is genuinely harmless; kept so the effect is
  // already correct the moment Task 10 gives `vehicleId` a setter and it starts actually changing.
  useEffect(() => {
    if (vehicleId) store.setItem(SELECTED, vehicleId);
  }, [vehicleId]);

  if (legacy) {
    return <LegacyGate raw={legacy} titlesRaw={readLegacyTier(OLD_TITLES)} onDone={() => {
      // Both tiers of both keys — the plain one this device may have written before ever signing
      // in, and the account mirror the old tool actually used once signed in (see readLegacyTier).
      localStorage.removeItem(OLD_KEY);
      localStorage.removeItem(ACCT + OLD_KEY);
      localStorage.removeItem(OLD_TITLES);
      localStorage.removeItem(ACCT + OLD_TITLES);
      setLegacy(null);
    }} />;
  }

  const TABS = [
    ['overview', tr('Utama', 'Overview'), Gauge],
    ['vehicles', tr('Kenderaan', 'Vehicles'), CarFront],
    ['costs', tr('Kos', 'Costs'), BarChart3],
    ['settings', tr('Tetapan', 'Settings'), Settings2],
  ] as const;

  return (
    <div className="pb-28">
      <div className="grid grid-cols-4 gap-1 bg-text/5 p-1 rounded-xl mb-1">
        {TABS.map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`py-2 text-[10px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
              tab === key ? 'bg-surface text-emerald-400 light:text-emerald-700 shadow-sm' : 'text-muted hover:text-text'}`}>
            <Icon size={17} />{label}
          </button>
        ))}
      </div>
      {detailId ? (
        // A fragment, not a replacement: the shell only guarantees the way back, so Back has to
        // keep rendering even once Task 11's real detail body mounts alongside it below — the
        // integration bug this comment used to warn about (the button being the ONLY thing that
        // rendered here) is exactly what a bare `return <button.../>` would still be.
        <>
          <button onClick={() => setDetailId(null)}
            className="flex items-center gap-1 text-sm text-muted hover:text-text px-1 py-3">
            <ChevronLeft size={16} /> {tr('Kembali', 'Back')}
          </button>
          {(() => {
            const vehicle = data.vehicles.find((v) => v.id === detailId);
            // Only reachable if the vehicle was deleted out from under an open detail page —
            // detailId itself never survives a reload (see its own comment above) — and
            // VehicleDetail already calls back to setDetailId(null) the moment that happens, so
            // this is a one-frame guard, not a real empty state to design for.
            return vehicle
              ? <VehicleDetail vehicle={vehicle} data={data} setData={setData} onBack={() => setDetailId(null)} />
              : null;
          })()}
        </>
      ) : (
        <>
          {/* Each tab is rendered here, gated on `tab`; see Tasks 10-13. */}
          {tab === 'overview' && (
            <Overview data={data} setData={setData} vehicleId={vehicleId} setVehicleId={setVehicleId} onOpenVehicle={setDetailId} />
          )}
          {tab === 'vehicles' && <Vehicles data={data} setData={setData} onOpen={setDetailId} />}
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
 * JSON is offered as a file first, service records and the custom titles the owner typed both
 * included in the one download.
 */
function LegacyGate({ raw, titlesRaw, onDone }: { raw: string; titlesRaw: string | null; onDone: () => void }) {
  const tr = useT();
  const [downloaded, setDownloaded] = useState(false);

  // Best-effort per half: a malformed titles blob must not cost the (far larger) records blob
  // its recoverability, or vice versa. Falls back to the raw string itself rather than dropping
  // the half entirely, so even unparseable data still leaves the disk with everything that was
  // there.
  const safeParse = (s: string | null): unknown => {
    if (!s) return null;
    try { return JSON.parse(s); } catch { return s; }
  };

  const download = () => {
    const body = JSON.stringify({ data: safeParse(raw), titles: safeParse(titlesRaw) });
    const url = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `servis-kenderaan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    // Not every engine fires a click on a detached element — appended and removed around the
    // click so this, the app's one unrecoverable download, doesn't depend on that varying.
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setDownloaded(true);
  };

  return (
    <div className="px-1 py-6">
      <h2 className="font-display text-2xl mb-2">{tr('Garaj menggantikan Servis Kenderaan', 'Garaj replaces Servis Kenderaan')}</h2>
      <p className="text-sm text-muted mb-5 leading-relaxed">
        {tr('Rekod lama tidak dipindahkan ke Garaj — termasuk tajuk kenderaan yang anda tetapkan sendiri. Muat turun salinan dahulu jika anda mahu menyimpannya — selepas ini semuanya akan dibuang dari peranti ini.',
            'Your old records are not carried over into Garaj — including any custom vehicle titles you set. Download a copy first if you want to keep them — after this all of it is removed from this device.')}
      </p>
      <button onClick={download}
        className="w-full py-3.5 rounded-xl bg-emerald-600 text-[#ffffff] font-display uppercase tracking-wider mb-3">
        {tr('Muat turun rekod lama', 'Download my old records')}
      </button>
      <button onClick={() => {
        // `downloaded` only means the browser was ASKED to save a file — there is no completion
        // signal for the <a download> path, and a block by browser settings or an iOS Safari tab
        // that opens instead of saving both still flip it. Never trust it to skip the prompt
        // outright; only its wording changes.
        if (!window.confirm(tr(
          downloaded
            ? 'Fail telah ditawarkan untuk dimuat turun. Teruskan dan buang rekod lama?'
            : 'Anda belum memuat turun salinan. Teruskan dan buang rekod lama?',
          downloaded
            ? 'A file was offered for download. Continue and remove the old records?'
            : "You haven't downloaded a copy. Continue and remove the old records?"
        ))) return;
        onDone();
      }} className="w-full py-3.5 rounded-xl border border-text/15 text-muted font-display uppercase tracking-wider">
        {tr('Mula dari kosong', 'Start fresh')}
      </button>
    </div>
  );
}
