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
      { id: 'num0001', category: 'Insurance', name: 'Polisi Prudential', value: 'P-889231', notes: 'agent Aziz', isHidden: false, date: '2027-02-01' },
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
      // A one-off expense that went into savings; the row above has no goalId at all.
      { id: 'exp0002', description: 'Petrol', amount: 90, category: 'Transport', date: '2026-08-04', goalId: 'gol0001' },
    ],
    incomes: [
      { id: 'inc0001', title: 'Gaji', amount: 5200, recurring: true, date: '2026-08-25', startMonth: '2026-01', endMonth: '2026-12', day: 25 },
      { id: 'inc0002', title: 'Freelance', amount: 800, recurring: false, date: '2026-07-19' },
    ],
    commitments: [
      // One month paid at the scheduled figure, one that differed. '0000-01' in `amounts` is the
      // pre-history sentinel, not a real month — the reason that field is jsonb rather than rows.
      // payoffTotal makes it a loan: the row below has none and is an open-ended bill.
      {
        id: 'com0001', title: 'Ansuran kereta', amount: 890, paymentDay: 5, category: 'Loan', archived: false,
        payments: { '2026-07': '2026-07-05', '2026-08': '2026-08-04' },
        paidAmounts: { '2026-07': 850, '2026-08': 910.5 },
        amounts: { '0000-01': 850, '2026-08': 890 },
        startMonth: '2025-03',
        endMonth: '2027-06',
        payoffTotal: 24030.75,
      },
      // Every optional field absent, and paidAmounts empty rather than missing — read always emits it.
      { id: 'com0002', title: 'Gym lama', amount: 120, paymentDay: 15, category: 'Other', archived: true, payments: {}, paidAmounts: {}, goalId: 'gol0001' },
    ],
    goals: [
      { id: 'gol0001', name: 'Umrah', target: 12000, deadline: '2027-12-31', note: 'dua orang', photo: 'data:image/jpeg;base64,VVVV', photoPos: '50% 30%' },
      { id: 'gol0002', name: 'Tabung kecemasan', target: 5000 },
    ],
    topups: [
      { id: 'top0001', goalId: 'gol0001', date: '2026-08-01', amount: 500, note: 'bonus' },
      { id: 'top0002', goalId: 'gol0002', date: '2026-07-15', amount: 250 },
    ],
    expenseCats: ['Food', 'Transport', 'Bills'],
    commitCats: ['Loan', 'Other'],
  },

  // garage_records and garage_logs are NOT here: their rows foreign-key onto garage_vehicles,
  // which only garage_fleet's write populates, and the shared loop below round-trips one tool's
  // blob at a time with no cross-tool setup. See the report for why that gap was left open
  // rather than growing the harness to seed a parent row.
  garage_fleet: {
    vehicles: [
      {
        id: 'gvh0001', body: 'sedan', energy: 'petrol', model: 'Camry', mileage: 45210,
        brand: 'Toyota', nickname: 'Kereta Ayah', plate: 'ABC 1234', year: 2021,
        engine: 2.5, capacity: 50, photo: 'data:image/jpeg;base64,GGGG',
        colorIdx: 3, createdAt: 1767225600000,
      },
      // Every optional detail absent, and mileage/colorIdx a genuine 0 — must come back as 0,
      // not be dropped as a falsy value alongside the fields that really are missing.
      { id: 'gvh0002', body: 'motorcycle', energy: 'petrol', model: 'RS150R', mileage: 0, colorIdx: 0, createdAt: 1767312000000 },
    ],
    presets: {
      'sedan:petrol': { customs: ['Timing belt'], hidden: ['Wipers'] },
      'motorcycle:petrol': { customs: [], hidden: [] },
    },
  },

  home_services_data: {
    assets: [{ id: 'hom0001', name: 'Aircond bilik', location: 'Bilik tidur', createdAt: 1767225600000 }],
    events: [
      { id: 'hse0001', assetId: 'hom0001', date: '2026-04-20', title: 'Cuci aircond', totalCost: 80, notes: '', nextServiceDate: '2026-10-20', nextDone: true },
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
      photo: 'data:image/jpeg;base64,VVVV', photoPos: '40% 25%',   // the second trip has neither, covering the null path
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

// expense_manager_data leaves goals and topups alone when the blob mentions neither, which is what
// stops one save from a pre-savings build wiping every goal on the account. `{}` is exactly such a
// blob, so those two collections are exempt from the clearing test — the guard has its own test
// below, and a null blob still clears everything.
const KEEPS_ON_EMPTY: Record<string, string[]> = { expense_manager_data: ['goals', 'topups'] };

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
      // deepStrictEqual, not deepEqual: loose equality treats '1767225600000' and 1767225600000
      // as the same value, so it would not have caught garage_fleet's uncast-bigint bug.
      assert.deepStrictEqual(readBack, blob);
    });

    test(`${tool}: rewriting replaces rather than appends`, async () => {
      const desc = TOOLS[tool];
      const readBack = await tx(async (q) => {
        await desc.write(q, userId, blob);
        await desc.write(q, userId, blob); // same payload twice
        return desc.read(q, userId);
      });
      assert.deepStrictEqual(readBack, blob, 'a second write must not duplicate rows');
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
          .filter(([k, v]) => Array.isArray(v) && !(KEEPS_ON_EMPTY[tool] ?? []).includes(k));
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

  // garage_records and garage_logs both foreign-key their rows onto garage_vehicles, which only
  // garage_fleet's write populates. The shared FIXTURES loop round-trips one tool's blob at a
  // time and has no way to express that cross-descriptor dependency, so these seed a parent
  // vehicle by hand instead of growing the loop. They cover what nothing else does: the repeat
  // rebuild (present vs entirely absent), full's boolean default, grade/station optionality, the
  // qty/cost::float8 casts, doc-type coercion to 'other', and items empty vs populated.
  test('garage_records: read(write(blob)) === blob, against a real parent vehicle', async () => {
    const blob = {
      services: [
        {
          id: 'svc0001', vehicleId: 'gvh0001', date: '2026-05-14', odo: 84210,
          items: [{ label: 'Minyak hitam', cost: 180 }, { label: 'Filter', cost: 88.5 }],
          workshop: 'Bengkel Pak Din', notes: 'servis biasa', receipt: 'data:image/jpeg;base64,UkNQVA==',
        },
        // items empty, every optional field absent.
        { id: 'svc0002', vehicleId: 'gvh0001', date: '2026-01-08', odo: 12000, items: [] },
      ],
      docs: [
        // Recognised type, every optional field present, cost a real decimal.
        {
          id: 'doc0001', vehicleId: 'gvh0001', type: 'insurance', expiry: '2027-03-01',
          issued: '2026-03-01', cost: 12.34, note: 'comprehensive', receipt: 'data:image/jpeg;base64,AAAA',
        },
        { id: 'doc0002', vehicleId: 'gvh0001', type: 'other', expiry: '2026-12-31' },
      ],
      costs: [
        // A decimal amount is what catches a missing ::float8 cast: pg hands numeric back as the
        // STRING '45.60', and deepStrictEqual will not call that 45.6.
        {
          id: 'cst0001', vehicleId: 'gvh0001', date: '2026-06-02', category: 'Tol & parkir',
          amount: 45.6, note: 'PLUS ke Ipoh', receipt: 'data:image/jpeg;base64,QkJCQg==',
        },
        // Every optional field absent, and an amount of exactly 0 — must come back as 0, not be
        // dropped alongside the fields that really are missing.
        { id: 'cst0002', vehicleId: 'gvh0001', date: '2026-06-09', category: 'Saman', amount: 0 },
      ],
    };
    const readBack = await tx(async (q) => {
      await q(`insert into garage_vehicles (user_id, id) values ($1, 'gvh0001')
                on conflict (user_id, id) do nothing`, [userId]);
      await TOOLS.garage_records.write(q, userId, blob);
      return TOOLS.garage_records.read(q, userId);
    });
    assert.deepStrictEqual(readBack, blob);
  });

  test('garage_records: an unrecognised document type coerces to other', async () => {
    const readBack = await tx(async (q) => {
      await q(`insert into garage_vehicles (user_id, id) values ($1, 'gvh0001')
                on conflict (user_id, id) do nothing`, [userId]);
      await TOOLS.garage_records.write(q, userId, {
        services: [],
        docs: [{ id: 'doc0003', vehicleId: 'gvh0001', type: 'bogus', expiry: '2026-12-31' }],
      });
      return TOOLS.garage_records.read(q, userId) as Promise<{ docs: { type: string }[] }>;
    });
    assert.equal(readBack.docs[0].type, 'other');
  });

  test('garage_logs: read(write(blob)) === blob, against a real parent vehicle', async () => {
    const blob = {
      energy: [
        {
          id: 'nrg0001', vehicleId: 'gvh0001', date: '2026-05-01', odo: 84000, kind: 'fuel',
          qty: 35.2, cost: 145.5, full: true, grade: 'RON97', station: 'Petronas',
        },
        // full: false, and grade/station both absent.
        { id: 'nrg0002', vehicleId: 'gvh0001', date: '2026-05-02', odo: 84500, kind: 'charge', qty: 20, cost: 15, full: false },
      ],
      odo: [
        { id: 'odo0001', vehicleId: 'gvh0001', date: '2026-06-01', odo: 85000 },
      ],
      reminders: [
        {
          id: 'rem0001', vehicleId: 'gvh0001', label: 'Road tax', done: false,
          dueDate: '2027-03-01', repeat: { months: 12, km: 0 },
        },
        // No repeat at all -- must come back WITHOUT the key, not {months:0,km:0}.
        { id: 'rem0002', vehicleId: 'gvh0001', label: 'Tukar minyak', done: true, dueOdo: 15000, doneDate: '2026-05-02' },
      ],
    };
    const readBack = await tx(async (q) => {
      await q(`insert into garage_vehicles (user_id, id) values ($1, 'gvh0001')
                on conflict (user_id, id) do nothing`, [userId]);
      await TOOLS.garage_logs.write(q, userId, blob);
      return TOOLS.garage_logs.read(q, userId);
    });
    assert.deepStrictEqual(readBack, blob);
  });

  // The one non-trivial branch in the descriptor: a save from a build that predates savings sends
  // no goals key at all, and must not be read as "the user deleted them". The rev guard is no help
  // there — a stale device that has pulled is at the current rev, so its write is accepted.
  test('expense_manager_data: a blob with no goals key leaves goals alone', async () => {
    const desc = TOOLS.expense_manager_data;
    const full = FIXTURES.expense_manager_data as Record<string, unknown>;
    const { goals, topups, ...oldClient } = full; // exactly what a pre-savings build sends

    const kept = await tx(async (q) => {
      await desc.write(q, userId, full);
      await desc.write(q, userId, oldClient);
      return desc.read(q, userId);
    }) as Record<string, unknown>;
    assert.deepEqual(kept.goals, goals, 'an old client must not wipe goals');
    assert.deepEqual(kept.topups, topups, 'nor topups');

    // ...while an explicit empty array is an opinion, and still clears.
    const cleared = await tx(async (q) => {
      await desc.write(q, userId, { ...full, goals: [], topups: [] });
      return desc.read(q, userId);
    }) as Record<string, unknown>;
    assert.deepEqual(cleared.goals, []);
    assert.deepEqual(cleared.topups, []);
  });
});
