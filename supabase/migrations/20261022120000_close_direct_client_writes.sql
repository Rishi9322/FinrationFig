-- The browser never talks to PostgREST for user data: every read and write goes through the edge function,
-- which verifies the Firebase / OTP token, enforces the invite rule, applies the rate limits and size caps,
-- and uses the service role (which is unaffected by anything below).
--
-- But earlier migrations also left per-user policies and table grants for the `authenticated` role. They were
-- meant as a backstop; they are also a bypass. Anyone holding the public anon key plus a valid login token
-- could, if the token maps to `authenticated`:
--   * insert their own profiles row directly - which skips the invite-code check, because the edge function
--     only asks for an invite when no profile exists yet;
--   * write calculations / file_uploads / feedback rows with none of the function's rate limits or size caps.
-- Nothing in the app uses these paths, so remove them instead of relying on the token mapping staying unreliable.
-- (set_business_constitution() is left as is: it can only change the caller's own business type.)

drop policy if exists profiles_insert_self on public.profiles;
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists calculations_owner on public.calculations;
drop policy if exists file_uploads_owner on public.file_uploads;
drop policy if exists feedback_owner_insert on public.feedback;
drop policy if exists feedback_owner_select on public.feedback;

revoke all on public.profiles from anon, authenticated;
revoke all on public.calculations from anon, authenticated;
revoke all on public.file_uploads from anon, authenticated;
revoke all on public.feedback from anon, authenticated;
