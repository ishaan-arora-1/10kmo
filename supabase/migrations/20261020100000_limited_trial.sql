-- Free trials cover three claims (2026-10-20). During the yearly plan's free trial, people can
-- file the three most-filed claims (the list lives in the website's config); the rest unlock
-- when the first payment goes through, either when the trial ends or when they choose to pay
-- early (paddle-unlock function, or a monthly checkout that ends the trial).
--
-- private.paddle_subscriptions.limited_trial marks trials started under this rule. It defaults
-- to false here, so nothing changes until the website that explains the limit is live; the
-- next migration turns it on for new trials. Trials that started earlier keep full access.
--
-- public.profiles.plan_trial_until is what the website reads: when the limited trial ends, or
-- null when the account has full access (or no plan). Only the database writes it.

alter table private.paddle_subscriptions add column limited_trial boolean not null default false;

alter table public.profiles add column plan_trial_until timestamptz;

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
  web_source text;
  web_limited_trial boolean;
  effective_plan public.plan_type := 'free';
  effective_source text;
  grant_plan public.plan_type;
  grant_expires_at timestamptz;
  renews boolean;
  expires_at timestamptz;
  trial_until timestamptz;
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

  select web.plan, web.current_period_end, web.cancel_at_period_end, web.source, web.limited_trial
  into web_plan, web_period_end, web_cancel_at_period_end, web_source, web_limited_trial
  from (
    select razorpay.plan, razorpay.current_period_end, razorpay.cancel_at_period_end,
      'razorpay' as source, false as limited_trial
    from private.razorpay_subscriptions as razorpay
    where razorpay.user_id = p_user_id
      and razorpay.status in ('authenticated', 'active', 'pending')
    union all
    -- Paddle keeps access through past_due (it retries the card) only for subscriptions that
    -- have been paid before; a failed first charge after a free trial means no access until a
    -- retry succeeds. Canceled means ended.
    select paddle.plan, paddle.current_period_end, paddle.cancel_at_period_end,
      'paddle' as source, paddle.status = 'trialing' and paddle.limited_trial as limited_trial
    from private.paddle_subscriptions as paddle
    where paddle.user_id = p_user_id
      and (
        paddle.status in ('active', 'trialing')
        or (paddle.status = 'past_due' and paddle.ever_paid)
      )
    union all
    -- Gumroad memberships: access runs to the end of the paid period (plus a short grace).
    select gumroad.plan, gumroad.current_period_end, gumroad.cancel_at_period_end,
      'gumroad' as source, false as limited_trial
    from private.gumroad_subscriptions as gumroad
    where gumroad.user_id = p_user_id
      and gumroad.status = 'active'
  ) as web
  where web.current_period_end is null or web.current_period_end > now()
  -- A plan with full access beats a limited trial, then yearly beats monthly.
  order by
    web.limited_trial,
    case web.plan
      when 'yearly' then 0
      else 1
    end,
    web.current_period_end desc nulls first
  limit 1;

  if apple_plan = 'yearly'
    or (apple_plan is not null and web_plan is distinct from 'yearly')
  then
    effective_plan := apple_plan;
    effective_source := 'apple';
  elsif web_plan is not null then
    effective_plan := web_plan;
    effective_source := web_source;
    renews := not web_cancel_at_period_end;
    expires_at := web_period_end;
    if web_limited_trial then
      trial_until := web_period_end;
    end if;
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
      plan_expires_at = expires_at,
      plan_trial_until = trial_until
  where user_id = p_user_id;

  return effective_plan;
end;
$$;

-- The account's Paddle subscriptions still in their free trial: paddle-unlock activates one,
-- and the webhook cancels them once another subscription is paid.
create or replace function public.trialing_paddle_subscription_ids(p_user_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(subscription_id order by created_at desc), '{}')
  from private.paddle_subscriptions
  where user_id = p_user_id
    and status = 'trialing';
$$;

revoke all on function public.trialing_paddle_subscription_ids(uuid) from public, anon, authenticated;
grant execute on function public.trialing_paddle_subscription_ids(uuid) to service_role;
