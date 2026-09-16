-- Complimentary access (owner, testers, press) without a payment.
-- A paid Apple or Razorpay plan always takes precedence over a grant.
-- Grant:  insert into private.plan_grants (user_id, note) values ('<uuid>', 'why');
--         select private.recompute_subscription_plan('<uuid>');
-- Revoke: delete the row, then run the recompute again.

create table private.plan_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan public.plan_type not null default 'yearly' check (plan <> 'free'),
  note text not null default '',
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

revoke all on private.plan_grants from public, anon, authenticated;

alter table public.profiles drop constraint if exists profiles_plan_source_check;
alter table public.profiles
  add constraint profiles_plan_source_check
    check (plan_source is null or plan_source in ('apple', 'razorpay', 'grant'));

create or replace function private.recompute_subscription_plan(p_user_id uuid)
returns public.plan_type
language plpgsql
security invoker
set search_path = ''
as $$
declare
  apple_plan public.plan_type;
  web_plan public.plan_type;
  web_period_end timestamptz;
  web_cancel_at_period_end boolean;
  effective_plan public.plan_type := 'free';
  effective_source text;
  grant_plan public.plan_type;
  grant_expires_at timestamptz;
  renews boolean;
  expires_at timestamptz;
begin
  select case purchase_events.product_id
      when 'com.rightful.app.yearly' then 'yearly'::public.plan_type
      when 'com.rightful.app.weekly' then 'weekly'::public.plan_type
    end
  into apple_plan
  from private.purchase_events as purchase_events
  where purchase_events.user_id = p_user_id
    and purchase_events.revoked_at is null
    and (
      purchase_events.expires_at is null
      or purchase_events.expires_at > now()
    )
    and purchase_events.product_id in (
      'com.rightful.app.yearly',
      'com.rightful.app.weekly'
    )
  order by
    case purchase_events.product_id
      when 'com.rightful.app.yearly' then 0
      else 1
    end,
    purchase_events.expires_at desc nulls first
  limit 1;

  select subscriptions.plan,
    subscriptions.current_period_end,
    subscriptions.cancel_at_period_end
  into web_plan, web_period_end, web_cancel_at_period_end
  from private.razorpay_subscriptions as subscriptions
  where subscriptions.user_id = p_user_id
    and subscriptions.status in ('authenticated', 'active', 'pending')
    and (
      subscriptions.current_period_end is null
      or subscriptions.current_period_end > now()
    )
  order by
    case subscriptions.plan
      when 'yearly' then 0
      else 1
    end,
    subscriptions.current_period_end desc nulls first
  limit 1;

  if apple_plan = 'yearly'
    or (apple_plan is not null and web_plan is distinct from 'yearly')
  then
    effective_plan := apple_plan;
    effective_source := 'apple';
  elsif web_plan is not null then
    effective_plan := web_plan;
    effective_source := 'razorpay';
    renews := not web_cancel_at_period_end;
    expires_at := web_period_end;
  else
    select plan_grants.plan, plan_grants.expires_at
    into grant_plan, grant_expires_at
    from private.plan_grants as plan_grants
    where plan_grants.user_id = p_user_id
      and (plan_grants.expires_at is null or plan_grants.expires_at > now());
    if grant_plan is not null then
      effective_plan := grant_plan;
      effective_source := 'grant';
      expires_at := grant_expires_at;
    end if;
  end if;

  update public.profiles
  set plan = effective_plan,
      plan_source = effective_source,
      plan_renews = renews,
      plan_expires_at = expires_at
  where user_id = p_user_id;

  return effective_plan;
end;
$$;

-- The owner's account.
insert into private.plan_grants (user_id, note)
select users.id, 'Owner'
from auth.users as users
where users.email = 'ishaana612@gmail.com'
on conflict (user_id) do nothing;

select private.recompute_subscription_plan(users.id)
from auth.users as users
where users.email = 'ishaana612@gmail.com';
