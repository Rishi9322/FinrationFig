-- Invite-only access: admins mint codes (auto-generated or custom), optionally
-- scoped to one email, a start/expiry window, and a max redemption count. The
-- edge function is the only writer (service role) - same pattern as blog_posts/
-- feedback - so RLS is enabled with no client-facing policy.

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  note text,
  email text,                                -- optional: only this address may redeem it
  created_by text not null,                  -- Firebase uid of the admin who created it
  starts_at timestamptz not null default now(),
  expires_at timestamptz,                    -- null = never expires
  max_uses integer not null default 1 check (max_uses > 0),
  use_count integer not null default 0 check (use_count >= 0),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVOKED')),
  created_at timestamptz not null default now()
);
create unique index invites_code_idx on public.invites(upper(code));
create index invites_status_idx on public.invites(status);

alter table public.invites enable row level security;
-- No client policies: the edge function (service role) is the only reader/writer.

-- Who redeemed which invite, and when - the admin-facing "who signed up with
-- this code" log.
create table public.invite_redemptions (
  id uuid primary key default gen_random_uuid(),
  invite_id uuid not null references public.invites(id) on delete cascade,
  user_id text not null,                     -- Firebase uid of the new account
  user_email text not null,
  redeemed_at timestamptz not null default now()
);
create index invite_redemptions_invite_id_idx on public.invite_redemptions(invite_id, redeemed_at desc);

alter table public.invite_redemptions enable row level security;

/**
 * Atomically validate and consume one use of an invite code.
 *
 * A plain "select then update use_count+1" race: two people redeeming the last
 * remaining slot at once could both pass the use_count check before either
 * writes, over-redeeming the invite. `for update` locks the row for the
 * duration of the function so the second caller waits and then correctly sees
 * the first caller's increment.
 *
 * Returns the invite's id on success, or no rows if the code is missing,
 * inactive, outside its start/expiry window, exhausted, or email-locked to a
 * different address.
 */
create or replace function public.redeem_invite(p_code text, p_email text)
returns table (id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
begin
  select * into v_invite from public.invites
    where upper(code) = upper(p_code)
    for update;

  if not found then return; end if;
  if v_invite.status <> 'ACTIVE' then return; end if;
  if now() < v_invite.starts_at then return; end if;
  if v_invite.expires_at is not null and now() > v_invite.expires_at then return; end if;
  if v_invite.use_count >= v_invite.max_uses then return; end if;
  if v_invite.email is not null and lower(v_invite.email) <> lower(p_email) then return; end if;

  update public.invites set use_count = use_count + 1 where invites.id = v_invite.id;

  return query select v_invite.id;
end;
$$;
revoke execute on function public.redeem_invite(text, text) from public;
-- Only the edge function calls this, authenticated as service_role, which
-- already bypasses grants - no grant to authenticated/anon needed.
