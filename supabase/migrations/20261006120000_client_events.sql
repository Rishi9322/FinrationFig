-- Diagnostic breadcrumbs from the app (e.g. where a CMA upload stalled on a phone).
-- Stores no file names or contents: only type, size, timings and error text.
-- Service-role only: the edge function is the single reader and writer.
create table public.client_events (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  kind text not null check (kind in ('cma_upload_start', 'cma_upload_end')),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index client_events_created on public.client_events (created_at desc);

alter table public.client_events enable row level security;
revoke all on public.client_events from anon, authenticated;
