-- Expense Manager: fields the client already writes but the server had nowhere to put, plus
-- savings goals. Additive and defaulted/nullable, so existing rows stay valid and an older
-- client that never sends any of it keeps working. (Same rule as 005 and 006.)

-- Last month a commitment applies. Same shape and nullability as incomes.end_month.
alter table commitments add column if not exists end_month char(7);

-- What the commitment was scheduled at, effective from each month: Record<'YYYY-MM', number>.
-- jsonb rather than a child table because of the '0000-01' sentinel key, which holds the figure
-- from before the first recorded change and is NOT a real month. char(7) stores it happily, but
-- anything that casts a month to date blows up — select '0000-01-01'::date is "date/time field
-- value out of range", Postgres has no year zero. A row in commitment_payments is therefore
-- impossible (paid_date is date not null), and a commitment_amounts(month char(7)) table would be
-- one careless to_date() in a future reminder query away from making every save of that user fail.
-- Inside jsonb it is just a string key.
alter table commitments add column if not exists amounts jsonb;

-- What was actually paid that month, when it differed from the plan. A column here rather than its
-- own table because the client rebuilds paidAmounts from the payment keys on every load, so its
-- keys are always exactly the months that already have a row here — and what was paid belongs
-- beside the date it was paid. Nullable: a row written before this migration has no figure, and
-- inventing one would be a claim we cannot support.
alter table commitment_payments add column if not exists paid_amount numeric(12,2);

-- ------------------------------------------------------------------------- savings goals
-- Named savings_*, not goals/topups: `goal` is already a column on water_days and the schema is
-- one flat public namespace.
create table if not exists savings_goals (
  user_id  uuid not null references users(id) on delete cascade,
  id       text not null,
  name     text not null default '',
  target   numeric(12,2) not null default 0,
  deadline date,
  note     text,
  pos      int not null default 0,
  primary key (user_id, id)
);

-- Manual additions that affect nothing but the goal tally — they are not spending, so they never
-- reach the expenses table.
create table if not exists savings_topups (
  user_id uuid not null references users(id) on delete cascade,
  id      text not null,
  goal_id text not null,
  date    date not null,
  amount  numeric(12,2) not null default 0,
  note    text,
  pos     int not null default 0,
  -- (user_id, id) rather than (user_id, goal_id, ...): insertMany's conflict target is
  -- (user_id, cols[1]), so the id must be the second column of the primary key.
  primary key (user_id, id)
);

-- Which goal a commitment or a one-off expense feeds. At most one, so it lives on the record.
alter table expenses    add column if not exists goal_id text;
alter table commitments add column if not exists goal_id text;

-- DELIBERATELY NO foreign key on any goal_id, unlike every other parent/child pair here. The blob
-- arrives whole and is authoritative: a topup or expense still carrying the id of a goal the user
-- just deleted would abort the transaction, and PUT /api/sync/expense_manager_data would then 500
-- on every retry — the whole tool becomes unsaveable until the stale reference happens to clear.
-- A dangling text id costs nothing; the client renders an unknown id as unlinked. The price is one
-- explicit delete of savings_topups in write() instead of a free cascade.
