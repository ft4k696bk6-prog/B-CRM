-- Prywatny magazyn załączników umów. Pliki są udostępniane wyłącznie
-- przez krótkotrwałe, podpisane adresy generowane przez API CRM.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contract-files',
  'contract-files',
  false,
  null,
  array['application/pdf', 'image/*', 'video/*']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;
