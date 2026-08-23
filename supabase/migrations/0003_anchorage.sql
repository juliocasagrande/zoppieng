-- Ancoragem module: accessory catalog, certificates, anchor points, photos
create type accessory_scope as enum ('zoppi_standard', 'company_custom');

create table accessory_catalog (
  id uuid primary key default gen_random_uuid(),
  scope accessory_scope not null default 'zoppi_standard',
  company_id uuid references companies (id), -- null when scope = zoppi_standard
  name text not null,
  category text not null, -- 'chumbador_quimico' | 'chumbador_mecanico' | 'olhal' | 'barra_roscada' | 'dinamometro' | 'outro'
  manufacturer text,
  spec_diameter_mm numeric,
  spec_load_capacity_kn numeric,
  spec_notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'zoppi_standard' or company_id is not null)
);

create index accessory_catalog_company_idx on accessory_catalog (company_id);

create table accessory_certificates (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  issued_by text,
  issued_at date,
  expires_at date,
  created_at timestamptz not null default now()
);

-- One certificate can cover several files (multi-page scans) and several accessories.
create table accessory_certificate_files (
  id uuid primary key default gen_random_uuid(),
  certificate_id uuid not null references accessory_certificates (id) on delete cascade,
  storage_path text not null,
  page_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table accessory_certificate_links (
  certificate_id uuid not null references accessory_certificates (id) on delete cascade,
  accessory_id uuid not null references accessory_catalog (id) on delete cascade,
  primary key (certificate_id, accessory_id)
);

create type installation_mode as enum ('quimico', 'mecanico');
create type pull_test_result as enum ('aprovado', 'atencao', 'reprovado');

create table anchor_points (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  tag text not null,
  accessory_id uuid references accessory_catalog (id),
  installation_mode installation_mode,
  anchor_depth_mm numeric,
  distance_between_points_mm numeric,
  test_instrument text,
  test_applied_load_kn numeric,
  test_duration_seconds integer,
  test_result pull_test_result,
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, tag)
);

create index anchor_points_report_idx on anchor_points (report_id);

create table photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  anchor_point_id uuid references anchor_points (id) on delete cascade,
  storage_path text not null,
  is_extra boolean not null default false,
  caption text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index photos_report_idx on photos (report_id);
create index photos_anchor_point_idx on photos (anchor_point_id);
