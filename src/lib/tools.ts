// The tool registry. Lived in Home.tsx until the landing page became a third consumer
// alongside Layout — importing Home just to read this array pulled the whole 1500-line
// dashboard into the landing chunk.
import {
  MapPin, PieChart, Timer, Wallet, Calendar, ShieldAlert, Plane, ShoppingCart, Gift,
  Cake, KeyRound, Dices, Repeat, Droplets, ListChecks, HandCoins, Utensils, IdCard,
  Box, BookOpen, Hash, FileSignature, CarFront, Home as HomeIcon
} from 'lucide-react';
// Explicit .ts extension so `node --test` can resolve this too (Vite handles it either way).
import { SYNCED_ROUTES } from './store.ts';

export const DEFAULT_TOOLS = [
  { 
    id: '/ic-scanner', to: '/ic-scanner', title: 'IC Palang', desc: 'Scan & generate PDF', Icon: IdCard, category: 'Utilities',
    borderClass: 'hover:border-primary/50 hover:shadow-primary/20', iconBgClass: 'bg-primary/20 text-primary', arrowClass: 'group-hover:text-primary'
  },
  { 
    id: '/parking', to: '/parking', title: 'Lupa parking?', desc: 'Save & find your vehicle', Icon: MapPin, category: 'Auto & Travel',
    borderClass: 'hover:border-secondary/50 hover:shadow-secondary/20', iconBgClass: 'bg-secondary/20 text-secondary', arrowClass: 'group-hover:text-secondary'
  },
  { 
    id: '/decision-maker', to: '/decision-maker', title: 'Spin the wheel', desc: 'Make random decisions', Icon: PieChart, category: 'Fun',
    borderClass: 'hover:border-accent/50 hover:shadow-accent/20', iconBgClass: 'bg-accent/20 text-accent', arrowClass: 'group-hover:text-accent'
  },
  { 
    id: '/pace-calculator', to: '/pace-calculator', title: 'Kira Pace', desc: 'Time, Distance & Pace', Icon: Timer, category: 'Health & Fitness',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/countdown', to: '/countdown', title: 'Countdown Day', desc: 'Track Events & Holidays', Icon: Calendar, category: 'Utilities',
    borderClass: 'hover:border-pink-500/50 hover:shadow-pink-500/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  {
    id: '/document-expiry', to: '/document-expiry', title: 'Document Expiry', desc: 'Track Passport, Roadtax, etc.', Icon: ShieldAlert, category: 'Utilities',
    borderClass: 'hover:border-red-500/50 hover:shadow-red-500/20', iconBgClass: 'bg-red-500/20 text-red-400', arrowClass: 'group-hover:text-red-400'
  },
  {
    id: '/grocery-budget', to: '/grocery-budget', title: 'Grocery Budget', desc: 'Track cart total while shopping', Icon: ShoppingCart, category: 'Lifestyle',
    borderClass: 'hover:border-green-400/50 hover:shadow-green-400/20', iconBgClass: 'bg-green-500/20 text-green-400', arrowClass: 'group-hover:text-green-400'
  },
  {
    id: '/randomizer', to: '/randomizer', title: 'Randomizer', desc: 'Coin, Dice, Numbers and Bottle', Icon: Dices, category: 'Fun',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  { 
    id: '/commitments', to: '/commitments', title: 'Commitments', desc: 'Track all monthly commitments', Icon: Repeat, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  { 
    id: '/water-tracker', to: '/water-tracker', title: 'Minum', desc: 'Hydration with fluid animations', Icon: Droplets, category: 'Health & Fitness',
    borderClass: 'hover:border-blue-400/50 hover:shadow-blue-400/20', iconBgClass: 'bg-blue-500/20 text-blue-400', arrowClass: 'group-hover:text-blue-400'
  },
  {
    id: '/debt-tracker', to: '/debt-tracker', title: 'Catat Hutang', desc: 'Track Simple IOUs', Icon: HandCoins, category: 'Finance',
    borderClass: 'hover:border-indigo-400/50 hover:shadow-indigo-400/20', iconBgClass: 'bg-indigo-500/20 text-indigo-400', arrowClass: 'group-hover:text-indigo-400'
  },
  {
    id: 'https://befday.com/', to: 'https://befday.com/', title: 'Birthday Claim', desc: 'Know where to claim birthday (credit dzulhelmynazri)', Icon: Gift, category: 'Fun',
    borderClass: 'hover:border-pink-400/50 hover:shadow-pink-400/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  { 
    id: '/restaurant-splitter', to: '/restaurant-splitter', title: 'Restaurant Bill Splitter', desc: 'Split food & proportional tax', Icon: Utensils, category: 'Finance',
    borderClass: 'hover:border-rose-400/50 hover:shadow-rose-400/20', iconBgClass: 'bg-rose-500/20 text-rose-400', arrowClass: 'group-hover:text-rose-400'
  },
  {
    id: '/duit-raya', to: '/duit-raya', title: 'Kira Duit Raya', desc: 'Plan & track Raya / Angpao money', Icon: Gift, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  {
    id: '/habit-tracker', to: '/habit-tracker', title: 'Habit Tracker', desc: 'Build streaks & track habits', Icon: ListChecks, category: 'Lifestyle',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  {
    id: '/expense-manager', to: '/expense-manager', title: 'Expense Manager', desc: 'Income, commitments & spending', Icon: Wallet, category: 'Finance',
    borderClass: 'hover:border-emerald-400/50 hover:shadow-emerald-400/20', iconBgClass: 'bg-emerald-500/20 text-emerald-400', arrowClass: 'group-hover:text-emerald-400'
  },
  {
    id: '/travel-history', to: '/travel-history', title: 'My Travel History', desc: 'Record trips you have taken', Icon: Plane, category: 'Auto & Travel',
    borderClass: 'hover:border-cyan-400/50 hover:shadow-cyan-400/20', iconBgClass: 'bg-cyan-500/20 text-cyan-400', arrowClass: 'group-hover:text-cyan-400'
  },
  {
    id: '/asset-warranty', to: '/asset-warranty', title: 'Asset & Warranty', desc: 'Track valuables and warranties', Icon: Box, category: 'Utilities',
    borderClass: 'hover:border-amber-400/50 hover:shadow-amber-400/20', iconBgClass: 'bg-amber-500/20 text-amber-500', arrowClass: 'group-hover:text-amber-500'
  },
  {
    id: '/book-tracker', to: '/book-tracker', title: 'My Books', desc: 'Track reading, wishlist & quotes', Icon: BookOpen, category: 'Lifestyle',
    borderClass: 'hover:border-violet-400/50 hover:shadow-violet-400/20', iconBgClass: 'bg-violet-500/20 text-violet-400', arrowClass: 'group-hover:text-violet-400'
  },
  {
    id: '/birthdays', to: '/birthdays', title: 'Birthdays', desc: 'Birthdays & anniversaries', Icon: Cake, category: 'Lifestyle',
    borderClass: 'hover:border-pink-400/50 hover:shadow-pink-400/20', iconBgClass: 'bg-pink-500/20 text-pink-400', arrowClass: 'group-hover:text-pink-400'
  },
  {
    id: '/tenancy', to: '/tenancy', title: 'Sewa & Kontrak', desc: 'Rentals, contracts & renewals', Icon: KeyRound, category: 'Utilities',
    borderClass: 'hover:border-teal-400/50 hover:shadow-teal-400/20', iconBgClass: 'bg-teal-500/20 text-teal-400', arrowClass: 'group-hover:text-teal-400'
  },
  {
    id: '/important-numbers', to: '/important-numbers', title: 'Important Numbers', desc: 'Accounts, policies & IDs', Icon: Hash, category: 'Utilities',
    borderClass: 'hover:border-fuchsia-400/50 hover:shadow-fuchsia-400/20', iconBgClass: 'bg-fuchsia-500/20 text-fuchsia-400', arrowClass: 'group-hover:text-fuchsia-400'
  },
  {
    id: '/vehicle-services', to: '/vehicle-services', title: 'Servis Kenderaan', desc: 'Track auto maintenance & cost', Icon: CarFront, category: 'Auto & Travel',
    borderClass: 'hover:border-amber-400/50 hover:shadow-amber-400/20', iconBgClass: 'bg-amber-500/20 text-amber-500', arrowClass: 'group-hover:text-amber-500'
  },
  {
    id: '/home-services', to: '/home-services', title: 'Servis Rumah', desc: 'Track home repairs & cost', Icon: HomeIcon, category: 'Utilities',
    borderClass: 'hover:border-teal-500/50 hover:shadow-teal-500/20', iconBgClass: 'bg-teal-600/20 text-teal-500', arrowClass: 'group-hover:text-teal-500'
  },
  {
    id: '/pdf-editor', to: '/pdf-editor', title: 'PDF Editor', desc: 'Add text & signatures to PDFs', Icon: FileSignature, category: 'Utilities',
    borderClass: 'hover:border-blue-500/50 hover:shadow-blue-500/20', iconBgClass: 'bg-blue-600/20 text-blue-500', arrowClass: 'group-hover:text-blue-500'
  }
];

// Tools flagged as "HOT" — shown with a badge and promoted to the top of the list
export const HOT_IDS = ['/ic-scanner', '/document-expiry', '/vehicle-services', '/home-services', '/duit-raya', '/habit-tracker', '/expense-manager', '/travel-history', '/restaurant-splitter', '/asset-warranty'];

// Which tools keep records (and so earn an account) is derived from SYNCED_ROUTES rather than
// listed again here — a tool added later sorts itself, and store.test.ts asserts the split
// covers every catalog entry.
export const savesData = (to: string) => Boolean(SYNCED_ROUTES[to]);
export const MAIN_TOOLS = DEFAULT_TOOLS.filter((t) => savesData(t.to));
export const SIDE_TOOLS = DEFAULT_TOOLS.filter((t) => !savesData(t.to));
