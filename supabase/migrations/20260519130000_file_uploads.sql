create table if not exists public.file_uploads (
  id text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes bigint,
  file_base64 text not null,
  created_at timestamptz not null default now()
);

create index if not exists file_uploads_user_id_created_at_idx
  on public.file_uploads(user_id, created_at desc);
