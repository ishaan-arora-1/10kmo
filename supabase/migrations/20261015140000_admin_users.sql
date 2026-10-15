-- Users page for the web app (/app/users), added 2026-10-15.
-- Read-only: public.admin_users() returns account counts as one JSON object, with the same
-- access rule as admin_dashboard() (only accounts in private.admins). All countries; the
-- owner's own test accounts are left out; days are India time.

create or replace function public.admin_users()
returns json
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result json;
begin
  if not exists (select 1 from private.admins where admins.user_id = auth.uid()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with users as (
    select u.id, (u.created_at at time zone 'Asia/Kolkata')::date as d
    from auth.users as u
    where u.email is null or u.email not ilike 'ishaana61%'
  ),
  today as (
    select (now() at time zone 'Asia/Kolkata')::date as d
  ),
  days as (
    select generate_series(today.d - 29, today.d, interval '1 day')::date as d from today
  ),
  -- Signed-in activity (any tracked event with an account attached).
  active as (
    select distinct f.user_id, (f.created_at at time zone 'Asia/Kolkata')::date as d
    from public.funnel_events as f
    join users on users.id = f.user_id
    where f.created_at > now() - interval '31 days'
  ),
  -- Where people are, from the time zone on their latest tracked event. Accounts made before
  -- tracking started (2026-09-20) have none.
  zones as (
    select distinct on (f.user_id) f.user_id, f.time_zone
    from public.funnel_events as f
    where f.user_id is not null and f.time_zone is not null
    order by f.user_id, f.created_at desc
  ),
  regions as (
    select
      case
        when z.time_zone is null then 'Unknown'
        when z.time_zone like 'America/%' or z.time_zone like 'US/%' or z.time_zone = 'Pacific/Honolulu' then 'US'
        when z.time_zone in ('Asia/Kolkata', 'Asia/Calcutta') then 'India'
        else 'Other'
      end as region,
      count(*) as n
    from users
    left join zones as z on z.user_id = users.id
    group by 1
  )
  select json_build_object(
    'generated_at', now(),
    'total', (select count(*) from users),
    'daily', (
      select json_agg(x order by x.d)
      from (
        select days.d,
          (select count(*) from users where users.d = days.d) as signups,
          (select count(*) from users where users.d <= days.d) as total,
          (select count(*) from active where active.d = days.d) as active
        from days
      ) as x
    ),
    'active_7d', (select count(distinct user_id) from active, today where active.d > today.d - 7),
    'active_30d', (select count(distinct user_id) from active, today where active.d > today.d - 30),
    'regions', (select coalesce(json_agg(json_build_object('region', region, 'n', n) order by n desc), '[]'::json) from regions),
    'usage', json_build_object(
      'picked_companies', (select count(distinct pb.user_id) from public.profile_brands as pb join users on users.id = pb.user_id),
      'saved_claim', (select count(distinct c.user_id) from public.claims as c join users on users.id = c.user_id),
      'filed_claim', (select count(distinct c.user_id) from public.claims as c join users on users.id = c.user_id
                      where c.status in ('Filed', 'Approved', 'Paid')),
      'saw_paywall', (select count(distinct f.user_id) from public.funnel_events as f join users on users.id = f.user_id
                      where f.name = 'paywall_seen'),
      'paying', (select count(*) from public.profiles as p join users on users.id = p.user_id where p.plan <> 'free')
    ),
    'top_companies', (
      select coalesce(json_agg(json_build_object('name', name, 'n', n) order by n desc), '[]'::json)
      from (
        select b.name, count(*) as n
        from public.profile_brands as pb
        join users on users.id = pb.user_id
        join public.brands as b on b.id = pb.brand_id
        group by b.name
        order by n desc, b.name
        limit 10
      ) as t
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_users() from public, anon;
grant execute on function public.admin_users() to authenticated;
