-- The website now handles featured and not-yet-open settlements, so publish the Apple row.
-- It shows to everyone with "Claims open Sep 21"; filing stays disabled until the
-- administrator's claim site is live and its real URL replaces the placeholder.

update public.settlements
set status = 'verified', published_at = now()
where id = '0e0a8a5e-4a3f-5d52-9a1e-9b2a1f0d7c31';
