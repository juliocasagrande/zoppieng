-- Simple table-backed job queues + admin-managed content
create type job_status as enum ('pending', 'processing', 'done', 'failed');

create table pdf_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  kind text not null default 'report', -- 'report' | 'labels'
  status job_status not null default 'pending',
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index pdf_jobs_status_idx on pdf_jobs (status);

create table notification_jobs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid references reports (id) on delete cascade,
  channel text not null, -- 'email' | 'whatsapp'
  event_type text not null,
  recipient text not null,
  payload jsonb not null default '{}',
  status job_status not null default 'pending',
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index notification_jobs_status_idx on notification_jobs (status);

create table best_practices_content (
  id uuid primary key default gen_random_uuid(),
  module_id uuid references modules (id),
  slug text not null unique,
  title text not null,
  body_html text not null,
  summary text,
  step_context text, -- optional: which field-flow step shows this tip
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
