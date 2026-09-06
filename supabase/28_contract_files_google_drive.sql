alter table public.contract_files
  add column if not exists drive_file_id text,
  add column if not exists drive_folder_id text,
  add column if not exists drive_web_view_link text,
  add column if not exists drive_sync_error text,
  add column if not exists drive_synced_at timestamptz;

create index if not exists contract_files_drive_file_id_idx
  on public.contract_files (drive_file_id)
  where drive_file_id is not null;
