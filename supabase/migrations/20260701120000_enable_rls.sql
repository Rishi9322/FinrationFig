-- All application access to these tables goes through the service role
-- (see supabase/functions/make-server-bd792702/index.ts and src/lib/admin.ts),
-- which bypasses RLS entirely. Enabling RLS with no policies for anon/authenticated
-- blocks direct access via the public REST API using the anon/publishable key.
alter table public.app_users enable row level security;
alter table public.calculator_features enable row level security;
alter table public.user_calculator_access enable row level security;
alter table public.calculations enable row level security;
alter table public.auth_sessions enable row level security;
alter table public.rate_limits enable row level security;
alter table public.file_uploads enable row level security;
