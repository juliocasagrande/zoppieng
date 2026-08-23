-- Storage buckets used by the platform. Access is mediated by the API using the
-- service role key (signed upload URLs), so buckets stay private by default.
insert into storage.buckets (id, name, public)
values
  ('report-photos', 'report-photos', false),
  ('accessory-certificates', 'accessory-certificates', false),
  ('report-pdfs', 'report-pdfs', false)
on conflict (id) do nothing;
