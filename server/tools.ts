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

// The Birthdays tool was removed from the app. Its `occasions` table and `birthday_cat` list are
// deliberately left in the schema rather than dropped — the rows are user data, and a migration
// that deletes them cannot be undone. With no descriptor here the key no longer syncs, so the
// table simply stops being written to.
export const TOOLS: Record<string, Descriptor> = {
  tenancy_data: {
    async read(q, uid) {
      const { rows } = await q(
        `select id, title, category, party, phone, address,
                start_date::text as "startDate", end_date::text as "endDate",
                amount::float8 as amount, due_day as "dueDay",
                deposit::float8 as deposit, notes
           from contracts where user_id = $1 order by pos`, [uid]);
      return { items: rows, categories: await readList(q, uid, 'tenancy_cat') };
    },
    async write(q, uid, blob) {
      await q('delete from contracts where user_id = $1', [uid]);
      await insertMany(q, 'contracts',
        ['user_id', 'id', 'title', 'category', 'party', 'phone', 'address', 'start_date',
          'end_date', 'amount', 'due_day', 'deposit', 'notes', 'pos'],
        arr(blob?.items).map((c, i) => [
          uid, String(c.id), String(c.title ?? ''), String(c.category ?? ''),
          String(c.party ?? ''), String(c.phone ?? ''), String(c.address ?? ''),
          c.startDate, c.endDate,
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
        `select id, category, name, value, notes, is_hidden as "isHidden",
                date::text as date
           from important_numbers where user_id = $1 order by pos`, [uid]);
      // dropNulls: an entry with no date must come back without the key, not with date: null.
      return { items: dropNulls(rows), categories: await readList(q, uid, 'impnum_cat') };
    },
    async write(q, uid, blob) {
      await q('delete from important_numbers where user_id = $1', [uid]);
      await insertMany(q, 'important_numbers',
        ['user_id', 'id', 'category', 'name', 'value', 'notes', 'is_hidden', 'date', 'pos'],
        arr(blob?.items).map((n, i) => [
          uid, String(n.id), String(n.category ?? ''), String(n.name ?? ''),
          String(n.value ?? ''), String(n.notes ?? ''), Boolean(n.isHidden), n.date ?? null, i,
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
        `select id, description, amount::float8 as amount, category, date::text as date,
                goal_id as "goalId"
           from expenses where user_id = $1 order by pos`, [uid]);

      const { rows: incomes } = await q(
        `select id, title, amount::float8 as amount, recurring, date::text as date,
                start_month as "startMonth", end_month as "endMonth", day
           from incomes where user_id = $1 order by pos`, [uid]);

      const { rows: commitments } = await q(
        `select id, title, amount::float8 as amount, payment_day as "paymentDay",
                category, archived, amounts, start_month as "startMonth",
                end_month as "endMonth", goal_id as "goalId",
                payoff_total::float8 as "payoffTotal"
           from commitments where user_id = $1 order by pos`, [uid]);

      const { rows: payments } = await q(
        `select commitment_id, month, paid_date::text as paid_date,
                paid_amount::float8 as paid_amount
           from commitment_payments where user_id = $1 order by month`, [uid]);

      const { rows: goals } = await q(
        `select id, name, target::float8 as target, deadline::text as deadline, note, photo,
                photo_pos as "photoPos"
           from savings_goals where user_id = $1 order by pos`, [uid]);

      const { rows: topups } = await q(
        `select id, goal_id as "goalId", date::text as date, amount::float8 as amount, note
           from savings_topups where user_id = $1 order by pos`, [uid]);

      // A null paid_amount is a row written before 009 — skipped rather than filled with a figure
      // we cannot support. The client's own load repair stamps those from the current amount,
      // which is what they were already being counted as.
      const byCommitment = new Map<string, Record<string, string>>();
      const paidByCommitment = new Map<string, Record<string, number>>();
      for (const p of payments) {
        if (!byCommitment.has(p.commitment_id)) {
          byCommitment.set(p.commitment_id, {});
          paidByCommitment.set(p.commitment_id, {});
        }
        byCommitment.get(p.commitment_id)![p.month] = p.paid_date;
        if (p.paid_amount !== null) paidByCommitment.get(p.commitment_id)![p.month] = p.paid_amount;
      }

      return {
        // dropNulls now that goal_id is nullable — every other expense column is not null, so the
        // raw rows used to be safe; without this every expense would come back with goalId: null.
        expenses: dropNulls(expenses),
        incomes: dropNulls(incomes),
        // paidAmounts is always emitted, {} included: the client rebuilds it from the payment keys
        // on every load, so it is always present in what it sends. amounts, startMonth, endMonth,
        // goalId and payoffTotal are genuinely optional and must come back ABSENT rather than null,
        // hence the destructure.
        commitments: commitments.map(({ amounts, startMonth, endMonth, goalId, payoffTotal, ...c }) => ({
          ...c,
          payments: byCommitment.get(c.id) ?? {},
          paidAmounts: paidByCommitment.get(c.id) ?? {},
          ...(amounts && { amounts }),
          ...(startMonth !== null && { startMonth }),
          ...(endMonth !== null && { endMonth }),
          ...(goalId !== null && { goalId }),
          ...(payoffTotal !== null && { payoffTotal }),
        })),
        goals: dropNulls(goals),
        topups: dropNulls(topups),
        expenseCats: await readList(q, uid, 'expense_cat'),
        commitCats: await readList(q, uid, 'commit_cat'),
      };
    },
    async write(q, uid, blob) {
      await q('delete from expenses where user_id = $1', [uid]);
      await q('delete from incomes where user_id = $1', [uid]);
      await q('delete from commitments where user_id = $1', [uid]); // payments cascade

      // goals and topups are the first new TOP-LEVEL keys since sync shipped. Per-item fields
      // survive an old client because it spreads whole objects, but an old bundle rebuilds the top
      // level from the five keys it knows — so arr(undefined) -> [] would let one save from a stale
      // phone delete every goal on the account, accepted rather than 409'd because that phone is at
      // the current rev. A missing key is not an opinion; `goals: []` is, and still clears.
      const knowsGoals = !blob || blob.goals !== undefined || blob.topups !== undefined;
      if (knowsGoals) {
        // No foreign key points at savings_goals, so these two deletes are order-free and a goalId
        // left pointing at a goal that is already gone can never fail this write.
        await q('delete from savings_goals where user_id = $1', [uid]);
        await q('delete from savings_topups where user_id = $1', [uid]);
      }

      await insertMany(q, 'expenses',
        ['user_id', 'id', 'description', 'amount', 'category', 'date', 'goal_id', 'pos'],
        arr(blob?.expenses).map((e, i) => [
          uid, String(e.id), String(e.description ?? ''), num(e.amount),
          String(e.category ?? ''), e.date, e.goalId ?? null, i,
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
        ['user_id', 'id', 'title', 'amount', 'payment_day', 'category', 'archived',
          'amounts', 'start_month', 'end_month', 'goal_id', 'payoff_total', 'pos'],
        commitments.map((c, i) => [
          uid, String(c.id), String(c.title ?? ''), num(c.amount),
          Math.min(31, Math.max(1, num(c.paymentDay) || 1)),
          String(c.category ?? ''), Boolean(c.archived),
          // The client never writes an empty `amounts` — it seeds the origin sentinel on the first
          // forward change — so truthiness separates "no schedule changes" from a real history.
          c.amounts ? JSON.stringify(c.amounts) : null,
          c.startMonth ?? null, c.endMonth ?? null, c.goalId ?? null, c.payoffTotal ?? null, i,
        ]));

      // Archiving a commitment deliberately keeps its payment history, so the cascade above
      // only fires on a real delete.
      const payments = commitments.flatMap((c) =>
        Object.entries(c.payments ?? {})
          .filter(([, paid]) => typeof paid === 'string' && paid)
          .map(([month, paid]) => [uid, String(c.id), month, paid,
            // ponytail: a paidAmounts key with no matching payment is dropped. The client rebuilds
            // paidAmounts from the payment keys on load so it cannot produce one; give it its own
            // table if that ever stops being true.
            typeof c.paidAmounts?.[month] === 'number' ? c.paidAmounts[month] : null]));
      for (let i = 0; i < payments.length; i += 500) {
        const chunk = payments.slice(i, i + 500);
        const values = chunk
          .map((_, r) => `($${r * 5 + 1},$${r * 5 + 2},$${r * 5 + 3},$${r * 5 + 4},$${r * 5 + 5})`)
          .join(',');
        await q(
          `insert into commitment_payments (user_id, commitment_id, month, paid_date, paid_amount)
           values ${values}
           on conflict (user_id, commitment_id, month) do update
             set paid_date = excluded.paid_date, paid_amount = excluded.paid_amount`, chunk.flat());
      }

      if (knowsGoals) {
        await insertMany(q, 'savings_goals',
          ['user_id', 'id', 'name', 'target', 'deadline', 'note', 'photo', 'photo_pos', 'pos'],
          arr(blob?.goals).map((g, i) => [
            uid, String(g.id), String(g.name ?? ''), num(g.target),
            g.deadline ?? null, g.note ?? null, g.photo ?? null, g.photoPos ?? null, i,
          ]));

        await insertMany(q, 'savings_topups',
          ['user_id', 'id', 'goal_id', 'date', 'amount', 'note', 'pos'],
          arr(blob?.topups).map((t, i) => [
            uid, String(t.id), String(t.goalId ?? ''), t.date, num(t.amount),
            t.note ?? null, i,
          ]));
      }

      await writeList(q, uid, 'expense_cat', blob?.expenseCats);
      await writeList(q, uid, 'commit_cat', blob?.commitCats);
    },
  },

  // ---------------------------------------------------------------- Garaj
  //
  // Three keys, split by photo weight x write frequency. One blob would mean every fill-up
  // re-uploads every vehicle photo and every receipt.

  garage_fleet: {
    async read(q, uid) {
      const { rows: vehicles } = await q(
        // created_at is bigint (OID 20): pg returns those as strings unless cast, and
        // Vehicle.createdAt is a number on the client — vehicle_assets.created_at hit the same
        // thing and is cast the same way.
        `select id, body, energy, model, mileage, brand, nickname, plate, year,
                engine::float8 as engine, capacity::float8 as capacity, photo,
                color_idx as "colorIdx", created_at::float8 as "createdAt"
           from garage_vehicles where user_id = $1 order by pos`, [uid]);
      const { rows: presets } = await q(
        // order by: Object.fromEntries over an unordered result gives heap-order keys, and
        // applyPulled compares blobs with JSON.stringify, which is key-order sensitive — a
        // reordering with no real change would read as "changed on another device".
        `select type_key, customs, hidden from garage_presets where user_id = $1
           order by type_key`, [uid]);
      return {
        vehicles: dropNulls(vehicles),
        presets: Object.fromEntries(
          presets.map((p) => [p.type_key, { customs: arr(p.customs), hidden: arr(p.hidden) }])),
      };
    },
    async write(q, uid, blob) {
      // Upsert-then-prune, NOT the delete-then-insert every other descriptor uses.
      //
      // Children cascade off garage_vehicles, so a wholesale delete here would wipe every
      // service, log, reminder and document — and they would not come back, because the client
      // only marks a key dirty when its serialised value changed. Adding a vehicle changes
      // garage_fleet alone, so nothing would re-push the children it just destroyed.
      //
      // insertMany already does ON CONFLICT DO UPDATE, so surviving vehicles are updated in
      // place and keep their children. Only vehicles genuinely absent from the blob are
      // deleted, and those SHOULD cascade.
      const ids = arr(blob?.vehicles).map((v) => String(v.id));
      await q('delete from garage_vehicles where user_id = $1 and id <> all($2::text[])',
        [uid, ids]);
      await insertMany(q, 'garage_vehicles',
        ['user_id', 'id', 'body', 'energy', 'model', 'mileage', 'brand', 'nickname', 'plate',
          'year', 'engine', 'capacity', 'photo', 'color_idx', 'created_at', 'pos'],
        arr(blob?.vehicles).map((v, i) => [
          uid, String(v.id), String(v.body ?? 'sedan'), String(v.energy ?? 'petrol'),
          String(v.model ?? ''), num(v.mileage), v.brand ?? null, v.nickname ?? null,
          v.plate ?? null, v.year ?? null, v.engine ?? null, v.capacity ?? null,
          v.photo ?? null, num(v.colorIdx), num(v.createdAt), i,
        ]));

      await q('delete from garage_presets where user_id = $1', [uid]);
      // Every array field in this file is guarded by arr(); presets is the one object field, and
      // Object.entries on a string degrades "harmlessly" into [['0','a'],['1','b'],...] rather
      // than throwing, which would insert junk rows instead of just no rows.
      const presetsBlob = blob?.presets;
      const presets = Object.entries(presetsBlob && typeof presetsBlob === 'object' ? presetsBlob : {});
      await insertMany(q, 'garage_presets', ['user_id', 'type_key', 'customs', 'hidden'],
        presets.map(([key, p]: [string, any]) => [
          uid, key, JSON.stringify(arr(p?.customs)), JSON.stringify(arr(p?.hidden)),
        ]));
    },
  },

  garage_records: {
    async read(q, uid) {
      const { rows: services } = await q(
        `select id, vehicle_id as "vehicleId", date::text as date, odo, items,
                workshop, notes, receipt
           from garage_services where user_id = $1 order by pos`, [uid]);
      const { rows: docs } = await q(
        `select id, vehicle_id as "vehicleId", type, expiry::text as expiry,
                issued::text as issued, cost::float8 as cost, note, receipt
           from garage_documents where user_id = $1 order by pos`, [uid]);
      // Costs ride this key rather than garage_logs because they can carry a receipt photo, and
      // this is the key already split out for photo weight.
      const { rows: costs } = await q(
        // amount::float8 for the same reason documents.cost is cast: numeric comes back as a
        // STRING from pg, and Cost.amount is a number on the client.
        `select id, vehicle_id as "vehicleId", date::text as date, category,
                amount::float8 as amount, note, receipt
           from garage_costs where user_id = $1 order by pos`, [uid]);
      return { services: dropNulls(services), docs: dropNulls(docs), costs: dropNulls(costs) };
    },
    async write(q, uid, blob) {
      await q('delete from garage_services where user_id = $1', [uid]);
      await insertMany(q, 'garage_services',
        ['user_id', 'id', 'vehicle_id', 'date', 'odo', 'items', 'workshop', 'notes', 'receipt', 'pos'],
        arr(blob?.services).map((s, i) => [
          uid, String(s.id), String(s.vehicleId), s.date, num(s.odo),
          JSON.stringify(arr(s.items)), s.workshop ?? null, s.notes ?? null, s.receipt ?? null, i,
        ]));

      await q('delete from garage_documents where user_id = $1', [uid]);
      await insertMany(q, 'garage_documents',
        ['user_id', 'id', 'vehicle_id', 'type', 'expiry', 'issued', 'cost', 'note', 'receipt', 'pos'],
        arr(blob?.docs).map((d, i) => [
          uid, String(d.id), String(d.vehicleId),
          ['roadtax', 'insurance', 'puspakom', 'warranty', 'other'].includes(d.type) ? d.type : 'other',
          d.expiry, d.issued ?? null, d.cost ?? null, d.note ?? null, d.receipt ?? null, i,
        ]));

      await q('delete from garage_costs where user_id = $1', [uid]);
      await insertMany(q, 'garage_costs',
        ['user_id', 'id', 'vehicle_id', 'date', 'category', 'amount', 'note', 'receipt', 'pos'],
        arr(blob?.costs).map((c, i) => [
          uid, String(c.id), String(c.vehicleId), c.date, String(c.category ?? ''),
          num(c.amount), c.note ?? null, c.receipt ?? null, i,
        ]));
    },
  },

  garage_logs: {
    async read(q, uid) {
      const { rows: energy } = await q(
        `select id, vehicle_id as "vehicleId", date::text as date, odo, kind,
                qty::float8 as qty, cost::float8 as cost, full_tank as full, grade, station
           from garage_energy_logs where user_id = $1 order by pos`, [uid]);
      const { rows: odo } = await q(
        `select id, vehicle_id as "vehicleId", date::text as date, odo
           from garage_odo_logs where user_id = $1 order by pos`, [uid]);
      const { rows: reminders } = await q(
        `select id, vehicle_id as "vehicleId", label, due_date::text as "dueDate",
                due_odo as "dueOdo", repeat_months, repeat_km, done,
                done_date::text as "doneDate"
           from garage_reminders where user_id = $1 order by pos`, [uid]);
      return {
        energy: dropNulls(energy),
        odo: dropNulls(odo),
        // repeat is one object on the client and two columns here; rebuild it, and omit it
        // entirely when neither dimension is set rather than sending {months:0,km:0}.
        reminders: dropNulls(reminders).map(({ repeat_months, repeat_km, ...r }: any) =>
          repeat_months || repeat_km
            ? { ...r, repeat: { months: repeat_months, km: repeat_km } }
            : r),
      };
    },
    async write(q, uid, blob) {
      await q('delete from garage_energy_logs where user_id = $1', [uid]);
      await insertMany(q, 'garage_energy_logs',
        ['user_id', 'id', 'vehicle_id', 'date', 'odo', 'kind', 'qty', 'cost', 'full_tank',
          'grade', 'station', 'pos'],
        arr(blob?.energy).map((e, i) => [
          uid, String(e.id), String(e.vehicleId), e.date, num(e.odo),
          e.kind === 'charge' ? 'charge' : 'fuel', num(e.qty), num(e.cost),
          e.full !== false, e.grade ?? null, e.station ?? null, i,
        ]));

      await q('delete from garage_odo_logs where user_id = $1', [uid]);
      await insertMany(q, 'garage_odo_logs',
        ['user_id', 'id', 'vehicle_id', 'date', 'odo', 'pos'],
        arr(blob?.odo).map((o, i) => [
          uid, String(o.id), String(o.vehicleId), o.date, num(o.odo), i,
        ]));

      await q('delete from garage_reminders where user_id = $1', [uid]);
      await insertMany(q, 'garage_reminders',
        ['user_id', 'id', 'vehicle_id', 'label', 'due_date', 'due_odo', 'repeat_months',
          'repeat_km', 'done', 'done_date', 'pos'],
        arr(blob?.reminders).map((r, i) => [
          uid, String(r.id), String(r.vehicleId), String(r.label ?? ''),
          r.dueDate ?? null, r.dueOdo ?? null, num(r.repeat?.months), num(r.repeat?.km),
          r.done === true, r.doneDate ?? null, i,
        ]));
    },
  },

  home_services_data: {
    async read(q, uid) {
      const { rows: assets } = await q(
        `select id, name, location, photo, created_at::float8 as "createdAt"
           from home_assets where user_id = $1 order by pos`, [uid]);
      const { rows: events } = await q(
        `select id, asset_id as "assetId", date::text as date, title,
                total_cost::float8 as "totalCost", notes,
                next_service_date::text as "nextServiceDate",
                case when next_done then true end as "nextDone"
           from home_service_events where user_id = $1 order by pos`, [uid]);
      return { assets: dropNulls(assets), events: dropNulls(events) };
    },
    async write(q, uid, blob) {
      await q('delete from home_assets where user_id = $1', [uid]);
      await insertMany(q, 'home_assets',
        ['user_id', 'id', 'name', 'location', 'photo', 'created_at', 'pos'],
        arr(blob?.assets).map((a, i) => [
          uid, String(a.id), String(a.name ?? ''), String(a.location ?? ''),
          a.photo ?? null, num(a.createdAt), i,
        ]));
      await insertMany(q, 'home_service_events',
        ['user_id', 'id', 'asset_id', 'date', 'title', 'total_cost', 'notes',
          'next_service_date', 'next_done', 'pos'],
        arr(blob?.events).map((e, i) => [
          uid, String(e.id), String(e.assetId), e.date, String(e.title ?? ''),
          num(e.totalCost), String(e.notes ?? ''), e.nextServiceDate ?? null,
          Boolean(e.nextDone), i,
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
                best_location as "bestLocation", cities, notes, photo,
                photo_pos as "photoPos"
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
          'categories', 'best_location', 'cities', 'notes', 'photo', 'photo_pos', 'pos'],
        trips.map((t, i) => [
          uid, String(t.id), String(t.country ?? ''), String(t.flag ?? ''),
          String(t.title ?? ''), t.startDate, t.endDate, num(t.budget),
          t.categories === undefined ? null : JSON.stringify(t.categories),
          t.bestLocation ?? null,
          t.cities === undefined ? null : arr(t.cities).map(String),
          t.notes ?? null, t.photo ?? null, t.photoPos ?? null, i,
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
