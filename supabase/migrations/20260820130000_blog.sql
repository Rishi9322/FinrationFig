-- Blog posts: admin-curated financial pieces (own writing or credited
-- roundups of external articles), public once published. Same
-- service-role-only pattern as feedback/profiles — the edge function is the
-- only writer, so no insert/update policies are needed for anon/authenticated.
create table public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  excerpt text not null,
  content text not null,               -- markdown
  cover_image_url text,
  source_name text,                    -- credit line, e.g. "Livemint" (null if original)
  source_url text,                     -- link back to the original piece
  published boolean not null default false,
  author_id text not null,             -- Firebase uid of the admin who wrote/curated it
  author_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index blog_posts_published_created_at_idx on public.blog_posts(published, created_at desc);
alter table public.blog_posts enable row level security;
grant select on public.blog_posts to anon, authenticated;

-- Public can read only published posts; drafts stay admin-only (service role,
-- bypasses RLS in the edge function).
create policy blog_posts_public_select on public.blog_posts
  for select to anon, authenticated
  using (published = true);
