-- App Store subscriptions for the ClaimRightful app (mobile/), added 2026-10-10:
--   com.claimrightful.app.monthly → monthly
--   com.claimrightful.app.yearly  → yearly
-- The older com.rightful.app.* products stay recognized. Only Apple product IDs change here;
-- Razorpay (website) subscriptions and grants are ranked exactly as before.

create or replace function private.apple_product_plan(p_product_id text)
returns public.plan_type
language sql
immutable
set search_path = ''
as $$
  select case p_product_id
    when 'com.claimrightful.app.yearly' then 'yearly'::public.plan_type
    when 'com.claimrightful.app.monthly' then 'monthly'::public.plan_type
    when 'com.rightful.app.yearly' then 'yearly'::public.plan_type
    when 'com.rightful.app.weekly' then 'weekly'::public.plan_type
  end
$$;

-- recompute_subscription_plan is security invoker and runs as service_role from the edge
-- functions, so service_role needs this too (see 20260929100000_plan_grants_service_role.sql).
revoke all on function private.apple_product_plan(text) from public, anon, authenticated;
grant execute on function private.apple_product_plan(text) to service_role;

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
  select private.apple_product_plan(purchase_events.product_id)
  into apple_plan
  from private.purchase_events as purchase_events
  where purchase_events.user_id = p_user_id
    and purchase_events.revoked_at is null
    and (
      purchase_events.expires_at is null
      or purchase_events.expires_at > now()
    )
    and private.apple_product_plan(purchase_events.product_id) is not null
  order by
    case private.apple_product_plan(purchase_events.product_id)
      when 'yearly' then 0
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

-- create or replace keeps recompute_subscription_plan's existing grant to service_role.
