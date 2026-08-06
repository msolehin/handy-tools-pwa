// Per-tool mappers between a page's whole-state JSON blob and real typed rows.
//
// SECURITY: `uid` always comes from the session (c.get('userId')). No descriptor ever accepts
// a user id from the request body.
//
// Adding a tool = one entry here + one migration. No new routes.

export type Q = (sql: string, params?: unknown[]) => Promise<{ rows: any[] }>;

export type Descriptor = {
  /** rows -> the exact blob the page expects to read back out of storage */
  read(q: Q, uid: string): Promise<unknown>;
  /** blob -> rows. Runs inside a transaction. */
  write(q: Q, uid: string, blob: any): Promise<void>;
};

/**
 * Chunked multi-VALUES insert. A per-row loop for 1000 expenses is 1000 round trips; this is
 * one statement per 500 rows.
 */
export async function insertMany(q: Q, table: string, cols: string[], rows: unknown[][]) {
  if (!rows.length) return;
  for (let i = 0; i < rows.length; i += 500) {
    const chunk = rows.slice(i, i + 500);
    const values = chunk
      .map((_, r) => `(${cols.map((_, c) => `$${r * cols.length + c + 1}`).join(',')})`)
      .join(',');
    // DO UPDATE, not DO NOTHING: client ids are weak enough that a within-user collision is
    // possible, and silently dropping a record is worse than overwriting one.
    await q(
      `insert into ${table} (${cols.join(',')}) values ${values}
       on conflict (user_id, ${cols[1]}) do update set
       ${cols.slice(2).map((col) => `${col} = excluded.${col}`).join(', ')}`,
      chunk.flat());
  }
}

/** Read one of the shared string lists back in order. */
export async function readList(q: Q, uid: string, list: string): Promise<string[]> {
  const { rows } = await q(
    'select value from user_lists where user_id = $1 and list = $2 order by pos', [uid, list]);
  return rows.map((r) => r.value as string);
}

/** Replace one of the shared string lists. */
export async function writeList(q: Q, uid: string, list: string, values: unknown) {
  await q('delete from user_lists where user_id = $1 and list = $2', [uid, list]);
  const clean = Array.isArray(values) ? values.filter((v): v is string => typeof v === 'string') : [];
  if (!clean.length) return;
  const params = clean.flatMap((v, i) => [uid, list, v, i]);
  const placeholders = clean
    .map((_, i) => `($${i * 4 + 1},$${i * 4 + 2},$${i * 4 + 3},$${i * 4 + 4})`)
    .join(',');
  await q(
    `insert into user_lists (user_id, list, value, pos) values ${placeholders}
     on conflict (user_id, list, value) do update set pos = excluded.pos`,
    params);
}

const arr = (v: unknown): any[] => (Array.isArray(v) ? v : []);
const num = (v: unknown): number => (Number.isFinite(Number(v)) ? Number(v) : 0);

/**
 * Drop null columns so an optional field that was absent in the blob comes back absent
 * rather than as `null` — otherwise every optional field changes shape on the round trip.
 */
const dropNulls = <T extends Record<string, unknown>>(rows: T[]): T[] =>
  rows.map((row) => {
    const out = {} as T;
    for (const [k, v] of Object.entries(row)) if (v !== null) (out as any)[k] = v;
    return out;
  });

export const TOOLS: Record<string, Descriptor> = {
  birthdays_data: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, name, date::text as date, type, category, note
           from occasions where user_id = $1 order by pos`, [uid]);
      return { items: rows, categories: await readList(q, uid, 'birthday_cat') };
    },
    async write(q, uid, blob) {
      await q('delete from occasions where user_id = $1', [uid]);
      await insertMany(q, 'occasions',
        ['user_id', 'id', 'name', 'date', 'type', 'category', 'note', 'pos'],
        arr(blob?.items).map((o, i) => [
          uid, String(o.id), String(o.name ?? ''), o.date,
          o.type === 'anniversary' ? 'anniversary' : 'birthday',
          String(o.category ?? ''), String(o.note ?? ''), i,
        ]));
      await writeList(q, uid, 'birthday_cat', blob?.categories);
    },
  },

  tenancy_data: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, title, category, party, phone,
                start_date::text as "startDate", end_date::text as "endDate",
                amount::float8 as amount, due_day as "dueDay",
                deposit::float8 as deposit, notes
           from contracts where user_id = $1 order by pos`, [uid]);
      return { items: rows, categories: await readList(q, uid, 'tenancy_cat') };
    },
    async write(q, uid, blob) {
      await q('delete from contracts where user_id = $1', [uid]);
      await insertMany(q, 'contracts',
        ['user_id', 'id', 'title', 'category', 'party', 'phone', 'start_date', 'end_date',
          'amount', 'due_day', 'deposit', 'notes', 'pos'],
        arr(blob?.items).map((c, i) => [
          uid, String(c.id), String(c.title ?? ''), String(c.category ?? ''),
          String(c.party ?? ''), String(c.phone ?? ''), c.startDate, c.endDate,
          num(c.amount), Math.min(31, Math.max(1, num(c.dueDay) || 1)),
          num(c.deposit), String(c.notes ?? ''), i,
        ]));
      await writeList(q, uid, 'tenancy_cat', blob?.categories);
    },
  },

  de_documents: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, type, custom_title as "customTitle", expiry_date::text as "expiryDate"
           from documents where user_id = $1 order by pos`, [uid]);
      return dropNulls(rows);
    },
    async write(q, uid, blob) {
      await q('delete from documents where user_id = $1', [uid]);
      await insertMany(q, 'documents',
        ['user_id', 'id', 'type', 'custom_title', 'expiry_date', 'pos'],
        arr(blob).map((d, i) => [
          uid, String(d.id), String(d.type ?? ''), d.customTitle ?? null, d.expiryDate, i,
        ]));
    },
  },

  cd_events: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, title, target_date::text as "targetDate", image_url as "imageUrl"
           from countdown_events where user_id = $1 order by pos`, [uid]);
      return dropNulls(rows);
    },
    async write(q, uid, blob) {
      await q('delete from countdown_events where user_id = $1', [uid]);
      await insertMany(q, 'countdown_events',
        ['user_id', 'id', 'title', 'target_date', 'image_url', 'pos'],
        arr(blob).map((e, i) => [
          uid, String(e.id), String(e.title ?? ''), e.targetDate, e.imageUrl ?? null, i,
        ]));
    },
  },

  debt_tracker_ious: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, person_name as "personName", description,
                amount::float8 as amount, type, is_settled as "isSettled"
           from ious where user_id = $1 order by pos`, [uid]);
      return rows;
    },
    async write(q, uid, blob) {
      await q('delete from ious where user_id = $1', [uid]);
      await insertMany(q, 'ious',
        ['user_id', 'id', 'person_name', 'description', 'amount', 'type', 'is_settled', 'pos'],
        arr(blob).map((d, i) => [
          uid, String(d.id), String(d.personName ?? ''), String(d.description ?? ''),
          num(d.amount), d.type === 'i_owe' ? 'i_owe' : 'owe_me', Boolean(d.isSettled), i,
        ]));
    },
  },

  habit_tracker_data: {
    async read(q, uid) {
      const { rows } = await q(
        `select h.id, h.name, h.color, h.emoji,
                coalesce(
                  array_agg(c.date::text order by c.date) filter (where c.date is not null),
                  '{}') as "completedDates"
           from habits h
           left join habit_completions c on c.user_id = h.user_id and c.habit_id = h.id
          where h.user_id = $1
          group by h.id, h.name, h.color, h.emoji, h.pos
          order by h.pos`, [uid]);
      return dropNulls(rows);
    },
    async write(q, uid, blob) {
      // habit_completions cascades off habits, so deleting the parents clears both.
      await q('delete from habits where user_id = $1', [uid]);
      const habits = arr(blob);
      await insertMany(q, 'habits',
        ['user_id', 'id', 'name', 'color', 'emoji', 'pos'],
        habits.map((h, i) => [
          uid, String(h.id), String(h.name ?? ''), String(h.color ?? ''), h.emoji ?? null, i,
        ]));

      const ticks = habits.flatMap((h) =>
        [...new Set(arr(h.completedDates).filter((d) => typeof d === 'string'))]
          .map((date) => [uid, String(h.id), date]));
      if (!ticks.length) return;
      for (let i = 0; i < ticks.length; i += 500) {
        const chunk = ticks.slice(i, i + 500);
        const values = chunk
          .map((_, r) => `($${r * 3 + 1},$${r * 3 + 2},$${r * 3 + 3})`).join(',');
        await q(
          `insert into habit_completions (user_id, habit_id, date) values ${values}
           on conflict do nothing`, chunk.flat());
      }
    },
  },

  important_numbers_data: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, category, name, value, notes, is_hidden as "isHidden"
           from important_numbers where user_id = $1 order by pos`, [uid]);
      return { items: rows, categories: await readList(q, uid, 'impnum_cat') };
    },
    async write(q, uid, blob) {
      await q('delete from important_numbers where user_id = $1', [uid]);
      await insertMany(q, 'important_numbers',
        ['user_id', 'id', 'category', 'name', 'value', 'notes', 'is_hidden', 'pos'],
        arr(blob?.items).map((n, i) => [
          uid, String(n.id), String(n.category ?? ''), String(n.name ?? ''),
          String(n.value ?? ''), String(n.notes ?? ''), Boolean(n.isHidden), i,
        ]));
      await writeList(q, uid, 'impnum_cat', blob?.categories);
    },
  },

  asset_warranty_tracker_data: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, name, category, purchase_date::text as "purchaseDate",
                purchase_price::float8 as "purchasePrice",
                warranty_duration as "warrantyDuration", expiry_date::text as "expiryDate",
                serial_number as "serialNumber", store, notes,
                receipt_photo as "receiptPhoto"
           from assets where user_id = $1 order by pos`, [uid]);
      return dropNulls(rows);
    },
    async write(q, uid, blob) {
      await q('delete from assets where user_id = $1', [uid]);
      await insertMany(q, 'assets',
        ['user_id', 'id', 'name', 'category', 'purchase_date', 'purchase_price',
          'warranty_duration', 'expiry_date', 'serial_number', 'store', 'notes',
          'receipt_photo', 'pos'],
        arr(blob).map((a, i) => [
          uid, String(a.id), String(a.name ?? ''), String(a.category ?? ''),
          a.purchaseDate, num(a.purchasePrice), num(a.warrantyDuration), a.expiryDate,
          a.serialNumber ?? null, a.store ?? null, a.notes ?? null,
          a.receiptPhoto ?? null, i,
        ]));
    },
  },

  asset_warranty_custom_categories: {
    read: (q, uid) => readList(q, uid, 'asset_cat'),
    write: (q, uid, blob) => writeList(q, uid, 'asset_cat', blob),
  },

  book_tracker_custom_categories: {
    read: (q, uid) => readList(q, uid, 'book_cat'),
    write: (q, uid, blob) => writeList(q, uid, 'book_cat', blob),
  },

  vehicle_custom_titles: {
    read: (q, uid) => readList(q, uid, 'vehicle_title'),
    write: (q, uid, blob) => writeList(q, uid, 'vehicle_title', blob),
  },

  home_custom_titles: {
    read: (q, uid) => readList(q, uid, 'home_title'),
    write: (q, uid, blob) => writeList(q, uid, 'home_title', blob),
  },

  book_tracker_data: {
    async read(q, uid) {
      const { rows: books } = await q(
        `select id, title, author, category,
                total_pages as "totalPages", current_page as "currentPage", status,
                cover, started_date::text as "startedDate",
                completed_date::text as "completedDate", created_at as "createdAt"
           from books where user_id = $1 order by pos`, [uid]);
      const { rows: notes } = await q(
        `select id, book_id, type, text, page, created_at as "createdAt"
           from book_notes where user_id = $1 order by pos`, [uid]);

      const byBook = new Map<string, unknown[]>();
      for (const n of dropNulls(notes)) {
        const { book_id: bookId, ...note } = n as Record<string, unknown> & { book_id: string };
        if (!byBook.has(bookId)) byBook.set(bookId, []);
        byBook.get(bookId)!.push(note);
      }
      return dropNulls(books).map((b: any) => ({ ...b, notes: byBook.get(b.id) ?? [] }));
    },
    async write(q, uid, blob) {
      await q('delete from books where user_id = $1', [uid]); // book_notes cascades
      const books = arr(blob);
      await insertMany(q, 'books',
        ['user_id', 'id', 'title', 'author', 'category', 'total_pages', 'current_page',
          'status', 'cover', 'started_date', 'completed_date', 'created_at', 'pos'],
        books.map((b, i) => [
          uid, String(b.id), String(b.title ?? ''), String(b.author ?? ''),
          String(b.category ?? ''), num(b.totalPages), num(b.currentPage),
          ['wishlist', 'to-read', 'reading', 'completed'].includes(b.status) ? b.status : 'to-read',
          b.cover ?? null, b.startedDate ?? null, b.completedDate ?? null,
          String(b.createdAt ?? ''), i,
        ]));

      const notes = books.flatMap((b) =>
        arr(b.notes).map((n, i) => [
          uid, String(n.id), String(b.id), n.type === 'note' ? 'note' : 'quote',
          String(n.text ?? ''), n.page ?? null, String(n.createdAt ?? ''), i,
        ]));
      await insertMany(q, 'book_notes',
        ['user_id', 'id', 'book_id', 'type', 'text', 'page', 'created_at', 'pos'], notes);
    },
  },

  water_tracker_data: {
    async read(q, uid) {
      // FM strips the zero padding. WaterTracker builds today's key as `2026-8-6` and compares
      // it with ===, so a padded date makes the app decide it's a new day and reset the intake.
      const { rows } = await q(
        `select to_char(date, 'YYYY-FMMM-FMDD') as date, intake, goal, history
           from water_days where user_id = $1 order by date desc limit 1`, [uid]);
      return rows[0] ?? null;
    },
    async write(q, uid, blob) {
      if (!blob?.date) return;
      // Upsert by date, never delete-then-insert: that would wipe every past day on save.
      await q(
        `insert into water_days (user_id, date, intake, goal, history)
         values ($1, $2, $3, $4, $5)
         on conflict (user_id, date) do update
           set intake = excluded.intake, goal = excluded.goal, history = excluded.history`,
        [uid, blob.date, num(blob.intake), num(blob.goal) || 2500,
          arr(blob.history).map(num)]);
    },
  },

  expense_manager_data: {
    async read(q, uid) {
      const { rows: expenses } = await q(
        `select id, description, amount::float8 as amount, category, date::text as date
           from expenses where user_id = $1 order by pos`, [uid]);

      const { rows: incomes } = await q(
        `select id, title, amount::float8 as amount, recurring, date::text as date,
                start_month as "startMonth", end_month as "endMonth", day
           from incomes where user_id = $1 order by pos`, [uid]);

      const { rows: commitments } = await q(
        `select id, title, amount::float8 as amount, payment_day as "paymentDay",
                category, archived
           from commitments where user_id = $1 order by pos`, [uid]);

      const { rows: payments } = await q(
        `select commitment_id, month, paid_date::text as paid_date
           from commitment_payments where user_id = $1 order by month`, [uid]);

      const byCommitment = new Map<string, Record<string, string>>();
      for (const p of payments) {
        if (!byCommitment.has(p.commitment_id)) byCommitment.set(p.commitment_id, {});
        byCommitment.get(p.commitment_id)![p.month] = p.paid_date;
      }

      return {
        expenses,
        incomes: dropNulls(incomes),
        commitments: commitments.map((c) => ({ ...c, payments: byCommitment.get(c.id) ?? {} })),
        expenseCats: await readList(q, uid, 'expense_cat'),
        commitCats: await readList(q, uid, 'commit_cat'),
      };
    },
    async write(q, uid, blob) {
      await q('delete from expenses where user_id = $1', [uid]);
      await q('delete from incomes where user_id = $1', [uid]);
      await q('delete from commitments where user_id = $1', [uid]); // payments cascade

      await insertMany(q, 'expenses',
        ['user_id', 'id', 'description', 'amount', 'category', 'date', 'pos'],
        arr(blob?.expenses).map((e, i) => [
          uid, String(e.id), String(e.description ?? ''), num(e.amount),
          String(e.category ?? ''), e.date, i,
        ]));

      await insertMany(q, 'incomes',
        ['user_id', 'id', 'title', 'amount', 'recurring', 'date',
          'start_month', 'end_month', 'day', 'pos'],
        arr(blob?.incomes).map((n, i) => [
          uid, String(n.id), String(n.title ?? ''), num(n.amount), Boolean(n.recurring),
          n.date, n.startMonth ?? null, n.endMonth ?? null,
          n.day === undefined ? null : num(n.day), i,
        ]));

      const commitments = arr(blob?.commitments);
      await insertMany(q, 'commitments',
        ['user_id', 'id', 'title', 'amount', 'payment_day', 'category', 'archived', 'pos'],
        commitments.map((c, i) => [
          uid, String(c.id), String(c.title ?? ''), num(c.amount),
          Math.min(31, Math.max(1, num(c.paymentDay) || 1)),
          String(c.category ?? ''), Boolean(c.archived), i,
        ]));

      // Archiving a commitment deliberately keeps its payment history, so the cascade above
      // only fires on a real delete.
      const payments = commitments.flatMap((c) =>
        Object.entries(c.payments ?? {})
          .filter(([, paid]) => typeof paid === 'string' && paid)
          .map(([month, paid]) => [uid, String(c.id), month, paid]));
      for (let i = 0; i < payments.length; i += 500) {
        const chunk = payments.slice(i, i + 500);
        const values = chunk
          .map((_, r) => `($${r * 4 + 1},$${r * 4 + 2},$${r * 4 + 3},$${r * 4 + 4})`).join(',');
        await q(
          `insert into commitment_payments (user_id, commitment_id, month, paid_date)
           values ${values}
           on conflict (user_id, commitment_id, month) do update
             set paid_date = excluded.paid_date`, chunk.flat());
      }

      await writeList(q, uid, 'expense_cat', blob?.expenseCats);
      await writeList(q, uid, 'commit_cat', blob?.commitCats);
    },
  },

  vehicle_services_data: {
    async read(q, uid) {
      const { rows: assets } = await q(
        `select id, name, plate, created_at::float8 as "createdAt"
           from vehicle_assets where user_id = $1 order by pos`, [uid]);
      const { rows: events } = await q(
        `select id, asset_id as "assetId", date::text as date, title,
                is_lumpsum as "isLumpsum", total_cost::float8 as "totalCost", items,
                mileage, address, notes, next_service_date::text as "nextServiceDate"
           from vehicle_service_events where user_id = $1 order by pos`, [uid]);
      return { assets, events: dropNulls(events) };
    },
    async write(q, uid, blob) {
      await q('delete from vehicle_assets where user_id = $1', [uid]); // events cascade
      await insertMany(q, 'vehicle_assets',
        ['user_id', 'id', 'name', 'plate', 'created_at', 'pos'],
        arr(blob?.assets).map((a, i) => [
          uid, String(a.id), String(a.name ?? ''), String(a.plate ?? ''), num(a.createdAt), i,
        ]));
      await insertMany(q, 'vehicle_service_events',
        ['user_id', 'id', 'asset_id', 'date', 'title', 'is_lumpsum', 'total_cost', 'items',
          'mileage', 'address', 'notes', 'next_service_date', 'pos'],
        arr(blob?.events).map((e, i) => [
          uid, String(e.id), String(e.assetId), e.date, String(e.title ?? ''),
          Boolean(e.isLumpsum), num(e.totalCost), JSON.stringify(arr(e.items)),
          String(e.mileage ?? ''), String(e.address ?? ''), String(e.notes ?? ''),
          e.nextServiceDate ?? null, i,
        ]));
    },
  },

  home_services_data: {
    async read(q, uid) {
      const { rows: assets } = await q(
        `select id, name, location, created_at::float8 as "createdAt"
           from home_assets where user_id = $1 order by pos`, [uid]);
      const { rows: events } = await q(
        `select id, asset_id as "assetId", date::text as date, title,
                total_cost::float8 as "totalCost", notes,
                next_service_date::text as "nextServiceDate"
           from home_service_events where user_id = $1 order by pos`, [uid]);
      return { assets, events: dropNulls(events) };
    },
    async write(q, uid, blob) {
      await q('delete from home_assets where user_id = $1', [uid]);
      await insertMany(q, 'home_assets',
        ['user_id', 'id', 'name', 'location', 'created_at', 'pos'],
        arr(blob?.assets).map((a, i) => [
          uid, String(a.id), String(a.name ?? ''), String(a.location ?? ''), num(a.createdAt), i,
        ]));
      await insertMany(q, 'home_service_events',
        ['user_id', 'id', 'asset_id', 'date', 'title', 'total_cost', 'notes',
          'next_service_date', 'pos'],
        arr(blob?.events).map((e, i) => [
          uid, String(e.id), String(e.assetId), e.date, String(e.title ?? ''),
          num(e.totalCost), String(e.notes ?? ''), e.nextServiceDate ?? null, i,
        ]));
    },
  },

  duit_raya_manager_data: {
    async read(q, uid) {
      const { rows: settings } = await q(
        `select theme, budget::float8 as budget, disabled_denoms as "disabledDenoms"
           from duit_raya_settings where user_id = $1`, [uid]);
      const { rows: families } = await q(
        'select id, name from duit_raya_families where user_id = $1 order by pos', [uid]);
      const { rows: recipients } = await q(
        `select id, family_id, name, amount::float8 as amount, given
           from duit_raya_recipients where user_id = $1 order by pos`, [uid]);

      const byFamily = new Map<string, unknown[]>();
      for (const r of recipients) {
        const { family_id: familyId, ...recipient } = r;
        if (!byFamily.has(familyId)) byFamily.set(familyId, []);
        byFamily.get(familyId)!.push(recipient);
      }

      const s = settings[0] ?? { theme: 'raya', budget: 0, disabledDenoms: [] };
      return {
        theme: s.theme,
        budget: s.budget,
        families: families.map((f) => ({ ...f, recipients: byFamily.get(f.id) ?? [] })),
        disabledDenoms: s.disabledDenoms ?? [],
      };
    },
    async write(q, uid, blob) {
      // Singleton settings row: upserted, never deleted — Home and Layout read `theme` to
      // retitle the tool card, so a momentary empty row flashes the wrong branding.
      await q(
        `insert into duit_raya_settings (user_id, theme, budget, disabled_denoms)
         values ($1, $2, $3, $4)
         on conflict (user_id) do update
           set theme = excluded.theme, budget = excluded.budget,
               disabled_denoms = excluded.disabled_denoms`,
        [uid, blob?.theme === 'angpao' ? 'angpao' : 'raya', num(blob?.budget),
          arr(blob?.disabledDenoms).map(num)]);

      await q('delete from duit_raya_families where user_id = $1', [uid]); // recipients cascade
      const families = arr(blob?.families);
      await insertMany(q, 'duit_raya_families',
        ['user_id', 'id', 'name', 'pos'],
        families.map((f, i) => [uid, String(f.id), String(f.name ?? ''), i]));

      await insertMany(q, 'duit_raya_recipients',
        ['user_id', 'id', 'family_id', 'name', 'amount', 'given', 'pos'],
        families.flatMap((f) => arr(f.recipients).map((r, i) => [
          uid, String(r.id), String(f.id), String(r.name ?? ''),
          num(r.amount), Boolean(r.given), i,
        ])));
    },
  },

  travel_history_data: {
    async read(q, uid) {
      const { rows: trips } = await q(
        `select id, country, flag, title, start_date::text as "startDate",
                end_date::text as "endDate", budget::float8 as budget, categories,
                best_location as "bestLocation", cities, notes
           from trips where user_id = $1 order by pos`, [uid]);
      const { rows: days } = await q(
        `select id, trip_id, label, timed
           from trip_itinerary_days where user_id = $1 order by pos`, [uid]);
      const { rows: activities } = await q(
        `select id, day_id, time, text from trip_activities where user_id = $1 order by pos`,
        [uid]);
      const { rows: checklist } = await q(
        `select id, trip_id, category, text, done
           from trip_checklist where user_id = $1 order by pos`, [uid]);

      const actsByDay = new Map<string, unknown[]>();
      for (const a of dropNulls(activities)) {
        const { day_id: dayId, ...activity } = a as Record<string, unknown> & { day_id: string };
        if (!actsByDay.has(dayId)) actsByDay.set(dayId, []);
        actsByDay.get(dayId)!.push(activity);
      }

      const daysByTrip = new Map<string, unknown[]>();
      for (const d of days) {
        const { trip_id: tripId, ...day } = d;
        if (!daysByTrip.has(tripId)) daysByTrip.set(tripId, []);
        daysByTrip.get(tripId)!.push({ ...day, activities: actsByDay.get(day.id) ?? [] });
      }

      const listByTrip = new Map<string, unknown[]>();
      for (const c of checklist) {
        const { trip_id: tripId, ...item } = c;
        if (!listByTrip.has(tripId)) listByTrip.set(tripId, []);
        listByTrip.get(tripId)!.push(item);
      }

      return dropNulls(trips).map((t: any) => {
        const out = { ...t };
        const itinerary = daysByTrip.get(t.id);
        const list = listByTrip.get(t.id);
        if (itinerary) out.itinerary = itinerary;
        if (list) out.checklist = list;
        return out;
      });
    },
    async write(q, uid, blob) {
      await q('delete from trips where user_id = $1', [uid]); // days, activities, checklist cascade
      const trips = arr(blob);
      await insertMany(q, 'trips',
        ['user_id', 'id', 'country', 'flag', 'title', 'start_date', 'end_date', 'budget',
          'categories', 'best_location', 'cities', 'notes', 'pos'],
        trips.map((t, i) => [
          uid, String(t.id), String(t.country ?? ''), String(t.flag ?? ''),
          String(t.title ?? ''), t.startDate, t.endDate, num(t.budget),
          t.categories === undefined ? null : JSON.stringify(t.categories),
          t.bestLocation ?? null,
          t.cities === undefined ? null : arr(t.cities).map(String),
          t.notes ?? null, i,
        ]));

      const days = trips.flatMap((t) => arr(t.itinerary).map((d, i) => ({ trip: t, day: d, i })));
      await insertMany(q, 'trip_itinerary_days',
        ['user_id', 'id', 'trip_id', 'label', 'timed', 'pos'],
        days.map(({ trip, day, i }) => [
          uid, String(day.id), String(trip.id), String(day.label ?? ''), Boolean(day.timed), i,
        ]));

      await insertMany(q, 'trip_activities',
        ['user_id', 'id', 'day_id', 'time', 'text', 'pos'],
        days.flatMap(({ day }) => arr(day.activities).map((a, i) => [
          uid, String(a.id), String(day.id), a.time ?? null, String(a.text ?? ''), i,
        ])));

      await insertMany(q, 'trip_checklist',
        ['user_id', 'id', 'trip_id', 'category', 'text', 'done', 'pos'],
        trips.flatMap((t) => arr(t.checklist).map((c, i) => [
          uid, String(c.id), String(t.id), String(c.category ?? ''),
          String(c.text ?? ''), Boolean(c.done), i,
        ])));
    },
  },
};

export const isKnownTool = (tool: string) => Object.hasOwn(TOOLS, tool);
