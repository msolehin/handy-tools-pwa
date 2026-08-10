-- One row per downloaded backup. This table IS the backup status: without it the admin page
-- could offer a download but never tell you the last one was three weeks ago, which is the
-- only part of a backup that ever goes wrong.
--
-- Railway's managed Postgres backups remain the real disaster recovery. These rows track the
-- off-platform copy the owner holds themselves.
create table admin_backups (
  id         bigserial primary key,
  created_at timestamptz not null default now(),
  rows_total int         not null,
  bytes      bigint      not null
);
