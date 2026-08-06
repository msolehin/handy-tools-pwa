-- Sync spine + the first tool (Birthdays).

-- One row per (user, tool). `rev` bumps on every write so a client pushing a stale copy
-- gets a 409 instead of silently overwriting another device.
create table tool_revisions (
  user_id    uuid not null references users(id) on delete cascade,
  tool       text not null,           -- the localStorage key, e.g. 'birthdays_data'
  rev        bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (user_id, tool)
);

-- Eight tools store a user-editable string[] (categories, custom service titles). They are
-- ordered string lists, not records with fields, so one table rather than eight identical ones.
create table user_lists (
  user_id uuid not null references users(id) on delete cascade,
  list    text not null,              -- 'birthday_cat' | 'tenancy_cat' | 'asset_cat' | ...
  value   text not null,
  pos     int  not null default 0,
  primary key (user_id, list, value)
);

-- birthdays_data.items
-- Client ids are 7 random chars, unique only within one user's tool, hence the composite PK.
create table occasions (
  user_id  uuid not null references users(id) on delete cascade,
  id       text not null,
  name     text not null,
  date     date not null,
  type     text not null check (type in ('birthday', 'anniversary')),
  category text not null,
  note     text not null default '',
  pos      int  not null default 0,
  primary key (user_id, id)
);
