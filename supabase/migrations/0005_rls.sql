-- Row Level Security: company-scoped access for authenticated shell users.
-- The API also uses the service role key for privileged operations (field-token
-- flow, PDF/notification jobs), which bypasses RLS by design.

create or replace function current_user_role() returns user_role
language sql stable as $$
  select role from users where id = auth.uid()
$$;

create or replace function current_user_company_id() returns uuid
language sql stable as $$
  select company_id from users where id = auth.uid()
$$;

create or replace function is_zoppi_staff() returns boolean
language sql stable as $$
  select current_user_role() in ('zoppi_admin', 'zoppi_engineer')
$$;

alter table companies enable row level security;
alter table users enable row level security;
alter table module_subscriptions enable row level security;
alter table reports enable row level security;
alter table report_field_links enable row level security;
alter table report_parties enable row level security;
alter table anchor_points enable row level security;
alter table photos enable row level security;
alter table signatures enable row level security;
alter table notifications_log enable row level security;
alter table accessory_catalog enable row level security;
alter table accessory_certificates enable row level security;
alter table accessory_certificate_files enable row level security;
alter table accessory_certificate_links enable row level security;

create policy companies_select on companies for select
  using (is_zoppi_staff() or id = current_user_company_id());
create policy companies_update on companies for update
  using (is_zoppi_staff() or id = current_user_company_id());
create policy companies_insert on companies for insert
  with check (is_zoppi_staff());

create policy users_select on users for select
  using (is_zoppi_staff() or company_id = current_user_company_id() or id = auth.uid());
create policy users_update_self on users for update
  using (id = auth.uid() or is_zoppi_staff());

create policy module_subscriptions_select on module_subscriptions for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy module_subscriptions_write on module_subscriptions for all
  using (is_zoppi_staff()) with check (is_zoppi_staff());

create policy reports_select on reports for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy reports_insert on reports for insert
  with check (is_zoppi_staff() or company_id = current_user_company_id());
create policy reports_update on reports for update
  using (is_zoppi_staff() or company_id = current_user_company_id());

create policy report_field_links_select on report_field_links for select
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));
create policy report_field_links_write on report_field_links for all
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()))
  with check (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));

create policy report_parties_rw on report_parties for all
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()))
  with check (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));

create policy anchor_points_rw on anchor_points for all
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()))
  with check (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));

create policy photos_rw on photos for all
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()))
  with check (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));

create policy signatures_select on signatures for select
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));
create policy signatures_write on signatures for insert
  with check (is_zoppi_staff());

create policy notifications_log_select on notifications_log for select
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));

create policy accessory_catalog_select on accessory_catalog for select
  using (scope = 'zoppi_standard' or is_zoppi_staff() or company_id = current_user_company_id());
create policy accessory_catalog_write on accessory_catalog for all
  using (is_zoppi_staff() or (scope = 'company_custom' and company_id = current_user_company_id()))
  with check (is_zoppi_staff() or (scope = 'company_custom' and company_id = current_user_company_id()));

create policy accessory_certificates_select on accessory_certificates for select using (true);
create policy accessory_certificates_write on accessory_certificates for all
  using (is_zoppi_staff()) with check (is_zoppi_staff());
create policy accessory_certificate_files_select on accessory_certificate_files for select using (true);
create policy accessory_certificate_files_write on accessory_certificate_files for all
  using (is_zoppi_staff()) with check (is_zoppi_staff());
create policy accessory_certificate_links_select on accessory_certificate_links for select using (true);
create policy accessory_certificate_links_write on accessory_certificate_links for all
  using (is_zoppi_staff()) with check (is_zoppi_staff());
