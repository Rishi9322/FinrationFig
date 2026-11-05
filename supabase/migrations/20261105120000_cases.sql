-- A case groups one borrower's saved calculations. Same access model as calculations:
-- reached only through the edge function (service role), so no client grants or policies.
create table public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,                     -- Firebase uid
  name text not null,
  created_at timestamptz not null default now()
);
create index cases_user_id_created_at_idx on public.cases(user_id, created_at desc);
alter table public.cases enable row level security;
revoke all on public.cases from anon, authenticated;

-- Deleting a case keeps its calculations (they just become unfiled).
alter table public.calculations
  add column case_id uuid references public.cases(id) on delete set null;
create index calculations_case_id_idx on public.calculations(case_id);
