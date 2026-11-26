create table if not exists public.competition_settings (
  id integer primary key default 1 check (id = 1),
  time_limit_seconds integer not null default 180 check (time_limit_seconds between 60 and 3600),
  camera_url text not null default '',
  timer_theme text not null default 'amber' check (timer_theme in ('amber', 'ice', 'lime', 'red')),
  updated_at timestamptz not null default now()
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  members text[] not null default '{}',
  badges text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.team_attempts (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  attempt_number smallint not null check (attempt_number between 1 and 3),
  time_ms integer check (time_ms is null or time_ms >= 0),
  created_at timestamptz not null default now(),
  unique (team_id, attempt_number)
);

insert into public.competition_settings (id) values (1) on conflict (id) do nothing;

alter table public.competition_settings enable row level security;
alter table public.teams enable row level security;
alter table public.team_attempts enable row level security;

create policy "Public can read competition settings" on public.competition_settings for select to anon, authenticated using (true);
create policy "Public can manage competition settings" on public.competition_settings for all to anon, authenticated using (true) with check (true);
create policy "Public can read teams" on public.teams for select to anon, authenticated using (true);
create policy "Public can manage teams" on public.teams for all to anon, authenticated using (true) with check (true);
create policy "Public can read attempts" on public.team_attempts for select to anon, authenticated using (true);
create policy "Public can manage attempts" on public.team_attempts for all to anon, authenticated using (true) with check (true);

alter publication supabase_realtime add table public.teams;
alter publication supabase_realtime add table public.team_attempts;
alter publication supabase_realtime add table public.competition_settings;
