-- Customizable, image-illustrated option catalogs for field-wizard selection
-- fields (device type, system type, support structure, environment
-- condition) — same shape as accessory_catalog (Zoppi-standard defaults +
-- company-custom additions, each optionally illustrated with a photo to help
-- the field technician pick correctly), generalized across several fields via
-- field_key instead of one table per field.
create table field_option_catalog (
  id uuid primary key default gen_random_uuid(),
  field_key text not null, -- 'device_type' | 'system_type' | 'support_structure' | 'environment_condition'
  scope accessory_scope not null default 'zoppi_standard',
  company_id uuid references companies (id), -- null when scope = zoppi_standard
  value text not null, -- stored on anchor_points; free text so custom entries aren't limited to a fixed enum
  label text not null,
  image_path text,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scope = 'zoppi_standard' or company_id is not null)
);

create index field_option_catalog_field_key_idx on field_option_catalog (field_key);
create index field_option_catalog_company_idx on field_option_catalog (company_id);

alter table field_option_catalog enable row level security;

create policy field_option_catalog_select on field_option_catalog for select
  using (scope = 'zoppi_standard' or is_zoppi_staff() or company_id = current_user_company_id());
create policy field_option_catalog_write on field_option_catalog for all
  using (is_zoppi_staff() or (scope = 'company_custom' and company_id = current_user_company_id()))
  with check (is_zoppi_staff() or (scope = 'company_custom' and company_id = current_user_company_id()));

insert into storage.buckets (id, name, public)
values ('field-option-images', 'field-option-images', true)
on conflict (id) do nothing;

-- device_type becomes free text so companies can add device categories
-- beyond the fixed NBR 16325-1 A/A1/B/C/D classification — each of those
-- five stays available as a Zoppi-standard catalog entry, seeded below.
alter table anchor_points alter column device_type type text using device_type::text;
drop type anchor_device_type;

-- value = label for every seeded field (not just device_type): the field
-- wizard stores whichever descriptive text the technician picked directly on
-- the anchor point, so rendering it (PDF, review) never needs to join back
-- to the catalog — a catalog entry can be relabeled/removed later without
-- corrupting already-submitted points.
insert into field_option_catalog (field_key, scope, value, label, sort_order) values
  ('device_type', 'zoppi_standard', 'Tipo A — ponto de ancoragem fixo simples', 'Tipo A — ponto de ancoragem fixo simples', 1),
  ('device_type', 'zoppi_standard', 'Tipo A1 — olhal/estrutura rígida certificada', 'Tipo A1 — olhal/estrutura rígida certificada', 2),
  ('device_type', 'zoppi_standard', 'Tipo B — múltiplos pontos fixos interligados', 'Tipo B — múltiplos pontos fixos interligados', 3),
  ('device_type', 'zoppi_standard', 'Tipo C — linha de vida flexível horizontal', 'Tipo C — linha de vida flexível horizontal', 4),
  ('device_type', 'zoppi_standard', 'Tipo D — trilho rígido horizontal', 'Tipo D — trilho rígido horizontal', 5),
  ('system_type', 'zoppi_standard', 'Ponto de ancoragem fixo individual (Tipo A)', 'Ponto de ancoragem fixo individual (Tipo A)', 1),
  ('system_type', 'zoppi_standard', 'Ponto de ancoragem fixo estrutural (Tipo A1)', 'Ponto de ancoragem fixo estrutural (Tipo A1)', 2),
  ('system_type', 'zoppi_standard', 'Sistema de múltiplos pontos interligados (Tipo B)', 'Sistema de múltiplos pontos interligados (Tipo B)', 3),
  ('system_type', 'zoppi_standard', 'Linha de vida flexível horizontal (Tipo C)', 'Linha de vida flexível horizontal (Tipo C)', 4),
  ('system_type', 'zoppi_standard', 'Trilho rígido horizontal (Tipo D)', 'Trilho rígido horizontal (Tipo D)', 5),
  ('support_structure', 'zoppi_standard', 'Concreto', 'Concreto', 1),
  ('support_structure', 'zoppi_standard', 'Aço / estrutura metálica', 'Aço / estrutura metálica', 2),
  ('support_structure', 'zoppi_standard', 'Alvenaria estrutural', 'Alvenaria estrutural', 3),
  ('support_structure', 'zoppi_standard', 'Madeira', 'Madeira', 4),
  ('support_structure', 'zoppi_standard', 'Estrutura mista', 'Estrutura mista', 5),
  ('environment_condition', 'zoppi_standard', 'Interno', 'Interno', 1),
  ('environment_condition', 'zoppi_standard', 'Externo', 'Externo', 2),
  ('environment_condition', 'zoppi_standard', 'Externo — atmosfera agressiva (litorânea/industrial)', 'Externo — atmosfera agressiva (litorânea/industrial)', 3),
  ('environment_condition', 'zoppi_standard', 'Externo — exposição a UV intensa', 'Externo — exposição a UV intensa', 4);
