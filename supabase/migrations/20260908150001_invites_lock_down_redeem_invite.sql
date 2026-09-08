-- Supabase grants EXECUTE on public-schema functions to anon/authenticated by
-- default, independent of PUBLIC - the earlier `revoke ... from public` in the
-- invites migration didn't actually block calls via PostgREST's
-- /rest/v1/rpc/redeem_invite. Only the edge function (service_role) should be
-- able to call this: anyone else could burn through max_uses by guessing
-- codes without ever creating an account.
revoke execute on function public.redeem_invite(text, text) from anon, authenticated;
