-- Gumroad memberships for the website, added 2026-10-14, while Paddle's website review is pending.
-- Runs alongside Razorpay and Paddle. Rows are written only by the gumroad-ping function
-- (service role), after it confirms each sale or membership with Gumroad's API.

create table private.gumroad_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  product_id text,
  plan public.plan_type not null check (plan <> 'free'),
  -- 'active' grants access until current_period_end; 'ended' never does.
  status text not null check (status in ('active', 'ended')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  last_sale_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gumroad_subscriptions_user_idx on private.gumroad_subscriptions (user_id);

grant select, insert, update on private.gumroad_subscriptions to service_role;

alter table public.profiles drop constraint if exists profiles_plan_source_check;
alter table public.profiles
  add constraint profiles_plan_source_check
    check (plan_source is null or plan_source in ('apple', 'razorpay', 'paddle', 'gumroad', 'grant'));

-- Same rules as before (an Apple yearly plan wins, then any web plan, then a grant), with
-- Gumroad counted as a web plan next to Razorpay and Paddle.
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

create or replace function public.upsert_gumroad_subscription(
  p_subscription_id text,
  p_user_id uuid,
  p_email text,
  p_product_id text,
  p_plan public.plan_type,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_sale_id text
)
returns public.plan_type
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.gumroad_subscriptions (
    subscription_id, user_id, email, product_id, plan, status,
    current_period_end, cancel_at_period_end, last_sale_id
  )
  values (
    p_subscription_id, p_user_id, p_email, p_product_id, p_plan, p_status,
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_sale_id
  )
  on conflict (subscription_id) do update set
    email = coalesce(excluded.email, private.gumroad_subscriptions.email),
    product_id = coalesce(excluded.product_id, private.gumroad_subscriptions.product_id),
    plan = excluded.plan,
    status = excluded.status,
    -- A renewal moves the end date forward; an ending pulls it in. Null keeps what is stored.
    current_period_end = coalesce(excluded.current_period_end, private.gumroad_subscriptions.current_period_end),
    cancel_at_period_end = excluded.cancel_at_period_end,
    last_sale_id = coalesce(excluded.last_sale_id, private.gumroad_subscriptions.last_sale_id),
    updated_at = now();

  return private.recompute_subscription_plan(p_user_id);
end;
$$;

create or replace function public.gumroad_subscription_state(p_subscription_id text)
returns table (user_id uuid, plan public.plan_type, current_period_end timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select user_id, plan, current_period_end
  from private.gumroad_subscriptions
  where subscription_id = p_subscription_id;
$$;

-- Fallback when a purchase arrives without our user id: the account with the buyer's email.
create or replace function public.user_id_for_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) order by created_at limit 1;
$$;

revoke all on function public.upsert_gumroad_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean, text)
  from public, anon, authenticated;
revoke all on function public.gumroad_subscription_state(text) from public, anon, authenticated;
revoke all on function public.user_id_for_email(text) from public, anon, authenticated;
grant execute on function public.upsert_gumroad_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean, text)
  to service_role;
grant execute on function public.gumroad_subscription_state(text) to service_role;
grant execute on function public.user_id_for_email(text) to service_role;
