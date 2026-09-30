-- Six Flags joins the onboarding picker (added 2026-10-01).
-- Brand only: no open Six Flags consumer settlement has been verified, so none is inserted here.

insert into public.brands (id, name, category, aliases, monogram_color)
values
  ('8eb7d4b5-812f-5e5e-bf9f-1d8be755bf5d', 'Six Flags', 'Entertainment', array[]::text[], '#1F61A6')
on conflict do nothing;
