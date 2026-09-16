-- Web payments move from Stripe to Razorpay.
-- Removes the Stripe objects from 20260916120000 and adds Razorpay subscriptions.
-- profiles.plan_renews / plan_expires_at let the website show "Renews" or "Ends on …".

drop function if exists public.upsert_stripe_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean);
drop function if exists public.stripe_customer_for_user(uuid);
drop function if exists public.stripe_user_for_customer(text);
drop function if exists public.user_had_stripe_subscription(uuid);
drop function if exists public.active_stripe_subscription_ids(uuid);
drop table if exists private.stripe_subscriptions;
drop table if exists private.stripe_customers;

alter table public.profiles drop constraint if exists profiles_plan_source_check;
update public.profiles set plan_source = null where plan_source = 'stripe';
alter table public.profiles
  add constraint profiles_plan_source_check
    check (plan_source is null or plan_source in ('apple', 'razorpay')),
  add column plan_renews boolean,
  add column plan_expires_at timestamptz;

create table private.razorpay_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  plan public.plan_type not null check (plan <> 'free'),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index razorpay_subscriptions_user_idx
  on private.razorpay_subscriptions (user_id);

grant select, insert, update on private.razorpay_subscriptions to service_role;

-- A yearly plan from either store wins; otherwise any active plan; otherwise free.
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

-- p_cancel_at_period_end = null keeps whatever was recorded before (webhooks don't know it).
create or replace function public.upsert_razorpay_subscription(
  p_subscription_id text,
  p_user_id uuid,
  p_plan_id text,
  p_plan public.plan_type,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean
)
returns public.plan_type
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into private.razorpay_subscriptions (
    subscription_id,
    user_id,
    plan_id,
    plan,
    status,
    current_period_end,
    cancel_at_period_end
  )
  values (
    p_subscription_id,
    p_user_id,
    p_plan_id,
    p_plan,
    p_status,
    p_current_period_end,
    coalesce(p_cancel_at_period_end, false)
  )
  on conflict (subscription_id) do update set
    plan_id = excluded.plan_id,
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = coalesce(
      excluded.current_period_end,
      private.razorpay_subscriptions.current_period_end
    ),
    cancel_at_period_end = coalesce(
      p_cancel_at_period_end,
      private.razorpay_subscriptions.cancel_at_period_end
    ),
    updated_at = now();

  return private.recompute_subscription_plan(p_user_id);
end;
$$;

create or replace function public.razorpay_subscription_owner(p_subscription_id text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select user_id
  from private.razorpay_subscriptions
  where subscription_id = p_subscription_id;
$$;

create or replace function public.user_had_razorpay_subscription(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1
    from private.razorpay_subscriptions
    where user_id = p_user_id
      and status <> 'created'
  );
$$;

create or replace function public.active_razorpay_subscription_ids(p_user_id uuid)
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select subscription_id
  from private.razorpay_subscriptions
  where user_id = p_user_id
    and status in ('created', 'authenticated', 'active', 'pending', 'halted', 'paused');
$$;

revoke all on function public.upsert_razorpay_subscription(text, uuid, text, public.plan_type, text, timestamptz, boolean)
  from public, anon, authenticated;
revoke all on function public.razorpay_subscription_owner(text) from public, anon, authenticated;
revoke all on function public.user_had_razorpay_subscription(uuid) from public, anon, authenticated;
revoke all on function public.active_razorpay_subscription_ids(uuid) from public, anon, authenticated;

grant execute on function public.upsert_razorpay_subscription(text, uuid, text, public.plan_type, text, timestamptz, boolean)
  to service_role;
grant execute on function public.razorpay_subscription_owner(text) to service_role;
grant execute on function public.user_had_razorpay_subscription(uuid) to service_role;
grant execute on function public.active_razorpay_subscription_ids(uuid) to service_role;
