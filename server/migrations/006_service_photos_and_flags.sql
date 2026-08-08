-- Fields the client gained after 004. All additive and defaulted, so existing rows stay valid and
-- an older client that never sends them keeps working.

-- A vehicle or home can carry an optional photo, shown as the card background. Stored as a data
-- URI, already downscaled to 600px client-side before it is ever sent.
alter table vehicle_assets add column if not exists photo text;
alter table home_assets    add column if not exists photo text;

-- "Dah buat" — the next service was done but no record logged yet, which closes the reminder
-- without inventing a service record.
alter table vehicle_service_events add column if not exists next_done boolean not null default false;
alter table home_service_events    add column if not exists next_done boolean not null default false;

-- Important Numbers now stores dates as well as numbers; an entry may be either.
alter table important_numbers add column if not exists date date;
