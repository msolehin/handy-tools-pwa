-- Mileage-based service reminders, and a receipt photo per service record.
--
-- The odometer lives on the vehicle, not on the event: it is the reading *now*, which is what a
-- km target has to be compared against. Event.mileage stays as it is — the reading at that visit,
-- free text, and history rather than state.
--
-- next_service_mileage is numeric from the start even though the old mileage column is text.
-- It is a new field with no legacy values to parse, and it is the one the reminder arithmetic
-- reads, so it is the one worth having typed.

alter table vehicle_assets
  add column mileage    integer,      -- current odometer, null until the user enters one
  add column mileage_at bigint;       -- epoch ms of that reading, so the page can show its age

alter table vehicle_service_events
  add column next_service_mileage integer,
  add column receipt              text;   -- downscaled data URL, same shape as vehicle_assets.photo
