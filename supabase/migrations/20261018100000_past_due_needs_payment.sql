-- Failed first payment after a free trial: no access (2026-10-18). Until now Paddle's
-- past_due status kept access, which suits a paying customer whose renewal card fails, but it
-- also gave a full year to someone whose very first charge (at the end of the 1-day trial)
-- failed. Now past_due keeps access only if the subscription has been paid before
-- (ever_paid: it has been 'active' at some point). If Paddle's retry succeeds, the subscription
-- turns active and access comes back by itself.

alter table private.paddle_subscriptions add column ever_paid boolean not null default false;

-- Active now means paid at least once. Today's past_due trial (never paid) stays false.
update private.paddle_subscriptions set ever_paid = true where status = 'active';

create or replace function public.upsert_paddle_subscription(
  p_subscription_id text,
  p_user_id uuid,
  p_customer_id text,
  p_price_id text,
  p_plan public.plan_type,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_occurred_at timestamptz
)
returns public.plan_type
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.paddle_subscriptions (
    subscription_id, user_id, customer_id, price_id, plan, status,
    current_period_end, cancel_at_period_end, occurred_at, ever_paid
  )
  values (
    p_subscription_id, p_user_id, p_customer_id, p_price_id, p_plan, p_status,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_occurred_at, p_status = 'active'
  )
  on conflict (subscription_id) do update set
    customer_id = coalesce(excluded.customer_id, private.paddle_subscriptions.customer_id),
    price_id = excluded.price_id,
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = coalesce(
      excluded.current_period_end,
      private.paddle_subscriptions.current_period_end
    ),
    cancel_at_period_end = excluded.cancel_at_period_end,
    occurred_at = excluded.occurred_at,
    ever_paid = private.paddle_subscriptions.ever_paid or excluded.ever_paid,
    updated_at = now()
  -- Webhooks can arrive out of order: never let an older event overwrite a newer one.
  where private.paddle_subscriptions.occurred_at is null
    or excluded.occurred_at is null
    or excluded.occurred_at >= private.paddle_subscriptions.occurred_at;

  return private.recompute_subscription_plan(p_user_id);
end;
$$;

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

  select web.plan, web.current_period_end, web.cancel_at_period_end, web.source
  into web_plan, web_period_end, web_cancel_at_period_end, web_source
  from (
    select razorpay.plan, razorpay.current_period_end, razorpay.cancel_at_period_end,
      'razorpay' as source
    from private.razorpay_subscriptions as razorpay
    where razorpay.user_id = p_user_id
      and razorpay.status in ('authenticated', 'active', 'pending')
    union all
    -- Paddle keeps access through past_due (it retries the card) only for subscriptions that
    -- have been paid before; a failed first charge after a free trial means no access until a
    -- retry succeeds. Canceled means ended.
    select paddle.plan, paddle.current_period_end, paddle.cancel_at_period_end,
      'paddle' as source
    from private.paddle_subscriptions as paddle
    where paddle.user_id = p_user_id
      and (
        paddle.status in ('active', 'trialing')
        or (paddle.status = 'past_due' and paddle.ever_paid)
      )
    union all
    -- Gumroad memberships: access runs to the end of the paid period (plus a short grace).
    select gumroad.plan, gumroad.current_period_end, gumroad.cancel_at_period_end,
      'gumroad' as source
    from private.gumroad_subscriptions as gumroad
    where gumroad.user_id = p_user_id
      and gumroad.status = 'active'
  ) as web
  where web.current_period_end is null or web.current_period_end > now()
  order by
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

-- Apply the new rule to everyone it affects now.
select private.recompute_subscription_plan(user_id)
from private.paddle_subscriptions
where status = 'past_due';
