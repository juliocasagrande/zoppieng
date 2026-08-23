-- Reports (laudos) and the tokenized field-link flow
create type report_status as enum (
  'draft',
  'awaiting_field',
  'in_review',
  'changes_requested',
  'signed',
  'delivered',
  'rejected'
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  module_id uuid not null references modules (id),
  company_id uuid not null references companies (id),
  name text not null,
  status report_status not null default 'draft',
  site_address text,
  site_identification text,
  assigned_engineer_id uuid references users (id),
  issued_at timestamptz,
  valid_until timestamptz,
  report_number text unique,
  pdf_url text,
  labels_pdf_url text,
  created_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index reports_company_idx on reports (company_id);
create index reports_status_idx on reports (status);
create index reports_engineer_idx on reports (assigned_engineer_id);

create type field_link_status as enum ('pending', 'used', 'expired', 'revoked');

create table report_field_links (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  token_hash text not null unique,
  status field_link_status not null default 'pending',
  purpose text not null default 'initial', -- 'initial' | 'correction'
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index report_field_links_report_idx on report_field_links (report_id);

create type report_party_role as enum ('contratante', 'contratada');

create table report_parties (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  role report_party_role not null,
  company_id uuid references companies (id),
  legal_name text not null,
  cnpj text,
  address text,
  contact_name text,
  contact_role text,
  contact_phone text,
  contact_email text,
  created_at timestamptz not null default now(),
  unique (report_id, role)
);

create table signatures (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  engineer_id uuid not null references users (id),
  provider text not null default 'mock',
  provider_reference text,
  document_hash text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index signatures_report_idx on signatures (report_id);

create table notifications_log (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports (id) on delete cascade,
  channel text not null, -- 'email' | 'whatsapp'
  event_type text not null, -- 'field_link_sent' | 'awaiting_review' | 'signed' | 'revalidation_reminder' ...
  recipient text not null,
  status text not null default 'pending', -- 'pending' | 'sent' | 'failed'
  provider_reference text,
  error text,
  created_at timestamptz not null default now()
);

create index notifications_log_report_idx on notifications_log (report_id);
