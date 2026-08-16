// Landing-page copy in both languages. Deliberately a plain object, not an i18n framework —
// spec §10 rules one out. Long-form prose belongs in a block like this; the app's own labels use
// the `t('ms', 'en')` pairs from lib/lang, which now owns the language state this page reads.
//
// `ms` is the source of truth: COPY is typed so `en` fails to compile if it misses a key.

// Explicit .ts extension so `node --test` can resolve this too (Vite handles it either way).
import { getLang, setLang, useLang, type Lang } from '../../lib/lang.ts';

export { getLang, setLang };
export type { Lang };

const ms = {
  nav: { openApp: 'Buka app', theme: (light: boolean): string => (light ? 'Mod gelap' : 'Mod cerah') },

  hero: {
    chips: ['Roadtax / lesen', 'Kira Duit Raya', 'Servis Kereta / Rumah', 'Warranty','Sejarah Travel', 'Sewa', 'Hutang','Bahan Bacaan'],
    headline: ['Jangan lupa', 'lagi.'],
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
      { label: 'Servis aircond', note: 'Kena cuci lagi' },
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
    '/debt-tracker': 'Siapa hutang you, you hutang siapa, mana yang belum settle',
    '/expense-manager': 'Pendapatan, komitmen dan perbelanjaan, bulan demi bulan',
    '/duit-raya': 'Siapa dah dapat, dan berapa lagi baki bajet',
    '/important-numbers': 'Nombor akaun, polisi, ID dan tarikh penting — bila orang tanya tiba-tiba',
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
    moduleLabel: 'Alat',
    open: 'Buka alat',
    doc: {
      title: 'Document Expiry',
      lede: 'Tahu berapa hari lagi tinggal',
      blurb: 'Masuk tarikh luput sekali sahaja — roadtax, pasport, lesen, insurans. Lepas tu senarai ni yang ingat, bukan you.',
      points: [
        'Kiraan hari, bukan tarikh yang you kena kira sendiri',
        'Warna tukar bila makin dekat: hijau → kuning → merah',
        'Semua dokumen rumah dalam satu senarai',
      ],
      items: [
        { label: 'Roadtax Myvi', date: 'Luput 19 Ogos 2026', days: 12 },
        { label: 'Pasport', date: 'Luput 24 Sept 2026', days: 48 },
        { label: 'Lesen memandu', date: 'Luput 3 Mac 2027', days: 208 },
      ],
    },
    raya: {
      title: 'Kira Duit Raya',
      lede: 'Bajet raya yang tak terlajak',
      blurb: 'Letak bajet, senarai siapa dapat berapa, tanda siapa dah dapat. Baki kira sendiri sepanjang raya.',
      points: [
        'Bar bajet yang bergerak setiap kali you bagi',
        'Tanda "dah bagi" supaya tak terbagi dua kali',
        'Baki dan jumlah teragih dikira automatik',
      ],
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
      title: 'Garaj',
      lede: 'Semua kenderaan, servis dan minyak dalam satu app',
      blurb: 'Simpan kenderaan you, log setiap servis dan isi minyak/cas, lepas tu Garaj kira RM setiap km sendiri. Bila nak jual kereta, rekod dah siap.',
      points: [
        'Servis lepas dan servis akan datang dalam satu garis masa',
        'Setiap isi minyak atau cas jadi kos RM/km, automatik',
        'Roadtax, insurans dan peringatan lain, semua sekali',
      ],
      events: [
        { title: 'Servis akan datang', meta: '14 Nov 2026 · 92,000 km', cost: '', upcoming: true },
        { title: 'Servis minor', meta: '14 Mei 2026 · Bengkel Pak Din', cost: '268', upcoming: false },
        { title: 'Tukar tayar', meta: '8 Jan 2026 · set 4', cost: '960', upcoming: false },
      ],
    },
    habit: {
      title: 'Habit Tracker',
      lede: 'Setahun habit dalam satu pandangan',
      blurb: 'Tick setiap hari. Grid setahun tunjuk minggu mana you konsisten, dan minggu mana tergelincir.',
      points: [
        'Grid 52 minggu untuk setiap habit',
        'Streak minggu berturut dikira sendiri',
        'Beberapa habit serentak, warna berlainan',
      ],
      streakLabel: 'minggu berturut',
      tickLabel: 'Tick minggu ni',
      weeksLabel: 'minggu aktif',
      habits: [
        { name: 'Solat subuh', emoji: '🌅', seed: 11, strength: 0.9 },
        { name: 'Baca Buku', emoji: '📖', seed: 27, strength: 0.62 },
        { name: 'Lari', emoji: '👟', seed: 43, strength: 0.45 },
      ],
    },
    travel: {
      title: 'My Travel History',
      lede: 'Peta negara yang you dah jejak',
      blurb: 'Setiap trip masuk dengan tarikh, tempat, dan belanja — dan you boleh susun itinerari hari demi hari serta senarai barang nak bawa dalam trip yang sama. Peta dunia menyala ikut mana you pergi.',
      points: [
        'Peta dunia sebenar, negara dilawati menyala',
        'Belanja setiap trip dan jumlah keseluruhan',
        'Itinerari hari demi hari untuk setiap trip',
        'Senarai barang nak bawa, ada senarai lalai untuk mula',
      ],
      map: { in: 'Zum masuk', out: 'Zum keluar', reset: 'Kembali ke paparan asal' },
      statCountries: 'negara',
      statSpent: 'jumlah belanja',
      trips: [
        { flag: '🇯🇵', country: 'Japan', meta: 'Nov 2025 · 11 hari', note: 'Tokyo · Kyoto · Osaka', budget: 9800 },
        { flag: '🇹🇭', country: 'Thailand', meta: 'Feb 2024 · 4 hari', note: 'Bangkok', budget: 1200 },
        { flag: '🇮🇩', country: 'Indonesia', meta: 'Ogos 2023 · 6 hari', note: 'Bandung', budget: 2400 },
      ],
    },
    book: {
      title: 'My Books',
      lede: 'Apa you tengah baca, dan berhenti di mana',
      blurb: 'Setiap buku bawa status dan nombor muka surat sendiri. Buka balik dua minggu lepas, tak payah belek cari tempat berhenti.',
      points: [
        'Progress muka surat — tahu tinggal berapa lagi nak habis',
        'Status: nak baca, tengah baca, dah habis, wishlist',
        'Quote dan nota disimpan terus bawah bukunya',
      ],
      statBooks: 'buku tahun ni',
      statPages: 'muka surat',
      yearBooks: 12,
      yearPages: 3480,
      statusLabels: { reading: 'Tengah baca', completed: 'Dah habis', wishlist: 'Wishlist' },
      books: [
        { emoji: '📗', title: 'Atomic Habits', author: 'James Clear', status: 'reading', page: 184, total: 320 },
        { emoji: '📕', title: 'Rentung', author: 'Khairulnizam Bakeri', status: 'reading', page: 62, total: 240 },
        { emoji: '📘', title: 'Sapiens', author: 'Yuval Noah Harari', status: 'completed', page: 498, total: 498 },
      ],
      quoteLabel: 'Quote disimpan',
      quote: 'Habits are the compound interest of self-improvement.',
      quoteMeta: 'Atomic Habits · hlm. 27',
    },
    warranty: {
      title: 'Asset & Warranty',
      lede: 'Warranty yang masih boleh dituntut',
      blurb: 'Simpan tarikh beli, harga, dan tempoh warranty. Tarikh tamat dikira sendiri, dan bar tunjuk berapa banyak tempoh dah lesap.',
      points: [
        'Tarikh tamat = tarikh beli + tempoh warranty, tak payah kira',
        'Nilai barang yang masih bawah warranty, dijumlahkan',
        'Resit dan nombor siri disimpan sekali dengan barangnya',
      ],
      statCovered: 'masih bawah warranty',
      covered: 8420,
      items: [
        { icon: 'electronics', name: 'MacBook Air M2', category: 'Electronics', price: 5199, status: 'Tinggal 214 hari', tone: 'emerald', elapsed: 41 },
        { icon: 'appliances', name: 'Aircond Daikin 1.5hp', category: 'Appliances', price: 2280, status: 'Tinggal 21 hari', tone: 'orange', elapsed: 94 },
        { icon: 'furniture', name: 'Sofa L-shape', category: 'Furniture', price: 1890, status: 'Tamat 38 hari lalu', tone: 'rose', elapsed: 100 },
      ],
    },
    debt: {
      title: 'Catat Hutang',
      lede: 'Siapa hutang siapa',
      blurb: 'Dua arah, dua lajur: orang hutang you sebelah, you hutang orang sebelah lagi. Tanda settle bila dah selesai — jumlah setiap belah kira sendiri.',
      points: [
        'Hijau untuk orang hutang you, merah untuk you hutang orang',
        'Tanda settle — rekod kekal, cuma tak dikira dalam baki',
        'Nama dan sebab sekali, supaya tak jadi hal enam bulan lepas',
      ],
      owedToMeLabel: 'Orang hutang you',
      iOweLabel: 'You hutang orang',
      ious: [
        { name: 'Faiz', note: 'Tiket bola', amount: 120, owedToMe: true, settled: false },
        { name: 'Kak Nurul', note: 'Duit makan katering', amount: 350, owedToMe: false, settled: false },
        { name: 'Hafiz', note: 'Tambang teksi', amount: 45, owedToMe: true, settled: false },
        { name: 'Abang', note: 'Tolong bayar servis', amount: 180, owedToMe: false, settled: false },
        { name: 'Adik', note: 'Topup', amount: 30, owedToMe: true, settled: true },
        { name: 'Mama', note: 'Duit pasar', amount: 60, owedToMe: false, settled: true },
      ],
    },
    alerts: {
      title: 'Action Needed',
      label: 'Skrin utama',
      open: 'Buka app',
      lede: 'Semua yang mendesak, atas satu skrin',
      blurb: 'You tak payah ingat nak buka alat yang mana. Setiap alat hantar apa yang mendesak ke skrin utama app — jadi benda yang perlu tindakan dah tunggu you di situ setiap kali you buka.',
      points: [
        'Ditarik automatik dari semua alat — tiada apa nak di-set',
        'Dokumen 30 hari terakhir, servis kereta dah dekat, warranty nak tamat',
        'Tekan kad, terus masuk ke alat yang berkenaan',
        'Pasang di home screen telefon — buka macam app biasa',
      ],
      stripTitle: 'Action Needed',
      items: [
        { kind: 'document', label: 'document', title: 'Renew: Roadtax Myvi', status: '12 hari lagi' },
        { kind: 'service', label: 'service', title: 'Vehicle: Servis Myvi', status: '5 hari lagi' },
        { kind: 'habit', label: 'habit', title: 'Habits: 2 lagi hari ini', status: '60% siap', percent: 60 },
        { kind: 'warranty', label: 'warranty', title: 'Warranty: Aircond Daikin', status: '21 hari lagi' },
      ],
    },
  },

  footer: 'SenangKit.my',
};

const en: typeof ms = {
  nav: { openApp: 'Open app', theme: (light: boolean) => (light ? 'Dark mode' : 'Light mode') },

  hero: {
    chips: ['Roadtax / licence', 'Car service', 'Home service', 'Warranty', 'Rent', 'Debts'],
    headline: ['Never miss it', 'again.'],
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
      { label: 'Aircon service', note: 'Due for a wash' },
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
    '/debt-tracker': 'Who owes you, what you owe, what is still unsettled',
    '/expense-manager': 'Income, commitments and spending, month by month',
    '/duit-raya': 'Who you have given to, and what is left in the budget',
    '/important-numbers': 'Account, policy and ID numbers — and the dates that go with them',
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
    moduleLabel: 'Tool',
    open: 'Open tool',
    doc: {
      title: 'Document Expiry',
      lede: 'Know how many days are left',
      blurb: 'Enter the expiry date once — roadtax, passport, licence, insurance. After that the list remembers, not you.',
      points: [
        'A day count, not a date you have to work out yourself',
        'Colour shifts as it closes in: green → amber → red',
        'Every document in the house on one list',
      ],
      items: [
        { label: 'Roadtax Myvi', date: 'Expires 19 Aug 2026', days: 12 },
        { label: 'Passport', date: 'Expires 24 Sep 2026', days: 48 },
        { label: 'Driving licence', date: 'Expires 3 Mar 2027', days: 208 },
      ],
    },
    raya: {
      title: 'Kira Duit Raya',
      lede: 'A raya budget that holds',
      blurb: 'Set the budget, list who gets how much, tick off who has been given. The balance keeps itself current.',
      points: [
        'A budget bar that moves every time you hand one out',
        'A "given" tick, so nobody gets paid twice',
        'Balance and total allocated worked out for you',
      ],
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
      title: 'Garaj',
      lede: 'Every vehicle, its service and its fuel, in one app',
      blurb: 'Add your vehicles, log every service and fill-up or charge, and Garaj works out the RM per km on its own. When you sell the car, the record is already there.',
      points: [
        'Past services and the next one due on one timeline',
        'Every fill-up or charge becomes a running RM/km, automatically',
        'Road tax, insurance and every other reminder, all in one place',
      ],
      events: [
        { title: 'Next service due', meta: '14 Nov 2026 · 92,000 km', cost: '', upcoming: true },
        { title: 'Minor service', meta: '14 May 2026 · Pak Din workshop', cost: '268', upcoming: false },
        { title: 'New tyres', meta: '8 Jan 2026 · set of 4', cost: '960', upcoming: false },
      ],
    },
    habit: {
      title: 'Habit Tracker',
      lede: 'A year of a habit at a glance',
      blurb: 'Tick it each day. The year grid shows the weeks you held it, and the weeks it slipped.',
      points: [
        'A 52-week grid for each habit',
        'Consecutive-week streak counted for you',
        'Several habits at once, each its own colour',
      ],
      streakLabel: 'week streak',
      tickLabel: 'Tick this week',
      weeksLabel: 'active weeks',
      habits: [
        { name: 'Morning prayer', emoji: '🌅', seed: 11, strength: 0.9 },
        { name: 'Read 10 pages', emoji: '📖', seed: 27, strength: 0.62 },
        { name: 'Walk outside', emoji: '👟', seed: 43, strength: 0.45 },
      ],
    },
    travel: {
      title: 'My Travel History',
      lede: 'The map of where you have been',
      blurb: 'Each trip goes in with its dates, places and spend — and the same trip holds a day-by-day itinerary and a packing list. The world map lights up wherever you went.',
      points: [
        'A real world map, visited countries lit',
        'Spend per trip and the running total',
        'A day-by-day itinerary on every trip',
        'A packing list, with a default one to start from',
      ],
      map: { in: 'Zoom in', out: 'Zoom out', reset: 'Back to the default view' },
      statCountries: 'countries',
      statSpent: 'total spent',
      trips: [
        { flag: '🇯🇵', country: 'Japan', meta: 'Nov 2025 · 11 days', note: 'Tokyo · Kyoto · Osaka', budget: 9800 },
        { flag: '🇹🇭', country: 'Thailand', meta: 'Feb 2024 · 4 days', note: 'Bangkok', budget: 1200 },
        { flag: '🇮🇩', country: 'Indonesia', meta: 'Aug 2023 · 6 days', note: 'Bandung', budget: 2400 },
      ],
    },
    book: {
      title: 'My Books',
      lede: 'What you are reading, and where you stopped',
      blurb: 'Every book carries its own status and page number. Come back to it two weeks later and you are not thumbing around for your place.',
      points: [
        'Page progress — you can see how much of it is left',
        'Status: to read, reading, finished, wishlist',
        'Quotes and notes saved under the book they came from',
      ],
      statBooks: 'books this year',
      statPages: 'pages',
      yearBooks: 12,
      yearPages: 3480,
      statusLabels: { reading: 'Reading', completed: 'Finished', wishlist: 'Wishlist' },
      books: [
        { emoji: '📗', title: 'Atomic Habits', author: 'James Clear', status: 'reading', page: 184, total: 320 },
        { emoji: '📕', title: 'Rentung', author: 'Khairulnizam Bakeri', status: 'reading', page: 62, total: 240 },
        { emoji: '📘', title: 'Sapiens', author: 'Yuval Noah Harari', status: 'completed', page: 498, total: 498 },
      ],
      quoteLabel: 'Saved quote',
      quote: 'Habits are the compound interest of self-improvement.',
      quoteMeta: 'Atomic Habits · p. 27',
    },
    warranty: {
      title: 'Asset & Warranty',
      lede: 'The warranties you can still claim on',
      blurb: 'Keep the purchase date, the price and the warranty length. The expiry works itself out, and the bar shows how much of the cover is already gone.',
      points: [
        'Expiry = purchase date + warranty length, nothing to work out',
        'The value of everything still under cover, totalled',
        'Receipt and serial number filed with the item itself',
      ],
      statCovered: 'still under warranty',
      covered: 8420,
      items: [
        { icon: 'electronics', name: 'MacBook Air M2', category: 'Electronics', price: 5199, status: '214 days left', tone: 'emerald', elapsed: 41 },
        { icon: 'appliances', name: 'Daikin aircon 1.5hp', category: 'Appliances', price: 2280, status: '21 days left', tone: 'orange', elapsed: 94 },
        { icon: 'furniture', name: 'L-shape sofa', category: 'Furniture', price: 1890, status: 'Expired 38d ago', tone: 'rose', elapsed: 100 },
      ],
    },
    debt: {
      title: 'Catat Hutang',
      lede: 'Who owes who, in writing',
      blurb: 'Two directions, two columns: what people owe you on one side, what you owe them on the other. Tick one settled when it is done — each side\'s total keeps itself.',
      points: [
        'Green for what is owed to you, red for what you owe',
        'Tick settled — the record stays, it just stops counting',
        'Name and reason together, so it is not a mystery six months on',
      ],
      owedToMeLabel: 'Owed to you',
      iOweLabel: 'You owe',
      ious: [
        { name: 'Faiz', note: 'Match tickets', amount: 120, owedToMe: true, settled: false },
        { name: 'Kak Nurul', note: 'Catering money', amount: 350, owedToMe: false, settled: false },
        { name: 'Hafiz', note: 'Taxi fare', amount: 45, owedToMe: true, settled: false },
        { name: 'Abang', note: 'Covered a service', amount: 180, owedToMe: false, settled: false },
        { name: 'Adik', note: 'Phone top-up', amount: 30, owedToMe: true, settled: true },
        { name: 'Mama', note: 'Market money', amount: 60, owedToMe: false, settled: true },
      ],
    },
    alerts: {
      title: 'Action Needed',
      label: 'Home screen',
      open: 'Open the app',
      lede: 'Everything pressing, on one screen',
      blurb: 'You never have to remember which tool to open. Every tool pushes whatever is pressing to the app\'s home screen — so what needs doing is already waiting there each time you open it.',
      points: [
        'Pulled from every tool automatically — nothing to configure',
        'Documents in their last 30 days, a service coming up, warranties about to lapse',
        'Tap a card to land straight in the tool it came from',
        'Install it to your phone\'s home screen — it opens like any other app',
      ],
      stripTitle: 'Action Needed',
      items: [
        { kind: 'document', label: 'document', title: 'Renew: Roadtax Myvi', status: '12 Days Left' },
        { kind: 'service', label: 'service', title: 'Vehicle: Myvi service', status: '5 Days Left' },
        { kind: 'habit', label: 'habit', title: 'Habits: 2 left today', status: '60% done', percent: 60 },
        { kind: 'warranty', label: 'warranty', title: 'Warranty: Daikin aircon', status: '21 Days Left' },
      ],
    },
  },

  footer: 'SenangKit — offline-first, made in Malaysia.',
};

export const COPY: Record<Lang, typeof ms> = { ms, en };

/** Current language, its copy, and a setter. Shared across every landing component. */
export function useCopy() {
  const lang = useLang();
  return { lang, t: COPY[lang], setLang };
}
