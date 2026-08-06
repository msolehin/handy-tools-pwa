-- The last nine tools.

-- ---------------------------------------------------------------- expense_manager_data
create table expenses (
  user_id     uuid not null references users(id) on delete cascade,
  id          text not null,
  description text not null default '',
  amount      numeric(12,2) not null default 0,
  category    text not null default '',
  date        date not null,
  pos         int  not null default 0,
  primary key (user_id, id)
);

create table incomes (
  user_id     uuid not null references users(id) on delete cascade,
  id          text not null,
  title       text not null default '',
  amount      numeric(12,2) not null default 0,
  recurring   boolean not null default false,
  date        date not null,
  start_month char(7),          -- 'YYYY-MM', only set for recurring
  end_month   char(7),
  day         int,              -- payday
  pos         int  not null default 0,
  primary key (user_id, id)
);

create table commitments (
  user_id     uuid not null references users(id) on delete cascade,
  id          text not null,
  title       text not null default '',
  amount      numeric(12,2) not null default 0,
  payment_day int  not null default 1 check (payment_day between 1 and 31),
  category    text not null default '',
  archived    boolean not null default false,
  pos         int  not null default 0,
  primary key (user_id, id)
);

-- payments is Record<'YYYY-MM','YYYY-MM-DD'> — the value is the date it was PAID, not a bool.
-- Exploded rather than kept as jsonb because Home's "commitment due" alert reads exactly this,
-- and it is the query a server-side reminder job will run.
create table commitment_payments (
  user_id       uuid not null,
  commitment_id text not null,
  month         char(7) not null,
  paid_date     date not null,
  primary key (user_id, commitment_id, month),
  foreign key (user_id, commitment_id) references commitments(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- vehicle / home services
create table vehicle_assets (
  user_id    uuid not null references users(id) on delete cascade,
  id         text not null,
  name       text not null default '',
  plate      text not null default '',
  created_at bigint not null default 0,   -- epoch ms; the client sorts it as a number
  pos        int  not null default 0,
  primary key (user_id, id)
);

create table vehicle_service_events (
  user_id           uuid not null,
  id                text not null,
  asset_id          text not null,
  date              date not null,
  title             text not null default '',
  is_lumpsum        boolean not null default false,
  total_cost        numeric(12,2) not null default 0,
  -- Bounded line-item list, only meaningful inside its parent event, never queried
  -- server-side, and its sum is already denormalised into total_cost. jsonb costs nothing.
  items             jsonb not null default '[]'::jsonb,
  mileage           text not null default '',
  address           text not null default '',
  notes             text not null default '',
  next_service_date date,
  pos               int  not null default 0,
  primary key (user_id, id),
  foreign key (user_id, asset_id) references vehicle_assets(user_id, id) on delete cascade
);

-- Deliberately NOT unified with the vehicle tables: HomeServices has no items, isLumpsum,
-- mileage or address. Merging them would mean a wide table half-null on every row.
create table home_assets (
  user_id    uuid not null references users(id) on delete cascade,
  id         text not null,
  name       text not null default '',
  location   text not null default '',
  created_at bigint not null default 0,
  pos        int  not null default 0,
  primary key (user_id, id)
);

create table home_service_events (
  user_id           uuid not null,
  id                text not null,
  asset_id          text not null,
  date              date not null,
  title             text not null default '',
  total_cost        numeric(12,2) not null default 0,
  notes             text not null default '',
  next_service_date date,
  pos               int  not null default 0,
  primary key (user_id, id),
  foreign key (user_id, asset_id) references home_assets(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- duit_raya_manager_data
create table duit_raya_settings (
  user_id         uuid primary key references users(id) on delete cascade,
  theme           text not null default 'raya' check (theme in ('raya', 'angpao')),
  budget          numeric(12,2) not null default 0,
  -- Bounded set (max ~10, from DENOMS) read as a whole array. A child table here would be
  -- three columns holding at most nine integers.
  disabled_denoms int[] not null default '{}'
);

create table duit_raya_families (
  user_id uuid not null references users(id) on delete cascade,
  id      text not null,
  name    text not null default '',
  pos     int  not null default 0,
  primary key (user_id, id)
);

create table duit_raya_recipients (
  user_id   uuid not null,
  id        text not null,
  family_id text not null,
  name      text not null default '',
  amount    numeric(12,2) not null default 0,
  given     boolean not null default false,
  pos       int  not null default 0,
  primary key (user_id, id),
  foreign key (user_id, family_id) references duit_raya_families(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- water_tracker_data
-- The local blob holds ONE day and destroys yesterday on rollover. Keyed by date, the server
-- accumulates the history the device never had — so this is the one tool that must be
-- upserted, never delete-then-inserted.
create table water_days (
  user_id uuid not null references users(id) on delete cascade,
  date    date not null,
  intake  int not null default 0,
  goal    int not null default 2500,
  history int[] not null default '{}',
  primary key (user_id, date)
);

-- ---------------------------------------------------------------- asset_warranty_tracker_data
create table assets (
  user_id           uuid not null references users(id) on delete cascade,
  id                text not null,
  name              text not null default '',
  category          text not null default '',
  purchase_date     date not null,
  purchase_price    numeric(12,2) not null default 0,
  warranty_duration int not null default 0,     -- months; 0 means a custom expiry date
  expiry_date       date not null,
  serial_number     text,
  store             text,
  notes             text,
  receipt_photo     text,                       -- data URI, downscaled to 900px client-side
  pos               int not null default 0,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- book_tracker_data
create table books (
  user_id        uuid not null references users(id) on delete cascade,
  id             text not null,
  title          text not null default '',
  author         text not null default '',
  category       text not null default '',
  total_pages    int not null default 0,
  current_page   int not null default 0,
  status         text not null check (status in ('wishlist', 'to-read', 'reading', 'completed')),
  cover          text,                          -- data URI, downscaled to 300px client-side
  started_date   date,
  completed_date date,
  -- text, not timestamptz: older rows hold full ISO strings and newer ones hold date-only.
  -- Storing as text round-trips whatever the client wrote. Nothing queries it server-side.
  created_at     text not null default '',
  pos            int not null default 0,
  primary key (user_id, id)
);

create table book_notes (
  user_id    uuid not null,
  id         text not null,
  book_id    text not null,
  type       text not null check (type in ('quote', 'note')),
  text       text not null default '',
  page       int,
  created_at text not null default '',
  pos        int not null default 0,
  primary key (user_id, id),
  foreign key (user_id, book_id) references books(user_id, id) on delete cascade
);

-- ---------------------------------------------------------------- important_numbers_data
-- Account, policy and ID numbers. Not encrypted beyond the host's disk encryption.
create table important_numbers (
  user_id   uuid not null references users(id) on delete cascade,
  id        text not null,
  category  text not null default '',
  name      text not null default '',
  value     text not null default '',
  notes     text not null default '',
  is_hidden boolean not null default false,
  pos       int not null default 0,
  primary key (user_id, id)
);

-- ---------------------------------------------------------------- travel_history_data
create table trips (
  user_id       uuid not null references users(id) on delete cascade,
  id            text not null,
  country       text not null default '',
  flag          text not null default '',
  title         text not null default '',
  start_date    date not null,
  end_date      date not null,
  budget        numeric(12,2) not null default 0,
  categories    jsonb,                -- Record<string, number>, user-invented budget buckets
  best_location text,
  cities        text[],
  notes         text,
  pos           int not null default 0,
  primary key (user_id, id)
);

create table trip_itinerary_days (
  user_id uuid not null,
  id      text not null,
  trip_id text not null,
  label   text not null default '',
  timed   boolean not null default false,
  pos     int not null default 0,
  primary key (user_id, id),
  foreign key (user_id, trip_id) references trips(user_id, id) on delete cascade
);

create table trip_activities (
  user_id uuid not null,
  id      text not null,
  day_id  text not null,
  time    text,
  text    text not null default '',
  pos     int not null default 0,
  primary key (user_id, id),
  foreign key (user_id, day_id) references trip_itinerary_days(user_id, id) on delete cascade
);

create table trip_checklist (
  user_id  uuid not null,
  id       text not null,
  trip_id  text not null,
  category text not null default '',
  text     text not null default '',
  done     boolean not null default false,
  pos      int not null default 0,
  primary key (user_id, id),
  foreign key (user_id, trip_id) references trips(user_id, id) on delete cascade
);
