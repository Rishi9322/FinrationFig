-- Switch identity to Firebase Auth (Supabase Third-Party Auth).
--
-- Firebase issues the tokens; Supabase validates them and exposes the claims via
-- auth.jwt(). The Firebase uid is auth.jwt() ->> 'sub' (a ~28-char string, NOT a
-- uuid), so every owner key becomes text and RLS keys off the sub claim.
-- auth.uid() is unusable here (it casts sub to uuid and Firebase uids aren't uuids).

-- Remove the Supabase-Auth-era trigger: Firebase signups never touch auth.users.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

drop table if exists public.profiles cascade;
create table public.profiles (
  id text primary key,                       -- Firebase uid
  email text not null,
  name text not null default '',
  role text not null default 'USER' check (role in ('SUPER_ADMIN', 'ADMIN', 'USER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  calculator_access_mode text not null default 'CUSTOM' check (calculator_access_mode in ('FULL', 'CUSTOM')),
  calculator_access text[] not null default array['pid']::text[],
  business_constitution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on public.profiles(role);

alter table public.profiles enable row level security;
grant select, insert on public.profiles to authenticated;

-- Read your own profile.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.jwt() ->> 'sub'));

-- Create your OWN profile on first sign-in. The check pins role/status/mode to
-- defaults, so a client cannot self-provision an admin row.
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.jwt() ->> 'sub')
    and role = 'USER'
    and status = 'ACTIVE'
    and calculator_access_mode = 'CUSTOM'
  );
-- No update/delete policies: onboarding goes through the RPC below; role/status/
-- access are mutated only by the admin edge function via the service role.

-- Onboarding is the one field a user may set on themselves.
create or replace function public.set_business_constitution(p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set business_constitution = p_value, updated_at = now()
   where id = (auth.jwt() ->> 'sub');
end;
$$;
revoke execute on function public.set_business_constitution(text) from public;
grant execute on function public.set_business_constitution(text) to authenticated;

-- App data, owner-keyed by Firebase uid.
drop table if exists public.calculations cascade;
create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                     -- Firebase uid
  calculator_type text not null,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index calculations_user_id_created_at_idx on public.calculations(user_id, created_at desc);
alter table public.calculations enable row level security;
grant select, insert, update, delete on public.calculations to authenticated;
create policy calculations_owner on public.calculations
  for all to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));

drop table if exists public.file_uploads cascade;
create table public.file_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                     -- Firebase uid
  filename text not null,
  content_type text,
  size_bytes bigint,
  file_base64 text not null,
  created_at timestamptz not null default now()
);
create index file_uploads_user_id_created_at_idx on public.file_uploads(user_id, created_at desc);
alter table public.file_uploads enable row level security;
grant select, insert, update, delete on public.file_uploads to authenticated;
create policy file_uploads_owner on public.file_uploads
  for all to authenticated
  using (user_id = (select auth.jwt() ->> 'sub'))
  with check (user_id = (select auth.jwt() ->> 'sub'));
