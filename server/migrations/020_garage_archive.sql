-- Selling a car is ordinary. Until now the only option was Delete, which cascades every service,
-- document and log — and that history is worth keeping; it is also what you hand the buyer.
--
-- Additive only, per the convention in server/tools.ts: two nullable-in-effect columns, no data
-- touched. Every existing vehicle defaults to not archived, which is what it already was.
alter table garage_vehicles add column archived    boolean not null default false;
alter table garage_vehicles add column archived_at date;
