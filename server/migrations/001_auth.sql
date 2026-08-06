-- Accounts and sessions.

create table users (
  id           uuid primary key default gen_random_uuid(),
  google_sub   text unique not null,   -- key on sub, never on email: emails get reassigned
  email        text not null,
  name         text,
  picture      text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- Opaque session ids, not JWTs, so logout is a real DELETE and "sign out everywhere" is free.
create table sessions (
  id         text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text
);

create index sessions_user_id_idx on sessions (user_id);
