-- Per-company PDF branding: subscriber companies can white-label the laudo
-- PDF with their own logo, brand colors, and header/footer text instead of
-- always showing Zoppi's own look.
alter table companies
  add column logo_path text,
  add column brand_primary_color text,
  add column brand_secondary_color text,
  add column pdf_header_text text,
  add column pdf_footer_text text;

-- Public bucket: logos are non-sensitive branding assets, same reasoning as
-- accessory-images (0009) — serve by public URL, no signed-read cost.
insert into storage.buckets (id, name, public)
values ('company-logos', 'company-logos', true)
on conflict (id) do nothing;
