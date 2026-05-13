create table if not exists public.app_users (
  id text primary key,
  name text not null,
  email text not null unique,
  phone_number text unique,
  password_hash text not null,
  role text not null default 'USER' check (role in ('SUPER_ADMIN', 'ADMIN', 'USER')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'SUSPENDED')),
  is_verified boolean not null default false,
  otp_code text,
  otp_expiry timestamptz,
  otp_attempts integer not null default 0,
  reset_token_hash text,
  reset_token_expiry timestamptz,
  business_constitution text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.calculator_features (
  id text primary key,
  slug text not null unique,
  name text not null,
  description text
);

create table if not exists public.user_calculator_access (
  user_id text not null references public.app_users(id) on delete cascade,
  feature_slug text not null references public.calculator_features(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, feature_slug)
);

create table if not exists public.calculations (
  id text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  calculator_type text not null,
  inputs jsonb not null default '{}'::jsonb,
  results jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.auth_sessions (
  session_id text primary key,
  user_id text not null references public.app_users(id) on delete cascade,
  csrf_token_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.rate_limits (
  key text primary key,
  count integer not null default 0,
  window_start timestamptz not null
);

create index if not exists app_users_email_idx on public.app_users(email);
create index if not exists app_users_phone_number_idx on public.app_users(phone_number);
create index if not exists calculations_user_id_created_at_idx on public.calculations(user_id, created_at desc);
create index if not exists user_calculator_access_user_id_idx on public.user_calculator_access(user_id);
create index if not exists auth_sessions_user_id_idx on public.auth_sessions(user_id);
