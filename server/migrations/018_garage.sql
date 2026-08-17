-- Garaj: the vehicle tool rebuilt around a typed vehicle and a derived odometer.
--
-- The odometer is deliberately NOT a column here. It is the max of every reading across
-- garage_energy_logs, garage_services and garage_odo_logs, so it cannot go stale and cannot
-- disagree with the client, which derives it the same way. vehicle_assets.mileage was the old
-- design and it was wrong: a hand-typed number that every km-based reminder depended on.
--
-- The old vehicle_assets / vehicle_service_events tables are NOT dropped. Those rows are user
-- data and a migration that deletes them cannot be undone — the same reasoning that left the
-- Birthdays `occasions` table in place. Removing the descriptor in tools.ts is what stops the
-- old key syncing.

create table garage_vehicles (
  user_id    uuid not null references users(id) on delete cascade,
  id         text not null,
  body       text not null default 'sedan',
  energy     text not null default 'petrol',
  model      text not null default '',
  mileage    integer not null default 0,   -- the odometer FLOOR, not current state
  brand      text,
  nickname   text,
  plate      text,
  year       integer,
  engine     numeric(6,1),                 -- litres, cc, or kWh — meaning follows body+energy
  capacity   numeric(6,1),
  photo      text,                         -- downscaled data URL
  color_idx  integer not null default 0,
  created_at bigint  not null default 0,
  pos        integer not null default 0,
  primary key (user_id, id)
);

-- Fuel and charge in one table. A plug-in hybrid simply has rows of both kinds; every other
-- energy type has rows of exactly one. Splitting them into two tables would duplicate every
-- column and force every read to union them back together.
--
-- `full_tank`, not `full`: FULL is reserved in SQL (FULL OUTER JOIN) and will not parse unquoted.
create table garage_energy_logs (
  user_id    uuid not null,
  id         text not null,
  vehicle_id text not null,
  date       date not null,
  odo        integer not null default 0,
  kind       text not null default 'fuel',      -- 'fuel' | 'charge'
  qty        numeric(10,2) not null default 0,  -- litres or kWh, per kind
  cost       numeric(12,2) not null default 0,
  full_tank  boolean not null default true,     -- only a full->full pair closes a window
  grade      text,
  station    text,
  pos        integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

create table garage_services (
  user_id    uuid not null,
  id         text not null,
  vehicle_id text not null,
  date       date not null,
  odo        integer not null default 0,
  -- Bounded, only meaningful inside its parent, never queried server-side. Same call as
  -- vehicle_service_events.items before it.
  items      jsonb not null default '[]'::jsonb,
  workshop   text,
  notes      text,
  receipt    text,
  pos        integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

create table garage_reminders (
  user_id       uuid not null,
  id            text not null,
  vehicle_id    text not null,
  label         text not null default '',
  due_date      date,        -- at least one of due_date / due_odo is set; the client enforces it
  due_odo       integer,
  repeat_months integer not null default 0,
  repeat_km     integer not null default 0,
  done          boolean not null default false,
  done_date     date,
  pos           integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

create table garage_documents (
  user_id    uuid not null,
  id         text not null,
  vehicle_id text not null,
  type       text not null default 'other',
  expiry     date not null,
  issued     date,
  cost       numeric(12,2),
  note       text,
  receipt    text,
  pos        integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

-- "I just want to correct the mileage" as a first-class record, so nobody has to invent a fake
-- fill-up to move the odometer.
create table garage_odo_logs (
  user_id    uuid not null,
  id         text not null,
  vehicle_id text not null,
  date       date not null,
  odo        integer not null default 0,
  pos        integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

-- Service checklist edits, per body:energy pair rather than per vehicle: adding "Timing belt"
-- to Sedan-Petrol should offer it on every petrol sedan the owner has.
--
-- type_key is USUALLY a vehicle type ('sedan:petrol'), but 019_garage_costs.sql reuses this same
-- table for the garage-wide cost-category list under the reserved key '_cost_categories' — a row
-- with that key is not corrupt data, it never named a vehicle type to begin with. See
-- COST_CATEGORY_KEY in garage-presets.ts for the client-side half of this note.
create table garage_presets (
  user_id  uuid not null references users(id) on delete cascade,
  type_key text not null,                        -- 'sedan:petrol'
  customs  jsonb not null default '[]'::jsonb,
  hidden   jsonb not null default '[]'::jsonb,
  primary key (user_id, type_key)
);

create index garage_energy_logs_vehicle_idx on garage_energy_logs (user_id, vehicle_id);
create index garage_services_vehicle_idx    on garage_services    (user_id, vehicle_id);
create index garage_reminders_vehicle_idx   on garage_reminders   (user_id, vehicle_id);
create index garage_documents_vehicle_idx   on garage_documents   (user_id, vehicle_id);
