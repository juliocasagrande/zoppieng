-- "Cadastro" section: master data a subscriber company keeps about its own
-- business — distinct from `companies` (platform tenants) and from
-- `report_parties` (a per-report snapshot, not a reusable directory).
-- Every table here is scoped by company_id to the subscriber that owns the
-- record, following the same RLS shape as accessory_catalog (0005_rls.sql).

create table registry_clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  legal_name text not null,
  trade_name text,
  cnpj text,
  address_street text,
  address_number text,
  address_complement text,
  address_district text,
  address_city text,
  address_state text,
  address_zip text,
  contact_name text,
  contact_role text,
  contact_phone text,
  contact_email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registry_clients_company_idx on registry_clients (company_id);

create table registry_suppliers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  legal_name text not null,
  trade_name text,
  cnpj text,
  category text not null default 'outro', -- material | epi | calibracao | outro
  address text,
  contact_name text,
  contact_phone text,
  contact_email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registry_suppliers_company_idx on registry_suppliers (company_id);

-- Covers both a subcontracted company and an individual (autônomo) doing
-- field work on this company's behalf — document_type distinguishes CNPJ vs
-- CPF instead of splitting into two tables.
create table registry_service_providers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  document_type text not null default 'cnpj', -- cnpj | cpf
  document_number text,
  service_type text, -- free text: calibracao, mao_de_obra, manutencao, consultoria, outro
  address text,
  contact_phone text,
  contact_email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registry_service_providers_company_idx on registry_service_providers (company_id);

-- Engineers registered by a subscriber company for its own inspections —
-- separate from `users` (platform login accounts): most subcontracted or
-- in-house engineers a company works with never need a Zoppi login, but
-- `user_id` links back to one when they do.
create table registry_engineers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  user_id uuid references users (id) on delete set null,
  full_name text not null,
  crea_number text,
  crea_state text,
  email text,
  phone text,
  specialty text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registry_engineers_company_idx on registry_engineers (company_id);

-- Documentation attached to a registered engineer (CREA carteirinha, ART
-- availability, NR35/training certificates) — same one-row-per-file shape as
-- accessory_certificate_files, but files aren't shared across engineers so
-- there's no separate link table. company_id is denormalized from the parent
-- engineer to keep the RLS policy a plain column check instead of a subquery.
create table registry_engineer_documents (
  id uuid primary key default gen_random_uuid(),
  engineer_id uuid not null references registry_engineers (id) on delete cascade,
  company_id uuid not null references companies (id) on delete cascade,
  doc_type text not null default 'outro', -- crea_carteirinha | art_disponibilidade | certificado_nr35 | outro
  label text not null,
  storage_path text,
  issued_at date,
  expires_at date,
  notes text,
  created_at timestamptz not null default now()
);

create index registry_engineer_documents_engineer_idx on registry_engineer_documents (engineer_id);
create index registry_engineer_documents_company_idx on registry_engineer_documents (company_id);

create table registry_equipment (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  name text not null,
  category text not null default 'outro', -- dinamometro | trena | torquimetro | epi | outro
  manufacturer text,
  model text,
  serial_number text,
  capacity_kgf numeric,
  calibration_certificate_path text,
  calibration_issued_at date,
  calibration_expires_at date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registry_equipment_company_idx on registry_equipment (company_id);

create table registry_vehicles (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  plate text,
  brand text,
  model text,
  year integer,
  kind text not null default 'outro', -- carro | moto | van | caminhonete | outro
  document_path text,
  insurance_expires_at date,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index registry_vehicles_company_idx on registry_vehicles (company_id);

alter table registry_clients enable row level security;
alter table registry_suppliers enable row level security;
alter table registry_service_providers enable row level security;
alter table registry_engineers enable row level security;
alter table registry_engineer_documents enable row level security;
alter table registry_equipment enable row level security;
alter table registry_vehicles enable row level security;

create policy registry_clients_select on registry_clients for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_clients_write on registry_clients for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

create policy registry_suppliers_select on registry_suppliers for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_suppliers_write on registry_suppliers for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

create policy registry_service_providers_select on registry_service_providers for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_service_providers_write on registry_service_providers for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

create policy registry_engineers_select on registry_engineers for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_engineers_write on registry_engineers for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

create policy registry_engineer_documents_select on registry_engineer_documents for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_engineer_documents_write on registry_engineer_documents for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

create policy registry_equipment_select on registry_equipment for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_equipment_write on registry_equipment for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

create policy registry_vehicles_select on registry_vehicles for select
  using (is_zoppi_staff() or company_id = current_user_company_id());
create policy registry_vehicles_write on registry_vehicles for all
  using (is_zoppi_staff() or company_id = current_user_company_id())
  with check (is_zoppi_staff() or company_id = current_user_company_id());

-- Private bucket: engineer certificates, calibration certificates and vehicle
-- documents may carry personal/sensitive data, so read access goes through
-- signed URLs (API-mediated) rather than a public URL like accessory-images.
insert into storage.buckets (id, name, public)
values ('registry-documents', 'registry-documents', false)
on conflict (id) do nothing;
