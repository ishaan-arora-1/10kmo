-- Gmail gets its own tile in the onboarding picker (added 2026-10-02).
-- The website counts a Gmail pick as Google for matching; Google keeps its settlements and payouts.
-- "Gmail" stops being a Google alias so searching for it doesn't show two tiles.

insert into public.brands (id, name, category, aliases, monogram_color)
values
  ('981e5b69-c816-5896-b263-f5295a698021', 'Gmail', 'Tech', array[]::text[], '#B91C1C')
on conflict do nothing;

update public.brands set aliases = array_remove(aliases, 'Gmail') where name = 'Google';
