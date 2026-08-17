// The Vehicles tab: a card per vehicle, plus the create/edit sheet. Self-contained — it owns
// the sheet's open/target state itself, since neither is part of the shell's navigation
// contract (that's `detailId`, reserved for the Task 11 detail page a card's own tap opens).
import { useState, type Dispatch, type SetStateAction } from 'react';
import { Pencil } from 'lucide-react';
import { currentOdo, dueItems, withoutVehicle, type GarageData, type Vehicle } from '../../lib/garage';
import { BODIES, ENERGIES, engineSpec } from '../../lib/garage-presets';
import { Pill, Empty, AddButton, EDGE_COLORS, fmtKm } from './parts';
import { VehicleSheet } from './sheets';
import { useT } from '../../lib/lang';

const num = { fontVariantNumeric: 'tabular-nums' } as const;

function VehicleCard({ v, data, onOpen, onEdit }: {
  v: Vehicle; data: GarageData; onOpen: () => void; onEdit: () => void;
}) {
  const t = useT();
  const items = dueItems(data, v.id);
  const overCount = items.filter((i) => i.status.level === 'over').length;
  const soonCount = items.filter((i) => i.status.level === 'soon').length;
  // over beats soon beats "all clear" — the same precedence statusOf itself uses for a single
  // item, just rolled up across every reminder and document this vehicle owns.
  const pillLevel = overCount > 0 ? 'over' : soonCount > 0 ? 'soon' : 'ok';
  const pillText = overCount > 0
    ? t(`${overCount} lewat`, `${overCount} overdue`)
    : soonCount > 0
      ? t(`${soonCount} akan tiba`, `${soonCount} due soon`)
      : t('Semua elok', 'All clear');

  const spec = engineSpec(v.body, v.energy);
  const typeLine = [
    t(BODIES[v.body].ms, BODIES[v.body].en),
    t(ENERGIES[v.energy].ms, ENERGIES[v.energy].en),
    v.engine ? `${v.engine} ${spec.unit}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="relative rounded-2xl overflow-hidden border border-text/10 bg-surface min-h-[132px]">
      <button onClick={onOpen} className="absolute inset-0 w-full h-full text-left" aria-label={v.nickname || v.model}>
        {v.photo ? (
          <>
            <img src={v.photo} alt="" className="absolute inset-0 w-full h-full object-cover" />
            {/* A literal rgba gradient, not `bg-black/NN` — that class resolves through the
                `black` token, which INVERTS to near-white under html.light (index.css), turning
                this scrim into a wash that fights the photo instead of grounding the text. */}
            <div className="absolute inset-0"
              style={{ background: 'linear-gradient(180deg, rgba(0,0,0,.08) 0%, rgba(0,0,0,.2) 45%, rgba(0,0,0,.88) 100%)' }} />
          </>
        ) : (
          <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: EDGE_COLORS[v.colorIdx % EDGE_COLORS.length] }} />
        )}
        <div className={`relative h-full flex flex-col justify-end gap-1 p-4 ${v.photo ? 'text-[#ffffff]' : 'pl-5'}`}>
          <p className={`font-display text-[11px] uppercase tracking-[0.14em] truncate ${v.photo ? 'text-[rgba(255,255,255,.75)]' : 'text-muted'}`}>
            {typeLine}
          </p>
          <p className="font-bold text-lg leading-tight truncate">{v.nickname || v.model}</p>
          <p className={`text-sm truncate ${v.photo ? 'text-[rgba(255,255,255,.85)]' : 'text-muted'}`}>
            {[v.brand, v.model].filter(Boolean).join(' ')}
          </p>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="font-mono text-sm font-semibold" style={num}>{fmtKm(currentOdo(data, v))} km</span>
            <Pill level={pillLevel}>{pillText}</Pill>
          </div>
        </div>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onEdit(); }}
        aria-label={t('Sunting kenderaan', 'Edit vehicle')}
        className={`absolute top-2 right-2 z-10 w-11 h-11 rounded-full flex items-center justify-center transition-colors ${
          v.photo ? 'text-[#ffffff] bg-[#000000]/35 hover:bg-[#000000]/50' : 'text-muted hover:text-text bg-surface/80 hover:bg-text/10'}`}
      >
        <Pencil size={16} />
      </button>
    </div>
  );
}

export default function Vehicles({ data, setData, onOpen }: {
  data: GarageData;
  setData: Dispatch<SetStateAction<GarageData>>;
  /** Opens the vehicle's detail page — the shell's `setDetailId`. */
  onOpen: (id: string) => void;
}) {
  const t = useT();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);

  const openCreate = () => { setEditing(null); setSheetOpen(true); };
  const openEdit = (v: Vehicle) => { setEditing(v); setSheetOpen(true); };

  const handleSave = (vehicle: Vehicle) => {
    setData((d) => ({
      ...d,
      vehicles: editing
        ? d.vehicles.map((v) => (v.id === vehicle.id ? vehicle : v))
        : [...d.vehicles, vehicle],
    }));
    setSheetOpen(false);
  };

  // withoutVehicle carries the cascade — see its own comment in garage.ts for why this and
  // VehicleDetail.tsx both call the one function rather than each spelling out the six filters.
  const handleDelete = (id: string) => {
    setData((d) => withoutVehicle(d, id));
    setSheetOpen(false);
  };

  return (
    <div className="px-1 pb-2">
        <AddButton label={t('Tambah kenderaan', 'Add vehicle')} onClick={openCreate} />

      {data.vehicles.length === 0 ? (
        <Empty
          title={t('Belum ada kenderaan', 'No vehicles yet')}
          hint={t('Ketik "Tambah kenderaan" untuk mula.', 'Tap "Add vehicle" to get started.')}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {data.vehicles.map((v) => (
            <VehicleCard key={v.id} v={v} data={data} onOpen={() => onOpen(v.id)} onEdit={() => openEdit(v)} />
          ))}
        </div>
      )}

      <VehicleSheet
        // Remount on every open (and on switching target) instead of syncing fields via effects
        // — the closed state doesn't need to be a real instance at all, and a fresh mount is a
        // correct-by-construction reset of every field back to `vehicle`'s own values.
        key={sheetOpen ? (editing?.id ?? 'new') : 'closed'}
        open={sheetOpen}
        vehicle={editing}
        data={data}
        onClose={() => setSheetOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
