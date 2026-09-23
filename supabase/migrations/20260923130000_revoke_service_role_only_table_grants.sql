-- These 6 tables are meant to be service-role-only (the edge function is the
-- only thing that ever touches them) and currently have zero RLS policies,
-- which correctly denies anon/authenticated access today - but Supabase's
-- default "expose to Data API" grant still hands both roles full
-- INSERT/SELECT/UPDATE/DELETE on every one of them. That's safe only by
-- omission: the first policy someone adds to any of these tables (even a
-- narrow, well-intentioned one) would immediately expose the rest of the
-- table to that grant. Revoke explicitly so there's no policy-shaped footgun.
revoke all on public.invites from anon, authenticated;
revoke all on public.invite_redemptions from anon, authenticated;
revoke all on public.phone_otps from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.audit_events from anon, authenticated;
revoke all on public.kv_store_bd792702 from anon, authenticated;
