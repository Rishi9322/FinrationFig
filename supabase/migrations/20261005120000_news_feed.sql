-- Live news feed: admin-approved headlines with a link and credit back to the source.
-- Only the edge function (service role) reads or writes these tables.

create table public.news_sources (
  id text primary key,
  name text not null,
  kind text not null check (kind in ('rss', 'gdelt')),
  url text not null,
  enabled boolean not null default false,
  display text not null default 'headline' check (display in ('headline', 'snippet')),
  include_terms text[] not null default '{}',
  exclude_terms text[] not null default '{}',
  max_age_days int not null default 14,
  note text,
  last_fetched_at timestamptz,
  last_status text
);

create table public.news_items (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.news_sources(id) on delete cascade,
  title text not null,
  url text not null unique,
  author text,
  snippet text,
  published_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index news_items_status_pub on public.news_items (status, published_at desc);

alter table public.news_sources enable row level security;
alter table public.news_items enable row level security;
revoke all on public.news_sources from anon, authenticated;
revoke all on public.news_items from anon, authenticated;

insert into public.news_sources (id, name, kind, url, enabled, display, include_terms, exclude_terms, max_age_days, note) values
  ('gdelt-msme', 'GDELT news index', 'gdelt',
   'https://api.gdeltproject.org/api/v2/doc/doc?query=%28MSME+OR+%22working+capital%22+OR+%22credit+guarantee%22+OR+GST+OR+RBI%29+sourcecountry%3AIN+sourcelang%3Aenglish&mode=artlist&maxrecords=50&format=json&sort=datedesc&timespan=7d',
   true, 'headline', '{}', '{}', 7,
   'Headlines and links only. GDELT is an open index; each item links to the original publisher.'),
  ('wp-msme', 'WordPress.com: MSME posts', 'rss',
   'https://wordpress.com/tag/msme/feed/', true, 'snippet', '{}', '{}', 30,
   'Public tag feed of independent writers. Short snippet plus link and author credit.'),
  ('rbi-press', 'RBI press releases', 'rss',
   'https://rbi.org.in/pressreleases_rss.xml', false, 'headline', '{}', '{}', 14,
   'Disabled until RBI permission for linking/reuse is confirmed.'),
  ('rbi-notifications', 'RBI notifications', 'rss',
   'https://rbi.org.in/notifications_rss.xml', false, 'headline', '{}', '{}', 30,
   'Disabled until RBI permission for linking/reuse is confirmed.'),
  ('medium-msme', 'Medium: MSME tag', 'rss',
   'https://medium.com/feed/tag/msme', false, 'headline', '{}', '{}', 30,
   'Disabled: Medium terms restrict reuse of content. Enable only after reviewing them.');
