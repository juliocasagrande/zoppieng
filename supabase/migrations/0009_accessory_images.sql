alter table accessory_catalog add column image_path text;

-- Public bucket: catalog thumbnails are non-sensitive product photos, so we
-- serve them directly by public URL instead of paying for signed reads.
insert into storage.buckets (id, name, public)
values ('accessory-images', 'accessory-images', true)
on conflict (id) do nothing;
