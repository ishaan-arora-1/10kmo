-- Admin dashboard for the web app (/app/admin), added 2026-10-12.
-- Read-only: public.admin_dashboard() returns the daily funnel as one JSON object, and only
-- accounts listed in private.admins may call it. Nothing here changes user data or plans.

create table private.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

insert into private.admins (user_id)
select id from auth.users where email = 'ishaana612@gmail.com'
on conflict do nothing;

create or replace function public.admin_dashboard()
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

  -- US visitors only (the ads target the US); the owner's own test accounts are left out;
  -- days are India time.
  with me as (
    select id from auth.users where email ilike 'ishaana61%'
  ),
  ev as (
    select f.name, f.detail, f.user_id, f.time_zone, f.created_at,
      (f.created_at at time zone 'Asia/Kolkata')::date as d
    from public.funnel_events as f
    where f.created_at > now() - interval '15 days'
      and (f.user_id is null or f.user_id not in (select id from me))
      and (f.time_zone like 'America/%' or f.time_zone like 'US/%' or f.time_zone = 'Pacific/Honolulu')
  ),
  days as (
    select generate_series((now() at time zone 'Asia/Kolkata')::date - 13,
      (now() at time zone 'Asia/Kolkata')::date, interval '1 day')::date as d
  ),
  signups as (
    select (created_at at time zone 'Asia/Kolkata')::date as d, count(*) as n
    from auth.users
    where created_at > now() - interval '15 days' and id not in (select id from me)
    group by 1
  ),
  daily as (
    select days.d,
      coalesce((select n from signups where signups.d = days.d), 0) as signups,
      count(*) filter (where ev.name = 'app_open') as opens,
      count(*) filter (where ev.name = 'brands_picked') as picked,
      count(*) filter (where ev.name = 'results_seen') as results,
      count(*) filter (where ev.name = 'signin_code_sent') as code_sent,
      count(*) filter (where ev.name = 'signin_code_verified') as signed_in,
      count(distinct ev.user_id) filter (where ev.name = 'paywall_seen') as paywall,
      count(distinct ev.user_id) filter (where ev.name = 'file_locked_tap') as tapped_file,
      count(distinct coalesce(ev.user_id::text, ev.created_at::text)) filter (where ev.name = 'checkout_opened') as checkout,
      count(distinct coalesce(ev.user_id::text, ev.created_at::text)) filter (where ev.name = 'checkout_paid') as paid
    from days left join ev on ev.d = days.d
    group by days.d
  )
  select json_build_object(
    'generated_at', now(),
    'daily', (select json_agg(daily order by d) from daily),
    'subscribers', (
      select coalesce(json_agg(json_build_object('plan', plan, 'source', plan_source, 'n', n)), '[]'::json)
      from (select plan, plan_source, count(*) as n from public.profiles
            where plan <> 'free' and user_id not in (select id from me) group by 1, 2) as p
    ),
    'tried_to_file', (
      select coalesce(json_agg(json_build_object('claim', detail, 'people', people) order by people desc), '[]'::json)
      from (select detail, count(distinct user_id) as people from ev
            where name = 'file_locked_tap' and created_at > now() - interval '7 days' and detail is not null
            group by detail order by people desc limit 8) as t
    ),
    'checkouts', (
      select coalesce(json_agg(json_build_object('at', created_at, 'event', name, 'detail', detail,
        'tz', time_zone, 'who', left(coalesce(user_id::text, 'guest'), 6)) order by created_at desc), '[]'::json)
      from (select * from ev where name like 'checkout_%' order by created_at desc limit 20) as c
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_dashboard() from public, anon;
grant execute on function public.admin_dashboard() to authenticated;
