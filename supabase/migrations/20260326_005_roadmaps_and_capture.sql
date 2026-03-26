alter table public.sessions
  add column if not exists captured_at_local timestamp,
  add column if not exists source_session_label text;

create index if not exists sessions_user_captured_at_idx on public.sessions(user_id, captured_at_local desc nulls last, created_at desc);

create table if not exists public.training_roadmaps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  target_training_count integer check (target_training_count is null or target_training_count > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.roadmap_sessions (
  id bigint generated always as identity primary key,
  roadmap_id uuid not null references public.training_roadmaps(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  position integer not null default 1,
  added_at timestamptz not null default timezone('utc', now()),
  unique (roadmap_id, session_id)
);

create table if not exists public.roadmap_ai_reports (
  roadmap_id uuid primary key references public.training_roadmaps(id) on delete cascade,
  model text not null,
  report_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists training_roadmaps_user_id_idx on public.training_roadmaps(user_id, created_at desc);
create index if not exists roadmap_sessions_roadmap_id_idx on public.roadmap_sessions(roadmap_id, position, added_at);

drop trigger if exists training_roadmaps_updated_at on public.training_roadmaps;
create trigger training_roadmaps_updated_at before update on public.training_roadmaps
for each row execute procedure public.handle_updated_at();

drop trigger if exists roadmap_ai_reports_updated_at on public.roadmap_ai_reports;
create trigger roadmap_ai_reports_updated_at before update on public.roadmap_ai_reports
for each row execute procedure public.handle_updated_at();

alter table public.training_roadmaps enable row level security;
alter table public.roadmap_sessions enable row level security;
alter table public.roadmap_ai_reports enable row level security;

drop policy if exists "training_roadmaps_own" on public.training_roadmaps;
create policy "training_roadmaps_own" on public.training_roadmaps
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "roadmap_sessions_own" on public.roadmap_sessions;
create policy "roadmap_sessions_own" on public.roadmap_sessions
for all using (
  exists (select 1 from public.training_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from public.training_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid())
);

drop policy if exists "roadmap_ai_reports_own" on public.roadmap_ai_reports;
create policy "roadmap_ai_reports_own" on public.roadmap_ai_reports
for select using (
  exists (select 1 from public.training_roadmaps r where r.id = roadmap_id and r.user_id = auth.uid())
);
