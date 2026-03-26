alter table public.profiles
  add column if not exists age_years integer check (age_years between 10 and 100),
  add column if not exists sex text check (sex in ('male', 'female', 'other', 'prefer_not_to_say')),
  add column if not exists weight_kg double precision check (weight_kg > 20 and weight_kg < 300),
  add column if not exists height_cm double precision check (height_cm > 100 and height_cm < 260),
  add column if not exists resting_heart_rate_bpm integer check (resting_heart_rate_bpm between 25 and 220),
  add column if not exists max_heart_rate_bpm integer check (max_heart_rate_bpm between 60 and 260),
  add column if not exists training_level text,
  add column if not exists primary_goal text,
  add column if not exists notes text;

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);
