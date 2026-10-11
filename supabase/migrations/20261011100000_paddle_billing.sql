-- Paddle Billing for the website (Apple Pay, Google Pay, PayPal and cards), added 2026-10-11.
-- Runs alongside Razorpay: existing Razorpay subscriptions keep renewing and counting.
-- Rows are written only by the paddle-webhook and paddle-cancel functions (service role).

create table private.paddle_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text,
  price_id text not null,
  plan public.plan_type not null check (plan <> 'free'),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  -- When the newest applied event happened; older events arriving late are ignored.
  occurred_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index paddle_subscriptions_user_idx on private.paddle_subscriptions (user_id);

grant select, insert, update on private.paddle_subscriptions to service_role;

alter table public.profiles drop constraint if exists profiles_plan_source_check;
alter table public.profiles
  add constraint profiles_plan_source_check
    check (plan_source is null or plan_source in ('apple', 'razorpay', 'paddle', 'grant'));

-- Same rules as before (an Apple yearly plan wins, then any web plan, then a grant), with
-- Paddle counted as a web plan next to Razorpay. Apple products come from
-- private.apple_product_plan (20261010100000), so App Store plans rank exactly as before.
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
    -- Paddle keeps access through past_due (it retries the card); canceled means ended.
    select paddle.plan, paddle.current_period_end, paddle.cancel_at_period_end,
      'paddle' as source
    from private.paddle_subscriptions as paddle
    where paddle.user_id = p_user_id
      and paddle.status in ('active', 'trialing', 'past_due')
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
    current_period_end, cancel_at_period_end, occurred_at
  )
  values (
    p_subscription_id, p_user_id, p_customer_id, p_price_id, p_plan, p_status,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_occurred_at
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
    updated_at = now()
  -- Webhooks can arrive out of order: never let an older event overwrite a newer one.
  where private.paddle_subscriptions.occurred_at is null
    or excluded.occurred_at is null
    or excluded.occurred_at >= private.paddle_subscriptions.occurred_at;

  return private.recompute_subscription_plan(p_user_id);
end;
$$;

create or replace function public.paddle_subscription_owner(p_subscription_id text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select user_id from private.paddle_subscriptions where subscription_id = p_subscription_id;
$$;

create or replace function public.active_paddle_subscription_ids(p_user_id uuid)
returns text[]
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(array_agg(subscription_id), '{}')
  from private.paddle_subscriptions
  where user_id = p_user_id
    and status in ('active', 'trialing', 'past_due');
$$;

revoke all on function public.upsert_paddle_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean, timestamptz)
  from public, anon, authenticated;
revoke all on function public.paddle_subscription_owner(text) from public, anon, authenticated;
revoke all on function public.active_paddle_subscription_ids(uuid) from public, anon, authenticated;

grant execute on function public.upsert_paddle_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean, timestamptz)
  to service_role;
grant execute on function public.paddle_subscription_owner(text) to service_role;
grant execute on function public.active_paddle_subscription_ids(uuid) to service_role;
