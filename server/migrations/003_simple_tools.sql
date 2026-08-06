-- Sewa & Kontrak, Document Expiry, Countdown Day, Catat Hutang, Habit Tracker.
-- All flat record lists; habits is the one that gains a child table.

-- tenancy_data.items  (+ user_lists['tenancy_cat'])
create table contracts (
  user_id    uuid not null references users(id) on delete cascade,
  id         text not null,
  title      text not null,
  category   text not null,
  party      text not null default '',
  phone      text not null default '',
  start_date date not null,
  end_date   date not null,
  amount     numeric(12,2) not null default 0,
  due_day    int  not null default 1 check (due_day between 1 and 31),
  deposit    numeric(12,2) not null default 0,
  notes      text not null default '',
  pos        int  not null default 0,
  primary key (user_id, id)
);

-- de_documents
create table documents (
  user_id      uuid not null references users(id) on delete cascade,
  id           text not null,
  type         text not null,
  custom_title text,
  expiry_date  date not null,
  pos          int  not null default 0,
  primary key (user_id, id)
);

-- cd_events. image_url is a data URI, already downscaled to 600x600 q0.7 client-side.
create table countdown_events (
  user_id     uuid not null references users(id) on delete cascade,
  id          text not null,
  title       text not null,
  target_date date not null,
  image_url   text,
  pos         int  not null default 0,
  primary key (user_id, id)
);

-- debt_tracker_ious
create table ious (
  user_id     uuid not null references users(id) on delete cascade,
  id          text not null,
  person_name text not null,
  description text not null default '',
  amount      numeric(12,2) not null default 0,
  type        text not null check (type in ('owe_me', 'i_owe')),
  is_settled  boolean not null default false,
  pos         int  not null default 0,
  primary key (user_id, id)
);

-- habit_tracker_data
create table habits (
  user_id uuid not null references users(id) on delete cascade,
  id      text not null,
  name    text not null,
  color   text not null default '',
  emoji   text,
  pos     int  not null default 0,
  primary key (user_id, id)
);

-- completedDates: string[] exploded into rows rather than kept as an array, because the
-- reminder engine ("you haven't ticked X in 3 days") is a trivial SQL query against rows and
-- an application-level scan against an array column.
create table habit_completions (
  user_id  uuid not null,
  habit_id text not null,
  date     date not null,
  primary key (user_id, habit_id, date),
  foreign key (user_id, habit_id) references habits(user_id, id) on delete cascade
);
