create extension if not exists pgcrypto;

create or replace function public.handle_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  upload_bucket text not null,
  upload_path text not null,
  raw_zip_name text,
  analysis_version text,
  error_message text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz,
  finished_at timestamptz
);

create table if not exists public.session_summaries (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  duration_s double precision,
  distance_m double precision,
  moving_time_s double precision,
  moving_avg_speed_kmh double precision,
  peak_speed_kmh double precision,
  best_3s_speed_kmh double precision,
  best_5s_speed_kmh double precision,
  peak_effort_score double precision,
  mean_effort_score double precision,
  peak_cadence_spm double precision,
  peak_impact_mps2 double precision,
  peak_jerk_mps3 double precision,
  gps_quality_pct double precision,
  gps_accuracy_median_m double precision,
  n_bouts integer,
  n_phases integer,
  n_sprints integer,
  best_sprint_peak_kmh double precision,
  best_sprint_distance_m double precision,
  best_sprint_duration_s double precision,
  best_sprint_time_to_peak_s double precision,
  best_sprint_time_to_50pct_peak_s double precision,
  best_sprint_time_to_90pct_peak_s double precision,
  best_sprint_launch_peak_accel_mps2 double precision,
  best_sprint_launch_mean_accel_mps2 double precision,
  best_sprint_launch_peak_jerk_mps3 double precision,
  best_sprint_plateau_duration_s double precision,
  best_sprint_decel_duration_s double precision,
  best_sprint_stop_duration_s double precision,
  best_sprint_phase_sequence text
);

create table if not exists public.session_sprints (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  sprint_id integer,
  bout_id integer,
  t_start_s double precision,
  t_end_s double precision,
  duration_s double precision,
  distance_m double precision,
  peak_speed_kmh double precision,
  avg_speed_kmh double precision,
  peak_effort double precision,
  avg_effort double precision,
  peak_cadence_spm double precision,
  peak_impact_mps2 double precision,
  time_to_peak_speed_s double precision,
  time_to_35pct_peak_s double precision,
  time_to_50pct_peak_s double precision,
  time_to_90pct_peak_s double precision,
  launch_peak_accel_mps2 double precision,
  launch_mean_accel_mps2 double precision,
  launch_peak_jerk_mps3 double precision,
  plateau_duration_s double precision,
  decel_duration_s double precision,
  stop_duration_s double precision,
  decel_peak_mps2 double precision,
  phase_sequence text
);

create table if not exists public.session_bouts (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  bout_id integer,
  t_start_s double precision,
  t_end_s double precision,
  duration_s double precision,
  distance_m double precision,
  peak_speed_kmh double precision,
  avg_speed_kmh double precision,
  peak_effort double precision,
  avg_effort double precision,
  time_to_35pct_peak_s double precision,
  time_to_50pct_peak_s double precision,
  time_to_90pct_peak_s double precision,
  launch_peak_accel_mps2 double precision,
  launch_mean_accel_mps2 double precision,
  launch_peak_jerk_mps3 double precision,
  plateau_duration_s double precision,
  decel_duration_s double precision,
  stop_duration_s double precision,
  decel_peak_mps2 double precision,
  phase_sequence text
);

create table if not exists public.session_phases (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  bout_id integer,
  sprint_id integer,
  phase text,
  t_start_s double precision,
  t_end_s double precision,
  duration_s double precision,
  distance_m double precision,
  mean_speed_kmh double precision,
  peak_speed_kmh double precision,
  mean_accel_mps2 double precision,
  peak_accel_mps2 double precision,
  min_accel_mps2 double precision,
  mean_effort double precision,
  peak_effort double precision,
  peak_jerk_mps3 double precision
);

create table if not exists public.session_playback_points (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  t_center double precision,
  effort_score double precision,
  speed_kmh double precision,
  cadence_spm double precision,
  phase text,
  sprint_id integer,
  bout_id integer,
  latitude double precision,
  longitude double precision,
  gps_distance_m double precision
);

create table if not exists public.session_feature_points (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  t_center double precision,
  speed_kmh double precision,
  effort_score double precision,
  cadence_spm double precision,
  speed_accel_mps2 double precision,
  impact_peak_mps2 double precision,
  jerk_rms_mps3 double precision,
  phase text,
  sprint_id integer,
  bout_id integer
);

create table if not exists public.session_exports (
  id bigint generated always as identity primary key,
  session_id uuid not null references public.sessions(id) on delete cascade,
  kind text not null,
  bucket text not null,
  storage_path text not null,
  mime_type text,
  file_size_bytes bigint,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.saved_comparisons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  session_ids uuid[] not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists sessions_user_id_idx on public.sessions(user_id, created_at desc);
create index if not exists session_sprints_session_id_idx on public.session_sprints(session_id);
create index if not exists session_bouts_session_id_idx on public.session_bouts(session_id);
create index if not exists session_phases_session_id_idx on public.session_phases(session_id);
create index if not exists session_playback_points_session_id_idx on public.session_playback_points(session_id, t_center);
create index if not exists session_feature_points_session_id_idx on public.session_feature_points(session_id, t_center);
create index if not exists session_exports_session_id_idx on public.session_exports(session_id);
create index if not exists saved_comparisons_user_id_idx on public.saved_comparisons(user_id, created_at desc);

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
for each row execute procedure public.handle_updated_at();

drop trigger if exists sessions_updated_at on public.sessions;
create trigger sessions_updated_at before update on public.sessions
for each row execute procedure public.handle_updated_at();

drop trigger if exists saved_comparisons_updated_at on public.saved_comparisons;
create trigger saved_comparisons_updated_at before update on public.saved_comparisons
for each row execute procedure public.handle_updated_at();

alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.session_summaries enable row level security;
alter table public.session_sprints enable row level security;
alter table public.session_bouts enable row level security;
alter table public.session_phases enable row level security;
alter table public.session_playback_points enable row level security;
alter table public.session_feature_points enable row level security;
alter table public.session_exports enable row level security;
alter table public.saved_comparisons enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "sessions_own_all" on public.sessions
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "session_summaries_own" on public.session_summaries
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "session_sprints_own" on public.session_sprints
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "session_bouts_own" on public.session_bouts
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "session_phases_own" on public.session_phases
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "session_playback_points_own" on public.session_playback_points
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "session_feature_points_own" on public.session_feature_points
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "session_exports_own" on public.session_exports
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);

create policy "saved_comparisons_own_all" on public.saved_comparisons
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('session-zips', 'session-zips', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('session-exports', 'session-exports', false)
on conflict (id) do nothing;

create policy "storage_session_zips_select_own" on storage.objects
for select to authenticated using (
  bucket_id = 'session-zips' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_session_zips_insert_own" on storage.objects
for insert to authenticated with check (
  bucket_id = 'session-zips' and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "storage_session_exports_select_own" on storage.objects
for select to authenticated using (
  bucket_id = 'session-exports' and (storage.foldername(name))[1] = auth.uid()::text
);
