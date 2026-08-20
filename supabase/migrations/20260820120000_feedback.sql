-- Reviews / feature requests / bug reports submitted from the app. Owner-keyed
-- by Firebase uid, same pattern as calculations/file_uploads (see
-- 20260811090000_firebase_auth_rekey.sql).
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                     -- Firebase uid
  user_email text not null,
  type text not null check (type in ('REVIEW', 'FEATURE_REQUEST', 'BUG')),
  message text not null,
  rating smallint check (rating between 1 and 5),
  created_at timestamptz not null default now()
);
create index feedback_user_id_created_at_idx on public.feedback(user_id, created_at desc);
alter table public.feedback enable row level security;
grant select, insert on public.feedback to authenticated;

-- Users can submit and read back their own feedback. Listing everyone's is an
-- admin-only edge function route (service role), not exposed to RLS.
create policy feedback_owner_select on public.feedback
  for select to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'));

create policy feedback_owner_insert on public.feedback
  for insert to authenticated
  with check (user_id = (select auth.jwt() ->> 'sub'));
