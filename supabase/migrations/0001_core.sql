-- Zoppi platform core schema: companies, users, modules, subscriptions
create extension if not exists "pgcrypto";

create type company_kind as enum ('service_provider', 'facility_owner', 'both');

create table companies (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null,
  trade_name text,
  cnpj text not null,
  kind company_kind not null default 'facility_owner',
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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index companies_cnpj_key on companies (cnpj);

create type user_role as enum ('zoppi_admin', 'zoppi_engineer', 'company_admin', 'company_operational');

-- Mirrors auth.users; one row per platform user with role + company link.
create table users (
  id uuid primary key references auth.users (id) on delete cascade,
  company_id uuid references companies (id) on delete set null,
  role user_role not null,
  full_name text not null,
  email text not null,
  phone text,
  -- Only meaningful for zoppi_engineer.
  crea_number text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index users_email_key on users (email);

create table modules (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into modules (slug, name, description) values
  ('ancoragem', 'Ancoragem', 'Laudos de inspeção e instalação de pontos de ancoragem / linha de vida (NR-35).');

create type subscription_status as enum ('trialing', 'active', 'past_due', 'cancelled');

create table module_subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies (id) on delete cascade,
  module_id uuid not null references modules (id) on delete cascade,
  status subscription_status not null default 'trialing',
  plan_code text not null default 'standard',
  monthly_amount_cents integer not null default 0,
  mercadopago_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, module_id)
);

create index module_subscriptions_company_idx on module_subscriptions (company_id);

create table app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_config (key, value) values
  ('report_default_validity_months', '12'),
  ('report_reminder_days_before', '[30, 7]'),
  ('field_token_default_expiry_days', '7');
