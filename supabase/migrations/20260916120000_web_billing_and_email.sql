-- Web app support:
--   * Stripe subscriptions bought on the website unlock the iPhone app too.
--   * profiles.plan_source records whether the active plan came from Apple or Stripe.
--   * Email reminders for people who use Rightful on the web.

alter table public.profiles
  add column plan_source text
    check (plan_source is null or plan_source in ('apple', 'stripe')),
  add column email text,
  add column email_reminders boolean not null default false;

grant update (email_reminders) on public.profiles to authenticated;

update public.profiles as profiles
set email = users.email
from auth.users as users
where users.id = profiles.user_id;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name, email)
  values (
    new.id,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  );
  return new;
end;
$$;

create or replace function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email
  where user_id = new.id;
  return new;
end;
$$;

revoke all on function private.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_changed
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function private.sync_profile_email();

create table private.stripe_customers (
  user_id uuid primary key references auth.users(id) on delete cascade,
  customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table private.stripe_subscriptions (
  subscription_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  customer_id text not null,
  price_id text not null,
  plan public.plan_type not null check (plan <> 'free'),
  status text not null,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index stripe_subscriptions_user_idx
  on private.stripe_subscriptions (user_id);

grant select, insert, update on private.stripe_customers to service_role;
grant select, insert, update on private.stripe_subscriptions to service_role;

-- A yearly plan from either store wins; otherwise any active plan; otherwise free.
create or replace function private.recompute_subscription_plan(p_user_id uuid)
returns public.plan_type
language plpgsql
security invoker
set search_path = ''
as $$
declare
  apple_plan public.plan_type;
  stripe_plan public.plan_type;
  effective_plan public.plan_type := 'free';
  effective_source text;
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

  select subscriptions.plan
  into stripe_plan
  from private.stripe_subscriptions as subscriptions
  where subscriptions.user_id = p_user_id
    and subscriptions.status in ('active', 'trialing', 'past_due')
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
    or (apple_plan is not null and stripe_plan is distinct from 'yearly')
  then
    effective_plan := apple_plan;
    effective_source := 'apple';
  elsif stripe_plan is not null then
    effective_plan := stripe_plan;
    effective_source := 'stripe';
  end if;

  update public.profiles
  set plan = effective_plan,
      plan_source = effective_source
  where user_id = p_user_id;

  return effective_plan;
end;
$$;

create or replace function public.upsert_stripe_subscription(
  p_subscription_id text,
  p_user_id uuid,
  p_customer_id text,
  p_price_id text,
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
  insert into private.stripe_customers (user_id, customer_id)
  values (p_user_id, p_customer_id)
  on conflict (user_id) do update set customer_id = excluded.customer_id;

  insert into private.stripe_subscriptions (
    subscription_id,
    user_id,
    customer_id,
    price_id,
    plan,
    status,
    current_period_end,
    cancel_at_period_end
  )
  values (
    p_subscription_id,
    p_user_id,
    p_customer_id,
    p_price_id,
    p_plan,
    p_status,
    p_current_period_end,
    p_cancel_at_period_end
  )
  on conflict (subscription_id) do update set
    user_id = excluded.user_id,
    customer_id = excluded.customer_id,
    price_id = excluded.price_id,
    plan = excluded.plan,
    status = excluded.status,
    current_period_end = excluded.current_period_end,
    cancel_at_period_end = excluded.cancel_at_period_end,
    updated_at = now();

  return private.recompute_subscription_plan(p_user_id);
end;
$$;

create or replace function public.stripe_customer_for_user(p_user_id uuid)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select customer_id from private.stripe_customers where user_id = p_user_id;
$$;

create or replace function public.stripe_user_for_customer(p_customer_id text)
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select user_id from private.stripe_customers where customer_id = p_customer_id;
$$;

create or replace function public.user_had_stripe_subscription(p_user_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from private.stripe_subscriptions where user_id = p_user_id
  );
$$;

create or replace function public.active_stripe_subscription_ids(p_user_id uuid)
returns setof text
language sql
stable
security invoker
set search_path = ''
as $$
  select subscription_id
  from private.stripe_subscriptions
  where user_id = p_user_id
    and status not in ('canceled', 'incomplete_expired');
$$;

revoke all on function public.upsert_stripe_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean)
  from public, anon, authenticated;
revoke all on function public.stripe_customer_for_user(uuid) from public, anon, authenticated;
revoke all on function public.stripe_user_for_customer(text) from public, anon, authenticated;
revoke all on function public.user_had_stripe_subscription(uuid) from public, anon, authenticated;
revoke all on function public.active_stripe_subscription_ids(uuid) from public, anon, authenticated;

grant execute on function public.upsert_stripe_subscription(text, uuid, text, text, public.plan_type, text, timestamptz, boolean)
  to service_role;
grant execute on function public.stripe_customer_for_user(uuid) to service_role;
grant execute on function public.stripe_user_for_customer(text) to service_role;
grant execute on function public.user_had_stripe_subscription(uuid) to service_role;
grant execute on function public.active_stripe_subscription_ids(uuid) to service_role;
