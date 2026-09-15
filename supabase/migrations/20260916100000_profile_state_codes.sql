-- Users can list every state they've lived in so state-limited settlements
-- only match (and only notify) people who can actually claim them.
alter table public.profiles
  add column state_codes text[] not null default '{}';

alter table public.profiles
  add constraint profiles_state_codes_format check (
    array_to_string(state_codes, ',') ~ '^([A-Z]{2}(,[A-Z]{2})*)?$'
  );

grant update (state_codes) on public.profiles to authenticated;
