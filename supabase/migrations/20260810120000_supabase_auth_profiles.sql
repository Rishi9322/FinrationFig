-- Migration to Supabase Auth (GoTrue).
--
-- The custom auth backend (app_users + password hashes + OTP + auth_sessions)
-- is retired. Identity now lives in auth.users; everything the app needs beyond
-- identity (role, calculator access, status, onboarding) lives in public.profiles,
-- keyed 1:1 to auth.users. RLS lets the browser read/write its OWN rows directly,
-- so calculations and uploads no longer need a bespoke API. Privileged fields
-- (role, status, calculator access) are never writable from the client — admin
-- routes mutate them with the service role, which bypasses RLS.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created automatically by a trigger.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
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

create index if not exists profiles_role_idx on public.profiles(role);

-- New signups get a default USER profile. Name comes from signUp metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Onboarding is the only profile field the user may set themselves. A SECURITY
-- DEFINER RPC updates just that one column, so no client-writable RLS policy has
-- to expose role/status/access for privilege escalation.
create or replace function public.set_business_constitution(p_value text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set business_constitution = p_value,
         updated_at = now()
   where id = auth.uid();
end;
$$;

-- Postgres grants EXECUTE to PUBLIC by default; restrict to signed-in users.
revoke execute on function public.set_business_constitution(text) from public;
grant execute on function public.set_business_constitution(text) to authenticated;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
-- No insert/update/delete policies: the trigger inserts, the RPC updates
-- onboarding, and admin routes use the service role. Everything else is denied.

-- ---------------------------------------------------------------------------
-- App data re-keyed to auth.users(id). Old rows referenced the retired
-- app_users table; the migration decision is "fresh start for non-admins", so
-- these are dropped and recreated with uuid ownership + owner-only RLS.
-- ---------------------------------------------------------------------------
drop table if exists public.calculations cascade;
create table public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  calculator_type text not null,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index calculations_user_id_created_at_idx on public.calculations(user_id, created_at desc);

alter table public.calculations enable row level security;
create policy calculations_owner on public.calculations
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop table if exists public.file_uploads cascade;
create table public.file_uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null,
  content_type text,
  size_bytes bigint,
  file_base64 text not null,
  created_at timestamptz not null default now()
);
create index file_uploads_user_id_created_at_idx on public.file_uploads(user_id, created_at desc);

alter table public.file_uploads enable row level security;
create policy file_uploads_owner on public.file_uploads
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Retire the custom-auth tables. audit_events and rate_limits stay (used by the
-- admin audit trail and the AI proxy rate limiter).
-- ---------------------------------------------------------------------------
drop table if exists public.auth_sessions cascade;
drop table if exists public.user_calculator_access cascade;
drop table if exists public.app_users cascade;
