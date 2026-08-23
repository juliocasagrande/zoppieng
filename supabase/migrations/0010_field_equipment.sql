-- Data points required by a finished laudo (per reference report IS-LD-034-00)
-- that the field technician must capture but the app didn't collect yet:
-- the test equipment used (once per report — a single dynamometer covers all
-- points) and who performed the field work, plus the anchor's NBR 16325-1
-- device classification per point.

alter table reports
  add column field_executor_name text,
  add column field_executor_role text,
  add column test_equipment_manufacturer text,
  add column test_equipment_model text,
  add column test_equipment_serial text,
  add column test_equipment_capacity_kgf numeric;

create type anchor_device_type as enum ('A', 'A1', 'B', 'C', 'D');

alter table anchor_points
  add column device_type anchor_device_type;

-- Load was always entered in kgf in practice (dynamometers are kgf-scale and
-- NR35/NBR 16325-1 quote the 1.500 kgf minimum in kgf) — the "_kn" name was
-- a mislabel, not a unit conversion.
alter table anchor_points rename column test_applied_load_kn to test_applied_load_kgf;
