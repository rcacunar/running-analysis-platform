create table if not exists public.session_ai_reports (
  session_id uuid primary key references public.sessions(id) on delete cascade,
  model text,
  report_text text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists session_ai_reports_updated_at on public.session_ai_reports;
create trigger session_ai_reports_updated_at before update on public.session_ai_reports
for each row execute procedure public.handle_updated_at();

alter table public.session_ai_reports enable row level security;

create policy "session_ai_reports_own" on public.session_ai_reports
for select using (
  exists (select 1 from public.sessions s where s.id = session_id and s.user_id = auth.uid())
);
