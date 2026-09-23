-- WhatsApp OTP phone verification/sign-in. One pending code per phone number.
-- Only the edge function's service-role key touches this table (RLS bypasses
-- for service role), so anon/authenticated get no policies at all - otherwise
-- anyone with the public anon key could read or forge OTP hashes via PostgREST.
create table if not exists public.phone_otps (
  phone text primary key,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.phone_otps enable row level security;
