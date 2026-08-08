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

// Order follows spec §2: expiry & recurrence first (the reason the app exists), then structured
// records, then the privacy utilities, then the small convenience tools last. Home renders in
// this order, so the registry itself is the ranking — no per-device sort to keep in sync.
export const DEFAULT_TOOLS = [
  // — Expiry & recurrence: the core
  {
    id: '/document-expiry', to: '/document-expiry', title: 'Document Expiry', desc: 'Track Passport, Roadtax, etc.', Icon: ShieldAlert, category: 'Utilities',
    borderClass: 'hover:border-red-500/50 hover:shadow-red-500/20', iconBgClass: 'bg-red-500/20 text-red-400', arrowClass: 'group-hover:text-red-400'
  },
  {
    id: '/asset-warranty', to: '/asset-warranty', title: 'Asset & Warranty', desc: 'Track valuables and warranties', Icon: Box, category: 'Utilities',
    borderClass: 'hover:border-amber-400/50 hover:shadow-amber-400/20', iconBgClass: 'bg-amber-500/20 text-amber-500', arrowClass: 'group-hover:text-amber-500'
  },
  {
    id: '/vehicle-services', to: '/vehicle-services', title: 'Servis Kenderaan', desc: 'Rekod servis & kos kenderaan', Icon: CarFront, category: 'Auto & Travel',
    borderClass: 'hover:border-amber-400/50 hover:shadow-amber-400/20', iconBgClass: 'bg-amber-500/20 text-amber-500', arrowClass: 'group-hover:text-amber-500'
  },
  {
    id: '/home-services', to: '/home-services', title: 'Servis Rumah', desc: 'Rekod baiki & kos rumah', Icon: HomeIcon, category: 'Utilities',
    borderClass: 'hover:border-teal-500/50 hover:shadow-teal-500/20', iconBgClass: 'bg-teal-600/20 text-teal-500', arrowClass: 'group-hover:text-teal-500'
  },
  {
    id: '/commitments', to: '/commitments', title: 'Commitments', desc: 'Track all monthly commitments', Icon: Repeat, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  {
    id: '/tenancy', to: '/tenancy', title: 'Sewa & Kontrak', desc: 'Rentals, contracts & renewals', Icon: KeyRound, category: 'Utilities',
    borderClass: 'hover:border-teal-400/50 hover:shadow-teal-400/20', iconBgClass: 'bg-teal-500/20 text-teal-400', arrowClass: 'group-hover:text-teal-400'
  },
  {
    id: '/countdown', to: '/countdown', title: 'Countdown Day', desc: 'Track Events & Holidays', Icon: Calendar, category: 'Utilities',
    borderClass: 'hover:border-pink-500/50 hover:shadow-pink-500/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  {
    id: '/debt-tracker', to: '/debt-tracker', title: 'Catat Hutang', desc: 'Track Simple IOUs', Icon: HandCoins, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },

  // — Structured records
  {
    id: '/expense-manager', to: '/expense-manager', title: 'Expense Manager', desc: 'Income, commitments & spending', Icon: Wallet, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  {
    id: '/important-numbers', to: '/important-numbers', title: 'Important Number / Date', desc: 'Accounts, policies, IDs & dates', Icon: Hash, category: 'Utilities',
    borderClass: 'hover:border-fuchsia-400/50 hover:shadow-fuchsia-400/20', iconBgClass: 'bg-fuchsia-500/20 text-fuchsia-400', arrowClass: 'group-hover:text-fuchsia-400'
  },
  {
    id: '/habit-tracker', to: '/habit-tracker', title: 'Habit Tracker', desc: 'Build streaks & track habits', Icon: ListChecks, category: 'Lifestyle',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  {
    id: '/duit-raya', to: '/duit-raya', title: 'Kira Duit Raya', desc: 'Plan & track Raya / Angpao money', Icon: Gift, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  {
    id: '/travel-history', to: '/travel-history', title: 'My Travel History', desc: 'Record trips you have taken', Icon: Plane, category: 'Auto & Travel',
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20', iconBgClass: 'bg-cyan-500/20 text-cyan-400', arrowClass: 'group-hover:text-cyan-400'
  },
  {
    id: '/book-tracker', to: '/book-tracker', title: 'My Books', desc: 'Track reading, wishlist & quotes', Icon: BookOpen, category: 'Lifestyle',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  {
    id: '/parking', to: '/parking', title: 'Lupa parking?', desc: 'Save & find your vehicle', Icon: MapPin, category: 'Auto & Travel',
    borderClass: 'hover:border-secondary/50 hover:shadow-secondary/20', iconBgClass: 'bg-secondary/20 text-secondary', arrowClass: 'group-hover:text-secondary'
  },

  // — Privacy utilities
  {
    id: '/ic-scanner', to: '/ic-scanner', title: 'IC Palang', desc: 'Scan & generate PDF', Icon: IdCard, category: 'Utilities',
    borderClass: 'hover:border-primary/50 hover:shadow-primary/20', iconBgClass: 'bg-primary/20 text-primary', arrowClass: 'group-hover:text-primary'
  },
  {
    id: '/pdf-editor', to: '/pdf-editor', title: 'PDF Editor', desc: 'Add text & signatures to PDFs', Icon: FileSignature, category: 'Utilities',
    borderClass: 'hover:border-blue-500/50 hover:shadow-blue-500/20', iconBgClass: 'bg-blue-600/20 text-blue-500', arrowClass: 'group-hover:text-blue-500'
  },

  // — Kept for convenience (see EXTRA_IDS below)
  {
    id: '/water-tracker', to: '/water-tracker', title: 'Minum', desc: 'Hydration with fluid animations', Icon: Droplets, category: 'Health & Fitness',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/restaurant-splitter', to: '/restaurant-splitter', title: 'Restaurant Bill Splitter', desc: 'Split food & proportional tax', Icon: Utensils, category: 'Finance',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  {
    id: '/grocery-budget', to: '/grocery-budget', title: 'Grocery Budget', desc: 'Track cart total while shopping', Icon: ShoppingCart, category: 'Lifestyle',
    borderClass: 'hover:border-green-400/50 hover:shadow-green-400/20', iconBgClass: 'bg-green-500/20 text-green-400', arrowClass: 'group-hover:text-green-400'
  },
  {
    id: '/pace-calculator', to: '/pace-calculator', title: 'Kira Pace', desc: 'Time, Distance & Pace', Icon: Timer, category: 'Health & Fitness',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/decision-maker', to: '/decision-maker', title: 'Spin the wheel', desc: 'Make random decisions', Icon: PieChart, category: 'Fun',
    borderClass: 'hover:border-accent/50 hover:shadow-accent/20', iconBgClass: 'bg-accent/20 text-accent', arrowClass: 'group-hover:text-accent'
  },
  {
    id: '/randomizer', to: '/randomizer', title: 'Randomizer', desc: 'Coin, Dice, Numbers and Bottle', Icon: Dices, category: 'Fun',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  {
    id: 'https://befday.com/', to: 'https://befday.com/', title: 'Birthday Claim', desc: 'Know where to claim birthday (credit dzulhelmynazri)', Icon: Gift, category: 'Fun',
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
    ? { title: 'Kira Angpao', desc: 'Plan & track CNY packets', iconBgClass: 'bg-red-500/20 text-red-400', emoji: '🧧' }
    : { title: 'Kira Duit Raya', desc: 'Plan & track Raya money', iconBgClass: 'bg-emerald-500/20 text-emerald-400', emoji: '🌙' };
};
export const MAIN_TOOLS = DEFAULT_TOOLS.filter((t) => savesData(t.to));
export const SIDE_TOOLS = DEFAULT_TOOLS.filter((t) => !savesData(t.to));
