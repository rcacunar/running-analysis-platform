alter table public.sessions
  add column if not exists intended_activity text,
  add column if not exists added_load_kg double precision check (added_load_kg is null or added_load_kg >= 0),
  add column if not exists session_notes text;

alter table public.session_summaries
  add column if not exists detected_activity text,
  add column if not exists dominant_activity text,
  add column if not exists intense_walk_time_s double precision,
  add column if not exists jog_time_s double precision,
  add column if not exists run_time_s double precision,
  add column if not exists sprint_time_s double precision,
  add column if not exists intense_walk_share double precision,
  add column if not exists jog_share double precision,
  add column if not exists run_share double precision,
  add column if not exists sprint_share double precision;
