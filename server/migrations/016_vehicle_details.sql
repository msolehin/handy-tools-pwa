-- Reference details on a vehicle: what a workshop or a road tax form asks for.
--
-- Separate from `name`, which is whatever the owner calls the car ("Kereta Mak"). All optional,
-- so all nullable — an absent field must come back absent, not as an empty string, or the sync
-- blob changes shape on every round trip.

alter table vehicle_assets
  add column brand text,
  add column model text,
  add column year  integer,
  add column cc    integer;
