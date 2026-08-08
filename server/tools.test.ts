// node --env-file=.env.local --test server/tools.test.ts
//
// The blob -> rows -> blob round trip is the one thing that silently corrupts user data:
// a dropped field or a reformatted date looks like "the app forgot my stuff". Every tool
// added to TOOLS gets a fixture here.
import { test, before, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import { hasDb, migrate, pool, tx } from './db.ts';
import { TOOLS } from './tools.ts';

// Fixtures must exercise every column, including the optional ones.
const FIXTURES: Record<string, unknown> = {
  tenancy_data: {
    items: [
      {
        id: 'ten0001', title: 'Rumah Setapak', category: 'Tenancy', party: 'Encik Rahim',
        phone: '0123456789', address: 'No 12, Jalan Setapak 3, 53000 Kuala Lumpur',
        startDate: '2025-01-01', endDate: '2026-12-31',
        amount: 1450.5, dueDay: 5, deposit: 2900, notes: 'ada parking',
      },
      {
        id: 'ten0002', title: 'Unifi', category: 'Internet', party: 'TM', phone: '', address: '',
        startDate: '2024-06-15', endDate: '2026-06-14',
        amount: 139, dueDay: 20, deposit: 0, notes: '',
      },
    ],
    categories: ['Tenancy', 'Internet', 'Phone', 'Service', 'Other'],
  },

  // customTitle is optional: absent on one row, present on another, so the round trip has to
  // preserve "key not there" rather than turning it into null.
  de_documents: [
    { id: 'doc0001', type: 'Passport', expiryDate: '2029-03-14' },
    { id: 'doc0002', type: 'Other', customTitle: 'Sijil Kahwin', expiryDate: '2027-08-01' },
  ],

  cd_events: [
    { id: 'cd00001', title: 'Raya', targetDate: '2027-03-20' },
    { id: 'cd00002', title: 'Trip Japan', targetDate: '2026-11-02', imageUrl: 'data:image/jpeg;base64,AAAA' },
  ],

  debt_tracker_ious: [
    { id: 'iou0001', personName: 'Aiman', description: 'lunch', amount: 25.5, type: 'owe_me', isSettled: false },
    { id: 'iou0002', personName: 'Mak', description: '', amount: 500, type: 'i_owe', isSettled: true },
  ],

  habit_tracker_data: [
    { id: 'hab0001', name: 'Solat subuh', color: '#22c55e', emoji: '🌅', completedDates: ['2026-08-01', '2026-08-02', '2026-08-04'] },
    { id: 'hab0002', name: 'Baca buku', color: '#3b82f6', completedDates: [] },
  ],

  important_numbers_data: {
    items: [
      { id: 'num0001', category: 'Insurance', name: 'Polisi Prudential', value: 'P-889231', notes: 'agent Aziz', isHidden: false },
      { id: 'num0002', category: 'Bank', name: 'Maybank', value: '5140xxxx1234', notes: '', isHidden: true },
    ],
    categories: ['Insurance', 'Bank', 'Utility', 'Other'],
  },

  // Optional fields present on one row, absent on the other.
  asset_warranty_tracker_data: [
    {
      id: 'ast0001', name: 'Aircond Daikin', category: 'Appliances', purchaseDate: '2025-03-02',
      purchasePrice: 2399.9, warrantyDuration: 60, expiryDate: '2030-03-02',
      serialNumber: 'DK-99213', store: 'Senheng', notes: 'servis tiap 6 bulan',
      receiptPhoto: 'data:image/jpeg;base64,ZZZZ',
    },
    {
      id: 'ast0002', name: 'Kerusi', category: 'Furniture', purchaseDate: '2026-01-11',
      purchasePrice: 450, warrantyDuration: 0, expiryDate: '2027-01-11',
    },
  ],

  asset_warranty_custom_categories: ['Gadget', 'Dapur'],
  book_tracker_custom_categories: ['Sejarah', 'Novel'],
  vehicle_custom_titles: ['Tukar minyak hitam', 'Servis brek'],
  home_custom_titles: ['Cuci aircond', 'Servis paip'],

  book_tracker_data: [
    {
      id: 'bok0001', title: 'Sapiens', author: 'Harari', category: 'Sejarah',
      totalPages: 498, currentPage: 220, status: 'reading',
      cover: 'data:image/jpeg;base64,CCCC', startedDate: '2026-06-01',
      createdAt: '2026-05-30',
      notes: [
        { id: 'not0001', type: 'quote', text: 'Kita percaya cerita.', page: 41, createdAt: '2026-06-04' },
        { id: 'not0002', type: 'note', text: 'Bab 3 berat sikit.', createdAt: '2026-06-09' },
      ],
    },
    {
      id: 'bok0002', title: 'Bumi Manusia', author: 'Toer', category: 'Novel',
      totalPages: 0, currentPage: 0, status: 'wishlist', createdAt: '2026-07-02', notes: [],
    },
  ],

  // Unpadded date on purpose — that is exactly what the client writes and string-compares.
  water_tracker_data: { date: '2026-8-6', intake: 1400, goal: 2500, history: [250, 500, 650] },

  expense_manager_data: {
    expenses: [
      { id: 'exp0001', description: 'Groceries', amount: 182.45, category: 'Food', date: '2026-08-02' },
      { id: 'exp0002', description: 'Petrol', amount: 90, category: 'Transport', date: '2026-08-04' },
    ],
    incomes: [
      { id: 'inc0001', title: 'Gaji', amount: 5200, recurring: true, date: '2026-08-25', startMonth: '2026-01', endMonth: '2026-12', day: 25 },
      { id: 'inc0002', title: 'Freelance', amount: 800, recurring: false, date: '2026-07-19' },
    ],
    commitments: [
      { id: 'com0001', title: 'Ansuran kereta', amount: 890, paymentDay: 5, category: 'Loan', archived: false, payments: { '2026-07': '2026-07-05', '2026-08': '2026-08-04' } },
      { id: 'com0002', title: 'Gym lama', amount: 120, paymentDay: 15, category: 'Other', archived: true, payments: {} },
    ],
    expenseCats: ['Food', 'Transport', 'Bills'],
    commitCats: ['Loan', 'Other'],
  },

  vehicle_services_data: {
    assets: [
      { id: 'veh0001', name: 'Myvi', plate: 'WXY 1234', createdAt: 1767225600000 },
    ],
    events: [
      {
        id: 'vse0001', assetId: 'veh0001', date: '2026-05-14', title: 'Servis minor',
        isLumpsum: false, totalCost: 268.5,
        items: [
          { id: 'itm0001', name: 'Minyak hitam', cost: 180 },
          { id: 'itm0002', name: 'Filter', cost: 88.5 },
        ],
        mileage: '84210', address: 'Bengkel Pak Din', notes: '', nextServiceDate: '2026-11-14',
      },
      {
        id: 'vse0002', assetId: 'veh0001', date: '2026-01-08', title: 'Tayar',
        isLumpsum: true, totalCost: 960, items: [], mileage: '', address: '', notes: 'set 4',
      },
    ],
  },

  home_services_data: {
    assets: [{ id: 'hom0001', name: 'Aircond bilik', location: 'Bilik tidur', createdAt: 1767225600000 }],
    events: [
      { id: 'hse0001', assetId: 'hom0001', date: '2026-04-20', title: 'Cuci aircond', totalCost: 80, notes: '', nextServiceDate: '2026-10-20' },
      { id: 'hse0002', assetId: 'hom0001', date: '2025-10-18', title: 'Tambah gas', totalCost: 150, notes: 'bocor sikit' },
    ],
  },

  duit_raya_manager_data: {
    theme: 'raya',
    budget: 1500,
    families: [
      {
        id: 'fam0001', name: 'Belah Mak',
        recipients: [
          { id: 'rec0001', name: 'Aina', amount: 50, given: true },
          { id: 'rec0002', name: 'Danish', amount: 20, given: false },
        ],
      },
      { id: 'fam0002', name: 'Jiran', recipients: [] },
    ],
    disabledDenoms: [1, 100],
  },

  travel_history_data: [
    {
      id: 'trp0001', country: 'Japan', flag: '🇯🇵', title: 'Autumn trip',
      startDate: '2025-11-02', endDate: '2025-11-12', budget: 9800,
      categories: { Flights: 3200, Food: 1800, Hotel: 3000 },
      bestLocation: 'Kyoto', cities: ['Tokyo', 'Kyoto', 'Osaka'], notes: 'nak pergi lagi',
      itinerary: [
        {
          id: 'day0001', label: 'Day 1 — Tokyo', timed: true,
          activities: [
            { id: 'act0001', time: '09:00', text: 'Tsukiji' },
            { id: 'act0002', text: 'Shibuya malam' },
          ],
        },
        { id: 'day0002', label: 'Day 2 — Kyoto', timed: false, activities: [] },
      ],
      checklist: [
        { id: 'chk0001', category: 'Documents', text: 'Passport', done: true },
        { id: 'chk0002', category: 'Money', text: 'Yen cash', done: false },
      ],
    },
    // Trip with every optional field absent — the round trip must not invent them.
    {
      id: 'trp0002', country: 'Thailand', flag: '🇹🇭', title: 'Quick getaway',
      startDate: '2024-02-01', endDate: '2024-02-04', budget: 1200,
    },
  ],
};

// water_tracker_data is keyed by date and upserted, never delete-then-inserted — that is the
// whole point (the device keeps one day; the server accumulates the history it throws away).
// So "an empty blob clears the tool" does not apply to it.
const NEVER_CLEARS = new Set(['water_tracker_data']);

const skip = !hasDb;
let userId: string;

describe('tool descriptors', { skip: skip && 'DATABASE_URL not set' }, () => {
  before(async () => {
    await migrate();
    const { rows } = await pool!.query(
      `insert into users (google_sub, email, name)
       values ('test-sub-roundtrip', 'roundtrip@test.local', 'Round Trip')
       on conflict (google_sub) do update set email = excluded.email
       returning id`);
    userId = rows[0].id;
  });

  after(async () => {
    if (userId) await pool!.query('delete from users where id = $1', [userId]);
    await pool!.end();
  });

  for (const [tool, blob] of Object.entries(FIXTURES)) {
    test(`${tool}: read(write(blob)) === blob`, async () => {
      const desc = TOOLS[tool];
      assert.ok(desc, `${tool} has no descriptor`);

      const readBack = await tx(async (q) => {
        await desc.write(q, userId, blob);
        return desc.read(q, userId);
      });
      assert.deepEqual(readBack, blob);
    });

    test(`${tool}: rewriting replaces rather than appends`, async () => {
      const desc = TOOLS[tool];
      const readBack = await tx(async (q) => {
        await desc.write(q, userId, blob);
        await desc.write(q, userId, blob); // same payload twice
        return desc.read(q, userId);
      });
      assert.deepEqual(readBack, blob, 'a second write must not duplicate rows');
    });

    test(`${tool}: an empty blob clears the tool`, { skip: NEVER_CLEARS.has(tool) && 'accumulates by design' }, async () => {
      const desc = TOOLS[tool];
      const readBack = await tx(async (q) => {
        await desc.write(q, userId, blob);
        await desc.write(q, userId, {});
        return desc.read(q, userId);
      });
      if (Array.isArray(readBack)) {
        assert.deepEqual(readBack, [], 'the list should come back empty');
      } else {
        // Only the collections have to empty out. Scalar settings (duit raya's theme and
        // budget) correctly fall back to their defaults instead.
        const lists = Object.entries(readBack as Record<string, unknown>)
          .filter(([, v]) => Array.isArray(v));
        assert.ok(lists.length, 'blob-shaped tools must expose their collections');
        for (const [key, value] of lists) {
          assert.deepEqual(value, [], `${key} should come back empty`);
        }
      }
    });

    test(`${tool}: a null blob does not throw`, async () => {
      const desc = TOOLS[tool];
      await tx(async (q) => { await desc.write(q, userId, null); });
    });
  }
});
