// The tool registry. Lived in Home.tsx until the landing page became a third consumer
// alongside Layout — importing Home just to read this array pulled the whole 1500-line
// dashboard into the landing chunk.
import {
  MapPin, PieChart, Timer, Wallet, Calendar, ShieldAlert, Plane, ShoppingCart, Gift,
  KeyRound, Dices, Repeat, Droplets, ListChecks, HandCoins, Utensils, IdCard,
  Box, BookOpen, Hash, FileSignature, CarFront, Home as HomeIcon
} from 'lucide-react';
// Explicit .ts extension so `node --test` can resolve this too (Vite handles it either way).
import { SYNCED_ROUTES, store } from './store.ts';
import { t } from './lang.ts';

// Tool *names* stay as they are in both languages — they're the product's own vocabulary, and
// "IC Palang" or "Kira Duit Raya" doesn't have a useful English equivalent. Only the one-line
// descriptions and the category headings switch. Categories keep their Malay string as the
// grouping key so nothing downstream has to re-key when the language changes; this map is
// display-only.
export const CATEGORY_EN: Record<string, string> = {
  'Utiliti': 'Utilities',
  'Kenderaan & Perjalanan': 'Vehicle & Travel',
  'Kewangan': 'Money',
  'Gaya Hidup': 'Lifestyle',
  'Kesihatan & Kecergasan': 'Health & Fitness',
  'Hiburan': 'Fun',
};

export const categoryLabel = (c: string) => t(c, CATEGORY_EN[c] ?? c);
export const toolDesc = (tool: { desc: string; descEn?: string }) => t(tool.desc, tool.descEn ?? tool.desc);

// Order follows spec §2: expiry & recurrence first (the reason the app exists), then structured
// records, then the privacy utilities, then the small convenience tools last. Home renders in
// this order, so the registry itself is the ranking — no per-device sort to keep in sync.
export const DEFAULT_TOOLS = [
  // — Expiry & recurrence: the core
  {
    id: '/document-expiry', to: '/document-expiry', title: 'Document Expiry', desc: 'Rekod pasport, roadtax dan lain-lain', descEn: 'Passport, roadtax and everything else', Icon: ShieldAlert, category: 'Utiliti',
    borderClass: 'hover:border-red-500/50 hover:shadow-red-500/20', iconBgClass: 'bg-red-500/20 text-red-400', arrowClass: 'group-hover:text-red-400'
  },
  {
    id: '/asset-warranty', to: '/asset-warranty', title: 'Asset & Warranty', desc: 'Rekod barang berharga & waranti', descEn: 'Valuables and their warranties', Icon: Box, category: 'Utiliti',
    borderClass: 'hover:border-amber-400/50 hover:shadow-amber-400/20', iconBgClass: 'bg-amber-500/20 text-amber-500', arrowClass: 'group-hover:text-amber-500'
  },
  {
    id: '/vehicle-services', to: '/vehicle-services', title: 'Garaj', desc: 'Kenderaan, servis, minyak & kos', descEn: 'Vehicles, service, fuel and running costs', Icon: CarFront, category: 'Kenderaan & Perjalanan',
    borderClass: 'hover:border-amber-400/50 hover:shadow-amber-400/20', iconBgClass: 'bg-amber-500/20 text-amber-500', arrowClass: 'group-hover:text-amber-500'
  },
  {
    id: '/home-services', to: '/home-services', title: 'Servis Rumah', desc: 'Rekod baiki & kos rumah', descEn: 'Home repairs and their costs', Icon: HomeIcon, category: 'Utiliti',
    borderClass: 'hover:border-teal-500/50 hover:shadow-teal-500/20', iconBgClass: 'bg-teal-600/20 text-teal-500', arrowClass: 'group-hover:text-teal-500'
  },
  {
    id: '/commitments', to: '/commitments', title: 'Commitments', desc: 'Rekod semua komitmen bulanan', descEn: 'Every monthly commitment in one place', Icon: Repeat, category: 'Kewangan',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  {
    id: '/tenancy', to: '/tenancy', title: 'Sewa & Kontrak', desc: 'Sewaan, kontrak & pembaharuan', descEn: 'Tenancies, contracts and renewals', Icon: KeyRound, category: 'Utiliti',
    borderClass: 'hover:border-teal-400/50 hover:shadow-teal-400/20', iconBgClass: 'bg-teal-500/20 text-teal-400', arrowClass: 'group-hover:text-teal-400'
  },
  {
    id: '/countdown', to: '/countdown', title: 'Countdown Day', desc: 'Rekod acara & cuti', descEn: 'Events and holidays to count down to', Icon: Calendar, category: 'Utiliti',
    borderClass: 'hover:border-pink-500/50 hover:shadow-pink-500/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  {
    id: '/debt-tracker', to: '/debt-tracker', title: 'Catat Hutang', desc: 'Rekod hutang ringkas', descEn: 'A simple record of who owes who', Icon: HandCoins, category: 'Kewangan',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },

  // — Structured records
  {
    id: '/expense-manager', to: '/expense-manager', title: 'Expense Manager', desc: 'Pendapatan, komitmen & perbelanjaan', descEn: 'Income, commitments and spending', Icon: Wallet, category: 'Kewangan',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  {
    id: '/important-numbers', to: '/important-numbers', title: 'Important Number / Date', desc: 'Akaun, polisi, ID & tarikh', descEn: 'Account, policy and ID numbers, and dates', Icon: Hash, category: 'Utiliti',
    borderClass: 'hover:border-fuchsia-400/50 hover:shadow-fuchsia-400/20', iconBgClass: 'bg-fuchsia-500/20 text-fuchsia-400', arrowClass: 'group-hover:text-fuchsia-400'
  },
  {
    id: '/habit-tracker', to: '/habit-tracker', title: 'Habit Tracker', desc: 'Bina streak & rekod tabiat', descEn: 'Build a streak and track your habits', Icon: ListChecks, category: 'Gaya Hidup',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  {
    id: '/duit-raya', to: '/duit-raya', title: 'Kira Duit Raya', desc: 'Rancang & rekod duit raya / angpao', descEn: 'Plan and track duit raya / angpao', Icon: Gift, category: 'Kewangan',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  {
    id: '/travel-history', to: '/travel-history', title: 'My Travel History', desc: 'Rekod perjalanan yang anda lalui', descEn: 'Every trip you have taken', Icon: Plane, category: 'Kenderaan & Perjalanan',
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20', iconBgClass: 'bg-cyan-500/20 text-cyan-400', arrowClass: 'group-hover:text-cyan-400'
  },
  {
    id: '/book-tracker', to: '/book-tracker', title: 'My Books', desc: 'Rekod bacaan, senarai hajat & petikan', descEn: 'Reading list, wishlist and quotes', Icon: BookOpen, category: 'Gaya Hidup',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  {
    id: '/parking', to: '/parking', title: 'Lupa parking?', desc: 'Simpan & cari kenderaan anda', descEn: 'Save and find where you parked', Icon: MapPin, category: 'Kenderaan & Perjalanan',
    borderClass: 'hover:border-secondary/50 hover:shadow-secondary/20', iconBgClass: 'bg-secondary/20 text-secondary', arrowClass: 'group-hover:text-secondary'
  },

  // — Privacy utilities
  {
    id: '/ic-scanner', to: '/ic-scanner', title: 'IC Palang', desc: 'Imbas & jana PDF', descEn: 'Scan and generate a redacted PDF', Icon: IdCard, category: 'Utiliti',
    borderClass: 'hover:border-primary/50 hover:shadow-primary/20', iconBgClass: 'bg-primary/20 text-primary', arrowClass: 'group-hover:text-primary'
  },
  {
    id: '/pdf-editor', to: '/pdf-editor', title: 'PDF Editor', desc: 'Tambah teks & tandatangan pada PDF', descEn: 'Add text and signatures to a PDF', Icon: FileSignature, category: 'Utiliti',
    borderClass: 'hover:border-blue-500/50 hover:shadow-blue-500/20', iconBgClass: 'bg-blue-600/20 text-blue-500', arrowClass: 'group-hover:text-blue-500'
  },

  // — Kept for convenience (see EXTRA_IDS below)
  {
    id: '/water-tracker', to: '/water-tracker', title: 'Minum', desc: 'Pengambilan air dengan animasi cecair', descEn: 'Water intake, with a liquid animation', Icon: Droplets, category: 'Kesihatan & Kecergasan',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/restaurant-splitter', to: '/restaurant-splitter', title: 'Restaurant Bill Splitter', desc: 'Bahagi makanan & cukai berkadar', descEn: 'Split dishes and tax proportionally', Icon: Utensils, category: 'Kewangan',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  {
    id: '/grocery-budget', to: '/grocery-budget', title: 'Grocery Budget', desc: 'Rekod jumlah troli semasa beli-belah', descEn: 'Track your trolley total as you shop', Icon: ShoppingCart, category: 'Gaya Hidup',
    borderClass: 'hover:border-green-400/50 hover:shadow-green-400/20', iconBgClass: 'bg-green-500/20 text-green-400', arrowClass: 'group-hover:text-green-400'
  },
  {
    id: '/pace-calculator', to: '/pace-calculator', title: 'Kira Pace', desc: 'Masa, jarak & pace', descEn: 'Time, distance and pace', Icon: Timer, category: 'Kesihatan & Kecergasan',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/decision-maker', to: '/decision-maker', title: 'Spin the wheel', desc: 'Buat keputusan rawak', descEn: 'Make a random decision', Icon: PieChart, category: 'Hiburan',
    borderClass: 'hover:border-accent/50 hover:shadow-accent/20', iconBgClass: 'bg-accent/20 text-accent', arrowClass: 'group-hover:text-accent'
  },
  {
    id: '/randomizer', to: '/randomizer', title: 'Randomizer', desc: 'Syiling, dadu, nombor dan botol', descEn: 'Coin, dice, numbers and a spun bottle', Icon: Dices, category: 'Hiburan',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  {
    id: 'https://befday.com/', to: 'https://befday.com/', title: 'Birthday Claim', desc: 'Tahu di mana nak tuntut hadiah hari jadi (kredit dzulhelmynazri)', descEn: 'Find where to claim your birthday gifts (credit dzulhelmynazri)', Icon: Gift, category: 'Hiburan',
    borderClass: 'hover:border-pink-400/50 hover:shadow-pink-400/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  }
];

// Tools flagged as "HOT" — shown with a badge
export const HOT_IDS = ['/document-expiry', '/vehicle-services', '/home-services', '/duit-raya', '/travel-history', '/pdf-editor'];

// Side tools that support the record tools rather than being the reason you opened the app —
// spec §2 "Kept for convenience", plus Minum (it holds records, but a daily water tick is not
// what the app is for). Home shows these under "Lain-lain", below everything else.
export const EXTRA_IDS = ['/water-tracker', '/restaurant-splitter', '/grocery-budget', '/pace-calculator', '/decision-maker', '/randomizer', 'https://befday.com/'];
export const CORE_TOOLS = DEFAULT_TOOLS.filter((t) => !EXTRA_IDS.includes(t.id));
export const EXTRA_TOOLS = DEFAULT_TOOLS.filter((t) => EXTRA_IDS.includes(t.id));

// Which tools keep records (and so earn an account) is derived from SYNCED_ROUTES rather than
// listed again here — a tool added later sorts itself, and store.test.ts asserts the split
// covers every catalog entry.
export const savesData = (to: string) => Boolean(SYNCED_ROUTES[to]);

// The Duit Raya tool renames and recolours itself from the theme saved on its own page, so
// everywhere it appears (Home cards, recents, the desktop rail) reads the look from here.
export const duitRayaLook = () => {
  let angpao = false;
  try {
    const s = store.getItem('duit_raya_manager_data');
    angpao = !!s && JSON.parse(s).theme === 'angpao';
  } catch (e) {}
  return angpao
    ? { title: 'Kira Angpao', desc: 'Rancang & rekod angpao CNY', descEn: 'Plan and track CNY angpao', iconBgClass: 'bg-red-500/20 text-red-400', emoji: '🧧' }
    : { title: 'Kira Duit Raya', desc: 'Rancang & rekod duit raya', descEn: 'Plan and track duit raya', iconBgClass: 'bg-emerald-500/20 text-emerald-400', emoji: '🌙' };
};
export const MAIN_TOOLS = DEFAULT_TOOLS.filter((t) => savesData(t.to));
export const SIDE_TOOLS = DEFAULT_TOOLS.filter((t) => !savesData(t.to));
