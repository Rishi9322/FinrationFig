-- Two gaps from the same migration (20260811090000_firebase_auth_rekey.sql),
-- both closing a "client holds a valid Firebase JWT + the anon key" bypass of
-- the edge function - not reachable through the app's current code path
-- (everything goes through the service role), but RLS exists as the backstop
-- for exactly that scenario, so both should hold on their own.

-- profiles_insert_self pinned role/status/calculator_access_mode but not
-- calculator_access, so a self-inserting user could set it to
-- array['cma-generator','doc-parser'] and grant themselves the two
-- admin-restricted tools on signup. Pin it to the table's own safe default.
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert to authenticated
  with check (
    id = (select auth.jwt() ->> 'sub')
    and role = 'USER'
    and status = 'ACTIVE'
    and calculator_access_mode = 'CUSTOM'
    and calculator_access = array['pid']::text[]
  );

-- Postgres/Supabase grants EXECUTE to PUBLIC on new functions by default,
-- which anon inherits regardless of the authenticated-only grant already
-- present - matches the same class of gap redeem_invite had (see
-- 20260908150001_invites_lock_down_redeem_invite.sql) and was already fixed
-- there. set_business_constitution never got the equivalent anon revoke.
revoke execute on function public.set_business_constitution(text) from anon;
