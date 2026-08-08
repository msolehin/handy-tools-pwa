-- Feedback, complaints, bugs and ideas. Signed-in accounts only, but user_id stays nullable
-- with `on delete set null`: deleting an account must not erase the report it left behind.
-- `target` is a free-text route ('/app', '/document-expiry', 'other') rather than an enum,
-- so adding a tool needs no migration.
create table feedback (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete set null,
  kind       text        not null,
  target     text        not null default 'other',
  message    text        not null,
  created_at timestamptz not null default now()
);

-- The one query that isn't a full-table read: the per-account flood check on insert.
create index feedback_user_recent on feedback (user_id, created_at desc);
