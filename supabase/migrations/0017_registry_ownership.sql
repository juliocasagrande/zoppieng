-- Engineers/equipment/vehicles can be owned either by a subscriber company
-- (as before) or personally by a zoppi_engineer, who serves several
-- companies and isn't a member of any of them. Exactly one owner is ever
-- set. "Companies this engineer has served" (for read-only visibility) is
-- derived from reports.assigned_engineer_id — the same relationship
-- review/routes.ts already uses to assign a laudo to an engineer — so no new
-- junction table is needed.

alter table registry_engineers
  alter column company_id drop not null,
  add column owner_user_id uuid references users (id) on delete cascade,
  add constraint registry_engineers_owner_check check ((company_id is not null) <> (owner_user_id is not null));

alter table registry_equipment
  alter column company_id drop not null,
  add column owner_user_id uuid references users (id) on delete cascade,
  add constraint registry_equipment_owner_check check ((company_id is not null) <> (owner_user_id is not null));

alter table registry_vehicles
  alter column company_id drop not null,
  add column owner_user_id uuid references users (id) on delete cascade,
  add constraint registry_vehicles_owner_check check ((company_id is not null) <> (owner_user_id is not null));

alter table registry_engineer_documents
  alter column company_id drop not null,
  add column owner_user_id uuid references users (id) on delete cascade,
  add constraint registry_engineer_documents_owner_check check ((company_id is not null) <> (owner_user_id is not null));

create index registry_engineers_owner_idx on registry_engineers (owner_user_id);
create index registry_equipment_owner_idx on registry_equipment (owner_user_id);
create index registry_vehicles_owner_idx on registry_vehicles (owner_user_id);
create index registry_engineer_documents_owner_idx on registry_engineer_documents (owner_user_id);

-- Replace select/write RLS to account for the dual ownership. Write never
-- extends to "a company this engineer served" — seeing a personal record is
-- not the same as being allowed to change it.

drop policy registry_engineers_select on registry_engineers;
drop policy registry_engineers_write on registry_engineers;
create policy registry_engineers_select on registry_engineers for select
  using (
    is_zoppi_staff()
    or company_id = current_user_company_id()
    or owner_user_id = auth.uid()
    or owner_user_id in (select assigned_engineer_id from reports where company_id = current_user_company_id())
  );
create policy registry_engineers_write on registry_engineers for all
  using (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid())
  with check (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid());

drop policy registry_equipment_select on registry_equipment;
drop policy registry_equipment_write on registry_equipment;
create policy registry_equipment_select on registry_equipment for select
  using (
    is_zoppi_staff()
    or company_id = current_user_company_id()
    or owner_user_id = auth.uid()
    or owner_user_id in (select assigned_engineer_id from reports where company_id = current_user_company_id())
  );
create policy registry_equipment_write on registry_equipment for all
  using (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid())
  with check (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid());

drop policy registry_vehicles_select on registry_vehicles;
drop policy registry_vehicles_write on registry_vehicles;
create policy registry_vehicles_select on registry_vehicles for select
  using (
    is_zoppi_staff()
    or company_id = current_user_company_id()
    or owner_user_id = auth.uid()
    or owner_user_id in (select assigned_engineer_id from reports where company_id = current_user_company_id())
  );
create policy registry_vehicles_write on registry_vehicles for all
  using (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid())
  with check (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid());

drop policy registry_engineer_documents_select on registry_engineer_documents;
drop policy registry_engineer_documents_write on registry_engineer_documents;
create policy registry_engineer_documents_select on registry_engineer_documents for select
  using (
    is_zoppi_staff()
    or company_id = current_user_company_id()
    or owner_user_id = auth.uid()
    or owner_user_id in (select assigned_engineer_id from reports where company_id = current_user_company_id())
  );
create policy registry_engineer_documents_write on registry_engineer_documents for all
  using (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid())
  with check (is_zoppi_staff() or company_id = current_user_company_id() or owner_user_id = auth.uid());
