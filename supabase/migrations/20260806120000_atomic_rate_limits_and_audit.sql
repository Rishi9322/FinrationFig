-- Atomic rate limiting, a typed audit trail, and retention cleanup.
--
-- The previous limiter did a read-modify-write against the KV store, so two
-- concurrent requests could each read the same count and both write count+1 -
-- letting an attacker exceed the limit by racing. Postgres gives us the atomic
-- increment we need in a single statement.

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  event text not null,
  actor_id text references public.app_users(id) on delete set null,
  target_id text references public.app_users(id) on delete set null,
  outcome text not null check (outcome in ('success', 'failure')),
  note text,
  ip text,
  created_at timestamptz not null default now()
);

create index if not exists audit_events_created_at_idx on public.audit_events(created_at desc);
create index if not exists audit_events_actor_idx on public.audit_events(actor_id, created_at desc);
create index if not exists audit_events_event_idx on public.audit_events(event, created_at desc);

alter table public.audit_events enable row level security;

-- Append-only: the service role may insert and read, but never update or delete.
-- Retention is handled by purge_expired_data() below, which runs as the table owner.
revoke update, delete on public.audit_events from public, anon, authenticated, service_role;

/**
 * Consume one unit from a fixed window. Returns true if the request is allowed.
 *
 * The insert-on-conflict is a single atomic statement, so concurrent callers
 * serialise on the row rather than racing between a read and a write. A window
 * that has aged out is reset in the same statement.
 */
create or replace function public.consume_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into public.rate_limits as rl (key, count, window_start)
  values (p_key, 1, now())
  on conflict (key) do update
    set count = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else rl.count + 1
        end,
        window_start = case
          when rl.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else rl.window_start
        end
  returning rl.count into v_count;

  return v_count <= p_limit;
end;
$$;

/**
 * Retention. Uploads hold financial documents and must not live forever; expired
 * rate-limit rows and stale sessions are pure garbage. Call on a schedule.
 */
create or replace function public.purge_expired_data(
  p_upload_retention_days integer default 90,
  p_audit_retention_days integer default 365
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.file_uploads
  where created_at < now() - make_interval(days => p_upload_retention_days);

  delete from public.auth_sessions where expires_at < now();

  delete from public.rate_limits where window_start < now() - interval '1 day';

  delete from public.audit_events
  where created_at < now() - make_interval(days => p_audit_retention_days);
end;
$$;

revoke execute on function public.consume_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.purge_expired_data(integer, integer) from public, anon, authenticated;

-- Schedule retention nightly where pg_cron is available. Guarded so the migration
-- still applies on plans or local stacks without the extension - retention is then
-- a manual `select purge_expired_data();` until it is enabled.
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.unschedule('finratio-purge-expired')
      where exists (select 1 from cron.job where jobname = 'finratio-purge-expired');
    perform cron.schedule('finratio-purge-expired', '30 2 * * *', 'select public.purge_expired_data();');
  else
    raise notice 'pg_cron unavailable; call purge_expired_data() from an external scheduler';
  end if;
exception
  when others then
    raise notice 'Could not schedule purge_expired_data: %', sqlerrm;
end;
$$;
