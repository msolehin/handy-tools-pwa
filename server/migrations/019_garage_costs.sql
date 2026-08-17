-- Garaj: a running cost that is neither a service, an energy fill, nor a document — a saman, a
-- Touch 'n Go reload, a dashcam. The Costs tab claimed to answer "what does this vehicle cost
-- me" and structurally could not include any of them.
--
-- Deliberately NO odo column. Every other record carrying one feeds the derived odometer, which
-- is a maximum across readings; a parking receipt's mileage is incidental and would move it for
-- no reason. See the Cost interface in src/lib/garage.ts for the same note from the other side.
--
-- `category` is free text over an editable list — the list itself lives in garage_presets under
-- the reserved type_key '_cost_categories'. An enum here would mean a migration every time
-- someone wants to track something new.
--
-- Same composite foreign key onto garage_vehicles every other child table carries: a vehicle
-- delete cascades its costs, matching withoutVehicle() on the client.
create table garage_costs (
  user_id    uuid not null,
  id         text not null,
  vehicle_id text not null,
  date       date not null,
  category   text not null default '',
  amount     numeric(12,2) not null default 0,
  note       text,
  receipt    text,                              -- downscaled data URL, same as a service receipt
  pos        integer not null default 0,
  primary key (user_id, id),
  foreign key (user_id, vehicle_id) references garage_vehicles(user_id, id) on delete cascade
);

create index garage_costs_vehicle_idx on garage_costs (user_id, vehicle_id);
