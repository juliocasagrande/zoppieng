-- Engineer's uploaded signature image (white background, as if signed on
-- paper) — rendered in the PDF signature block alongside the ICP-Brasil
-- digital certificate and ART, not instead of them.
alter table users add column signature_path text;

-- Supporting documents the engineer attaches to a laudo (annex index, section
-- A of the master template): calibration certificates, datasheets, project
-- memorials, lab reports, etc. Kept as files, not laudo content — the PDF
-- annex index lists whatever is attached here.
create table report_attachments (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports (id) on delete cascade,
  category text not null,
  label text not null,
  storage_path text not null,
  uploaded_by uuid references users (id),
  created_at timestamptz not null default now()
);

create index report_attachments_report_id_idx on report_attachments (report_id);

alter table report_attachments enable row level security;

create policy report_attachments_rw on report_attachments for all
  using (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()))
  with check (is_zoppi_staff() or report_id in (select id from reports where company_id = current_user_company_id()));

-- Signatures are low-sensitivity branding-like images (same as company
-- logos), so the bucket is public like company-logos; report attachments can
-- contain sensitive certificates/documents, so that bucket stays private and
-- is served through signed URLs like report-photos.
insert into storage.buckets (id, name, public)
values
  ('engineer-signatures', 'engineer-signatures', true),
  ('report-attachments', 'report-attachments', false)
on conflict (id) do nothing;
