-- Sewa & Kontrak gained an address field (where the rented place actually is). Additive and
-- defaulted, so existing rows stay valid and an older client that never sends it keeps working.
alter table contracts add column if not exists address text not null default '';
