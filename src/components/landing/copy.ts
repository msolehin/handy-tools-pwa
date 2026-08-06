// Landing-page copy in both languages. Deliberately a plain object, not an i18n framework —
// spec §10 rules one out, and this is one page. The app itself keeps its own voice (Malay tool
// names, English body) and is unaffected by this toggle.
//
// `ms` is the source of truth: COPY is typed so `en` fails to compile if it misses a key.

import { useEffect, useState } from 'react';

export type Lang = 'ms' | 'en';

const ms = {
  nav: { openApp: 'Buka app', theme: (light: boolean): string => (light ? 'Mod gelap' : 'Mod cerah') },

  hero: {
    eyebrow: 'Roadtax/lesen · Servis Kereta/Rumah · Warranty · Sewa · Hutang',
    headline: ['Jangan', 'lupa', 'lagi.'],
    bodyBefore: 'App nota bagi you tulis apa-apa sahaja — sebab itulah you tak pernah buka balik, dan terlepas renewal, warranty, servis, hutang. SenangKit bagi setiap jenis rekod satu bentuk tetap: laju nak isi, dan ia datang cari you ',
    bodyEmphasis: 'sebelum',
    bodyAfter: ' tarikh.',
    ctaGuest: 'Mula guna — percuma',
    ctaUser: 'Buka app',
    secondary: (n: number): string => `Tengok ${n} alat`,
    note: 'Percuma. Tak perlu akaun untuk cuba — log masuk bila you nak ia disimpan.',
  },

  wall: {
    title: 'Apa yang tengah kejar you',
    live: 'Langsung',
    unit: 'hari',
    records: [
      { label: 'Sewa rumah', note: 'Bayaran bulanan' },
      { label: 'Roadtax Myvi', note: 'Kena renew' },
      { label: 'Pasport', note: 'Tarikh luput' },
      { label: 'Hari jadi Mak', note: 'Setiap tahun' },
      { label: 'Warranty aircond', note: 'Tamat tempoh tuntutan' },
    ],
  },

  scale: [
    { label: 'Selesa', hint: '60 hari ke atas' },
    { label: 'Dekat dah', hint: '8–60 hari' },
    { label: 'Kejar', hint: '7 hari ke bawah' },
  ],

  tools: {
    heading: 'Yang perlu diingat',
    body: (n: number): string => `${n} alat yang simpan rekod dan beritahu you sebelum tarikh sampai. Log masuk sekali, semuanya ikut you ke setiap peranti.`,
    deadlineGroup: 'Ada tarikh akhir',
    recordGroup: 'Simpanan peribadi',
    count: (n: number): string => `${n} alat`,
    sideHeading: 'Alat lain',
    sideBody: 'Tiada akaun, tiada apa disimpan, tiada apa dihantar ke mana-mana. Buka, dapat jawapan, tutup.',
  },

  reminds: {
    '/document-expiry': 'Sebelum pasport, roadtax atau lesen tamat tempoh',
    '/asset-warranty': 'Selagi warranty masih boleh dituntut',
    '/vehicle-services': 'Bila servis seterusnya, dan berapa kos kali terakhir',
    '/home-services': 'Bila aircond terakhir dicuci, dan bila kena cuci lagi',
    '/tenancy': 'Sebelum kontrak tamat, dan setiap bulan sewa kena bayar',
    '/commitments': 'Setiap komitmen bulanan, pada hari ia kena bayar',
    '/countdown': 'Tarikh yang you tengah tunggu-tunggu',
    '/birthdays': 'Hari jadi dan ulang tahun, setiap tahun, tanpa catat semula',
    '/debt-tracker': 'Siapa hutang you, you hutang siapa, mana yang belum settle',
    '/expense-manager': 'Pendapatan, komitmen dan perbelanjaan, bulan demi bulan',
    '/duit-raya': 'Siapa dah dapat, dan berapa lagi baki bajet',
    '/important-numbers': 'Nombor akaun, polisi dan ID — bila orang tanya tiba-tiba',
    '/travel-history': 'Setiap trip yang you dah pergi, atas peta',
    '/book-tracker': 'Apa you tengah baca, berhenti di mana, quote yang berbaloi',
    '/habit-tracker': 'Streak yang you tak nak putus',
    '/water-tracker': 'Berapa banyak air lagi untuk hari ini',
  } as Record<string, string>,

  promises: [
    {
      title: 'Jalan tanpa internet',
      body: 'Bukan sekadar "boleh offline" — offline memang keadaan biasa. Semua boleh buka dan simpan dalam kapal terbang, dalam basement, atau bila signal tinggal satu bar.',
    },
    {
      title: 'Data you, bukan data kami',
      body: 'Tak log masuk, tiada apa yang you taip keluar dari peranti ini. Log masuk, rekod ikut you merentas peranti — alat lain tetap tak muat naik apa-apa.',
    },
    {
      title: 'Pasang je',
      body: 'Letak atas home screen, ia jalan macam app biasa. Tiada app store, tiada notifikasi update, tak perlu akaun untuk mula.',
    },
  ],

  closing: {
    heading: ['Simpan sekali,', 'ingat selamanya.'],
    body: 'Mula dengan satu rekod — apa-apa yang you paling risau nak terlupa.',
  },

  previews: {
    heading: 'Macam ni rupanya',
    body: 'Bukan screenshot — ini surface sebenar dari app. Rekod masuk ikut bentuk yang tetap, jadi sekali pandang you dah tahu status dia.',
    doc: {
      title: 'Document Expiry',
      items: [
        { label: 'Roadtax Myvi', date: 'Luput 19 Ogos 2026', days: 12 },
        { label: 'Pasport', date: 'Luput 24 Sept 2026', days: 48 },
        { label: 'Lesen memandu', date: 'Luput 3 Mac 2027', days: 208 },
      ],
    },
    raya: {
      title: 'Kira Duit Raya',
      budget: 1500,
      remainingLabel: 'Baki bajet:',
      recipients: [
        { name: 'Aina (anak sedara)', amount: 50, given: true },
        { name: 'Danish', amount: 20, given: true },
        { name: 'Sepupu belah Mak', amount: 30, given: false },
        { name: 'Anak jiran', amount: 10, given: false },
      ],
    },
    service: {
      title: 'Servis Kenderaan',
      events: [
        { title: 'Servis akan datang', meta: '14 Nov 2026 · 92,000 km', cost: '', upcoming: true },
        { title: 'Servis minor', meta: '14 Mei 2026 · Bengkel Pak Din', cost: '268', upcoming: false },
        { title: 'Tukar tayar', meta: '8 Jan 2026 · set 4', cost: '960', upcoming: false },
      ],
    },
    habit: {
      title: 'Habit Tracker',
      streakLabel: 'minggu berturut',
      weeksLabel: 'minggu aktif',
      habits: [
        { name: 'Solat subuh', emoji: '🌅', seed: 11, strength: 0.9 },
        { name: 'Baca 10 muka', emoji: '📖', seed: 27, strength: 0.62 },
        { name: 'Jalan kaki', emoji: '👟', seed: 43, strength: 0.45 },
      ],
    },
    travel: {
      title: 'My Travel History',
      statCountries: 'negara',
      statSpent: 'jumlah belanja',
      trips: [
        { flag: '🇯🇵', country: 'Japan', meta: 'Nov 2025 · 11 hari', note: 'Tokyo · Kyoto · Osaka', budget: 9800 },
        { flag: '🇹🇭', country: 'Thailand', meta: 'Feb 2024 · 4 hari', note: 'Bangkok', budget: 1200 },
        { flag: '🇮🇩', country: 'Indonesia', meta: 'Ogos 2023 · 6 hari', note: 'Bandung', budget: 2400 },
      ],
    },
  },

  footer: 'SenangKit.my',
};

const en: typeof ms = {
  nav: { openApp: 'Open app', theme: (light: boolean) => (light ? 'Dark mode' : 'Light mode') },

  hero: {
    eyebrow: 'Roadtax/licence · Car/Home service · Warranty · Rent · Debts',
    headline: ['Never', 'miss it', 'again.'],
    bodyBefore: 'Notes apps let you write anything, which is exactly why you never look again — and you miss the renewal, the warranty, the service, the debt. SenangKit gives every kind of record a fixed shape, so it goes in fast and comes back at you ',
    bodyEmphasis: 'before',
    bodyAfter: ' the date.',
    ctaGuest: 'Start free',
    ctaUser: 'Open app',
    secondary: (n: number) => `See all ${n} tools`,
    note: 'Free. No account needed to try — sign in only when you want it saved.',
  },

  wall: {
    title: "What's chasing you",
    live: 'Live',
    unit: 'days',
    records: [
      { label: 'House rent', note: 'Monthly payment' },
      { label: 'Roadtax Myvi', note: 'Due for renewal' },
      { label: 'Passport', note: 'Expires' },
      { label: "Mum's birthday", note: 'Every year' },
      { label: 'Aircon warranty', note: 'Claim window ends' },
    ],
  },

  scale: [
    { label: 'Comfortable', hint: '60+ days' },
    { label: 'Coming up', hint: '8–60 days' },
    { label: 'Urgent', hint: '7 days or less' },
  ],

  tools: {
    heading: 'What you need reminding of',
    body: (n: number) => `${n} tools that hold a record and tell you before the date arrives. Sign in once and they follow you to every device you own.`,
    deadlineGroup: 'Has a deadline',
    recordGroup: 'Worth keeping',
    count: (n: number) => `${n} tools`,
    sideHeading: 'Other tools',
    sideBody: 'No account, nothing saved, nothing sent anywhere. Open one, get your answer, close it.',
  },

  reminds: {
    '/document-expiry': 'Before the passport, roadtax or licence runs out',
    '/asset-warranty': 'While the warranty can still be claimed',
    '/vehicle-services': 'When the next service is due — and what the last one cost',
    '/home-services': 'When the aircon was last washed, and when it needs washing again',
    '/tenancy': 'Before the contract ends, and every month the rent falls due',
    '/commitments': 'Every monthly commitment, on the day it is due',
    '/countdown': 'The dates you are counting down to',
    '/birthdays': 'Birthdays and anniversaries, every year, without noting them again',
    '/debt-tracker': 'Who owes you, what you owe, what is still unsettled',
    '/expense-manager': 'Income, commitments and spending, month by month',
    '/duit-raya': 'Who you have given to, and what is left in the budget',
    '/important-numbers': 'Account, policy and ID numbers, when someone asks on the spot',
    '/travel-history': 'Every trip you have taken, drawn on a map',
    '/book-tracker': 'What you are reading, where you stopped, the quotes worth keeping',
    '/habit-tracker': 'The streak you are trying not to break',
    '/water-tracker': 'How much water is left to drink today',
  },

  promises: [
    {
      title: 'Works offline',
      body: 'Not "offline capable" — offline is the normal case. Everything opens and saves on a plane, in a basement, or when you are down to one bar.',
    },
    {
      title: 'Yours, not ours',
      body: 'Signed out, nothing you type leaves this device. Signed in, your records follow you across devices — the other tools still never upload a thing.',
    },
    {
      title: 'Install it',
      body: 'Add it to your home screen and it behaves like any other app. No app store, no update nags, no account needed to start.',
    },
  ],

  closing: {
    heading: ['Save it once,', 'remember it forever.'],
    body: 'Start with one record — whichever thing you are most worried about forgetting.',
  },

  previews: {
    heading: 'This is what it looks like',
    body: 'Not screenshots — these are the real surfaces from the app. Records go in with a fixed shape, so one glance tells you where each one stands.',
    doc: {
      title: 'Document Expiry',
      items: [
        { label: 'Roadtax Myvi', date: 'Expires 19 Aug 2026', days: 12 },
        { label: 'Passport', date: 'Expires 24 Sep 2026', days: 48 },
        { label: 'Driving licence', date: 'Expires 3 Mar 2027', days: 208 },
      ],
    },
    raya: {
      title: 'Kira Duit Raya',
      budget: 1500,
      remainingLabel: 'Budget left:',
      recipients: [
        { name: 'Aina (niece)', amount: 50, given: true },
        { name: 'Danish', amount: 20, given: true },
        { name: "Cousins, mum's side", amount: 30, given: false },
        { name: "Neighbour's kid", amount: 10, given: false },
      ],
    },
    service: {
      title: 'Car & Home Service',
      events: [
        { title: 'Next service due', meta: '14 Nov 2026 · 92,000 km', cost: '', upcoming: true },
        { title: 'Minor service', meta: '14 May 2026 · Pak Din workshop', cost: '268', upcoming: false },
        { title: 'New tyres', meta: '8 Jan 2026 · set of 4', cost: '960', upcoming: false },
      ],
    },
    habit: {
      title: 'Habit Tracker',
      streakLabel: 'week streak',
      weeksLabel: 'active weeks',
      habits: [
        { name: 'Morning prayer', emoji: '🌅', seed: 11, strength: 0.9 },
        { name: 'Read 10 pages', emoji: '📖', seed: 27, strength: 0.62 },
        { name: 'Walk outside', emoji: '👟', seed: 43, strength: 0.45 },
      ],
    },
    travel: {
      title: 'My Travel History',
      statCountries: 'countries',
      statSpent: 'total spent',
      trips: [
        { flag: '🇯🇵', country: 'Japan', meta: 'Nov 2025 · 11 days', note: 'Tokyo · Kyoto · Osaka', budget: 9800 },
        { flag: '🇹🇭', country: 'Thailand', meta: 'Feb 2024 · 4 days', note: 'Bangkok', budget: 1200 },
        { flag: '🇮🇩', country: 'Indonesia', meta: 'Aug 2023 · 6 days', note: 'Bandung', budget: 2400 },
      ],
    },
  },

  footer: 'SenangKit — offline-first, made in Malaysia.',
};

export const COPY: Record<Lang, typeof ms> = { ms, en };

const LANG_KEY = 'landing_lang';
const listeners = new Set<(l: Lang) => void>();

export const getLang = (): Lang =>
  localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'ms'; // Malay by default — the audience

export function setLang(next: Lang) {
  localStorage.setItem(LANG_KEY, next);
  document.documentElement.lang = next === 'ms' ? 'ms' : 'en';
  for (const fn of listeners) fn(next);
}

/** Current language, its copy, and a setter. Shared across every landing component. */
export function useCopy() {
  const [lang, setLocal] = useState<Lang>(getLang);
  useEffect(() => {
    document.documentElement.lang = lang === 'ms' ? 'ms' : 'en';
    listeners.add(setLocal);
    return () => { listeners.delete(setLocal); };
  }, [lang]);
  return { lang, t: COPY[lang], setLang };
}
