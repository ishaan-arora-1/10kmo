-- Anonymous funnel events, so we can see where people drop off and roughly where they are.
-- No IP address, no personal data: just the step, the plan, the browser's time zone and language.
-- Added 2026-09-20.

create table public.funnel_events (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 40),
  user_id uuid references auth.users(id) on delete set null,
  -- Rough location proxy from the browser, e.g. 'America/New_York' or 'Asia/Calcutta'.
  time_zone text check (time_zone is null or char_length(time_zone) <= 60),
  language text check (language is null or char_length(language) <= 20),
  plan text check (plan is null or plan in ('yearly', 'weekly')),
  detail text check (detail is null or char_length(detail) <= 200),
  created_at timestamptz not null default now()
);

create index funnel_events_name_created_idx on public.funnel_events (name, created_at desc);

alter table public.funnel_events enable row level security;

-- Anyone using the site may record an event; nobody may read them back.
create policy "Anyone can record a funnel event"
on public.funnel_events for insert
to anon, authenticated
with check (user_id is null or user_id = auth.uid());

revoke all on public.funnel_events from anon, authenticated;
grant insert on public.funnel_events to anon, authenticated;
