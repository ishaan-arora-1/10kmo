create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges in schema public
  revoke execute on functions from public, anon, authenticated;

create type public.settlement_status as enum ('draft', 'verified', 'closed');
create type public.claim_status as enum ('To file', 'Filed', 'Approved', 'Rejected', 'Paid');
create type public.plan_type as enum ('free', 'yearly', 'weekly');

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text not null,
  aliases text[] not null default '{}',
  monogram_color text not null check (monogram_color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  company text not null,
  brand_id uuid not null references public.brands(id) on delete restrict,
  eligible_state_codes text[] not null default '{}',
  payout_min numeric(10, 2) not null check (payout_min >= 0),
  payout_max numeric(10, 2) not null check (payout_max >= payout_min),
  deadline date not null,
  proof_required boolean not null default false,
  qualifies_summary text not null,
  eligibility_details text[] not null check (cardinality(eligibility_details) >= 1),
  claim_url text not null check (claim_url ~ '^https://'),
  expected_payout_date text not null,
  payout_window_start date,
  official_notice_url text check (official_notice_url is null or official_notice_url ~ '^https://'),
  source_checked_at timestamptz,
  source_checked_by uuid references auth.users(id) on delete set null,
  status public.settlement_status not null default 'draft',
  published_at timestamptz,
  is_sample boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint verified_settlement_has_source check (
    status <> 'verified'
    or is_sample
    or (official_notice_url is not null and source_checked_at is not null)
  )
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  state_code text check (state_code is null or state_code ~ '^[A-Z]{2}$'),
  plan public.plan_type not null default 'free',
  notifications_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profile_brands (
  user_id uuid not null references auth.users(id) on delete cascade,
  brand_id uuid not null references public.brands(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  settlement_id uuid not null references public.settlements(id) on delete restrict,
  status public.claim_status not null default 'Filed',
  claim_ref text,
  filed_at timestamptz,
  paid_amount numeric(10, 2) check (paid_amount is null or paid_amount >= 0),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, settlement_id),
  constraint paid_claim_has_payment check (
    status <> 'Paid' or (paid_amount is not null and paid_at is not null)
  )
);

create table public.notification_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apns_token text not null unique,
  environment text not null check (environment in ('sandbox', 'production')),
  last_seen_at timestamptz not null default now()
);

create table private.purchase_events (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  original_transaction_id text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_at timestamptz not null,
  signed_transaction_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.subscription_owners (
  original_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table private.pending_subscription_events (
  notification_uuid uuid primary key,
  transaction_id text not null,
  original_transaction_id text not null,
  product_id text not null,
  app_account_token uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_at timestamptz not null,
  signed_transaction_hash text not null,
  created_at timestamptz not null default now()
);

create table private.notification_log (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id uuid references public.notification_devices(id) on delete cascade,
  notification_type text not null,
  payload jsonb not null,
  status text not null default 'claimed'
    check (status in ('claimed', 'retry', 'sent', 'failed')),
  attempt_count integer not null default 1 check (attempt_count > 0),
  attempted_at timestamptz not null default now(),
  next_attempt_at timestamptz,
  sent_at timestamptz
);

create index notification_log_user_sent_idx
  on private.notification_log (user_id, sent_at desc);
create index purchase_events_user_idx
  on private.purchase_events (user_id);
create index purchase_events_active_user_idx
  on private.purchase_events (user_id, expires_at desc)
  where revoked_at is null;
create index subscription_owners_user_idx
  on private.subscription_owners (user_id);
create index pending_subscription_original_idx
  on private.pending_subscription_events (original_transaction_id, signed_at);

grant usage on schema private to service_role;
grant select, insert, update on private.purchase_events to service_role;
grant select, insert on private.subscription_owners to service_role;
grant select, insert, delete on private.pending_subscription_events to service_role;
grant select, insert, update, delete on private.notification_log to service_role;

create or replace function private.recompute_subscription_plan(p_user_id uuid)
returns public.plan_type
language plpgsql
security invoker
set search_path = ''
as $$
declare
  effective_plan public.plan_type;
begin
  select coalesce(
    (
      select case purchase_events.product_id
        when 'com.rightful.app.yearly' then 'yearly'::public.plan_type
        when 'com.rightful.app.weekly' then 'weekly'::public.plan_type
      end
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
      limit 1
    ),
    'free'::public.plan_type
  )
  into effective_plan;

  update public.profiles
  set plan = effective_plan
  where user_id = p_user_id;

  return effective_plan;
end;
$$;

revoke all on function private.recompute_subscription_plan(uuid)
  from public, anon, authenticated;
grant execute on function private.recompute_subscription_plan(uuid)
  to service_role;

create or replace function public.record_purchase_event(
  p_transaction_id text,
  p_user_id uuid,
  p_product_id text,
  p_original_transaction_id text,
  p_expires_at timestamptz,
  p_revoked_at timestamptz,
  p_signed_at timestamptz,
  p_signed_transaction_hash text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  insert into private.subscription_owners (
    original_transaction_id,
    user_id
  )
  values (
    p_original_transaction_id,
    p_user_id
  )
  on conflict (original_transaction_id) do nothing;

  select user_id
  into owner_id
  from private.subscription_owners
  where original_transaction_id = p_original_transaction_id;

  if owner_id <> p_user_id then
    return owner_id;
  end if;

  insert into private.purchase_events (
    transaction_id,
    user_id,
    product_id,
    original_transaction_id,
    expires_at,
    revoked_at,
    signed_at,
    signed_transaction_hash
  )
  values (
    p_transaction_id,
    p_user_id,
    p_product_id,
    p_original_transaction_id,
    p_expires_at,
    p_revoked_at,
    p_signed_at,
    p_signed_transaction_hash
  )
  on conflict (transaction_id) do update set
    product_id = excluded.product_id,
    expires_at = excluded.expires_at,
    revoked_at = excluded.revoked_at,
    signed_at = excluded.signed_at,
    signed_transaction_hash = excluded.signed_transaction_hash
  where excluded.signed_at > private.purchase_events.signed_at;

  insert into private.purchase_events (
    transaction_id,
    user_id,
    product_id,
    original_transaction_id,
    expires_at,
    revoked_at,
    signed_at,
    signed_transaction_hash
  )
  select
    pending.transaction_id,
    owner_id,
    pending.product_id,
    pending.original_transaction_id,
    pending.expires_at,
    pending.revoked_at,
    pending.signed_at,
    pending.signed_transaction_hash
  from private.pending_subscription_events as pending
  where pending.original_transaction_id = p_original_transaction_id
  on conflict (transaction_id) do update set
    product_id = excluded.product_id,
    expires_at = excluded.expires_at,
    revoked_at = excluded.revoked_at,
    signed_at = excluded.signed_at,
    signed_transaction_hash = excluded.signed_transaction_hash
  where excluded.signed_at > private.purchase_events.signed_at;

  delete from private.pending_subscription_events
  where original_transaction_id = p_original_transaction_id;

  perform private.recompute_subscription_plan(owner_id);

  return owner_id;
end;
$$;

create or replace function public.claim_notification_delivery(
  p_id text,
  p_user_id uuid,
  p_device_id uuid,
  p_notification_type text,
  p_payload jsonb
)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  claimed boolean;
begin
  insert into private.notification_log (
    id,
    user_id,
    device_id,
    notification_type,
    payload
  )
  values (
    p_id,
    p_user_id,
    p_device_id,
    p_notification_type,
    p_payload
  )
  on conflict (id) do update set
    status = 'claimed',
    attempt_count = private.notification_log.attempt_count + 1,
    attempted_at = now(),
    next_attempt_at = null
  where (
      private.notification_log.status = 'retry'
      and private.notification_log.next_attempt_at <= now()
    )
    or (
      private.notification_log.status = 'claimed'
      and private.notification_log.attempted_at < now() - interval '15 minutes'
    )
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

create or replace function public.claim_pending_notification_deliveries(
  p_limit integer default 100
)
returns table (
  delivery_id text,
  delivery_user_id uuid,
  delivery_device_id uuid,
  delivery_type text,
  delivery_payload jsonb,
  apns_token text,
  apns_environment text
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select notification_log.id
    from private.notification_log as notification_log
    where (
        notification_log.status = 'retry'
        and notification_log.next_attempt_at <= now()
      )
      or (
        notification_log.status = 'claimed'
        and notification_log.attempted_at < now() - interval '15 minutes'
      )
    order by
      notification_log.next_attempt_at asc nulls first,
      notification_log.attempted_at asc
    for update skip locked
    limit greatest(1, least(p_limit, 500))
  ),
  claimed as (
    update private.notification_log as notification_log
    set
      status = 'claimed',
      attempt_count = notification_log.attempt_count + 1,
      attempted_at = now(),
      next_attempt_at = null
    from candidates
    where notification_log.id = candidates.id
    returning
      notification_log.id,
      notification_log.user_id,
      notification_log.device_id,
      notification_log.notification_type,
      notification_log.payload
  )
  select
    claimed.id,
    claimed.user_id,
    claimed.device_id,
    claimed.notification_type,
    claimed.payload,
    devices.apns_token,
    devices.environment
  from claimed
  join public.notification_devices as devices
    on devices.id = claimed.device_id;
end;
$$;

create or replace function public.apply_subscription_status(
  p_notification_uuid uuid,
  p_original_transaction_id text,
  p_transaction_id text,
  p_product_id text,
  p_app_account_token uuid,
  p_expires_at timestamptz,
  p_revoked_at timestamptz,
  p_signed_at timestamptz,
  p_signed_transaction_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  owner_id uuid;
  valid_app_account_token uuid;
begin
  select id
  into valid_app_account_token
  from auth.users
  where id = p_app_account_token;

  insert into private.pending_subscription_events (
    notification_uuid,
    transaction_id,
    original_transaction_id,
    product_id,
    app_account_token,
    expires_at,
    revoked_at,
    signed_at,
    signed_transaction_hash
  )
  values (
    p_notification_uuid,
    p_transaction_id,
    p_original_transaction_id,
    p_product_id,
    valid_app_account_token,
    p_expires_at,
    p_revoked_at,
    p_signed_at,
    p_signed_transaction_hash
  )
  on conflict (notification_uuid) do nothing;

  select user_id
  into owner_id
  from private.subscription_owners
  where original_transaction_id = p_original_transaction_id;

  if owner_id is null
    and valid_app_account_token is not null
  then
    insert into private.subscription_owners (
      original_transaction_id,
      user_id
    )
    values (
      p_original_transaction_id,
      valid_app_account_token
    )
    on conflict (original_transaction_id) do nothing;

    select user_id
    into owner_id
    from private.subscription_owners
    where original_transaction_id = p_original_transaction_id;
  end if;

  if owner_id is null then
    return null;
  end if;

  insert into private.purchase_events (
    transaction_id,
    user_id,
    product_id,
    original_transaction_id,
    expires_at,
    revoked_at,
    signed_at,
    signed_transaction_hash
  )
  values (
    p_transaction_id,
    owner_id,
    p_product_id,
    p_original_transaction_id,
    p_expires_at,
    p_revoked_at,
    p_signed_at,
    p_signed_transaction_hash
  )
  on conflict (transaction_id) do update set
    product_id = excluded.product_id,
    expires_at = excluded.expires_at,
    revoked_at = excluded.revoked_at,
    signed_at = excluded.signed_at,
    signed_transaction_hash = excluded.signed_transaction_hash
  where excluded.signed_at > private.purchase_events.signed_at;

  delete from private.pending_subscription_events
  where notification_uuid = p_notification_uuid;

  perform private.recompute_subscription_plan(owner_id);

  return owner_id;
end;
$$;

create or replace function public.complete_notification_delivery(
  p_id text,
  p_result text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_result = 'retry' then
    update private.notification_log
    set
      status = 'retry',
      next_attempt_at = now() + interval '15 minutes'
    where id = p_id
      and status = 'claimed';
  elsif p_result in ('sent', 'failed') then
    update private.notification_log
    set
      status = p_result,
      sent_at = case when p_result = 'sent' then now() else null end
    where id = p_id
      and status = 'claimed';
  else
    raise exception 'Invalid notification result';
  end if;
end;
$$;

revoke all on function public.record_purchase_event(text, uuid, text, text, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.claim_notification_delivery(text, uuid, uuid, text, jsonb)
  from public, anon, authenticated;
revoke all on function public.claim_pending_notification_deliveries(integer)
  from public, anon, authenticated;
revoke all on function public.apply_subscription_status(uuid, text, text, text, uuid, timestamptz, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(text, text)
  from public, anon, authenticated;

grant execute on function public.record_purchase_event(text, uuid, text, text, timestamptz, timestamptz, timestamptz, text)
  to service_role;
grant execute on function public.claim_notification_delivery(text, uuid, uuid, text, jsonb)
  to service_role;
grant execute on function public.claim_pending_notification_deliveries(integer)
  to service_role;
grant execute on function public.apply_subscription_status(uuid, text, text, text, uuid, timestamptz, timestamptz, timestamptz, text)
  to service_role;
grant execute on function public.complete_notification_delivery(text, text)
  to service_role;

create index settlements_brand_deadline_idx
  on public.settlements (brand_id, deadline)
  where status = 'verified';
create index settlements_deadline_idx
  on public.settlements (deadline)
  where status = 'verified';
create index claims_user_status_idx on public.claims (user_id, status);
create index profile_brands_brand_idx on public.profile_brands (brand_id);
create index notification_devices_user_idx on public.notification_devices (user_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_set_updated_at
before update on public.brands
for each row execute function private.set_updated_at();

create or replace function private.set_settlement_published_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'verified'::public.settlement_status
    and (
      new.published_at is null
      or tg_op = 'INSERT'
      or old.status is distinct from 'verified'::public.settlement_status
    )
  then
    new.published_at = now();
  end if;
  return new;
end;
$$;

create trigger settlements_set_updated_at
before update on public.settlements
for each row execute function private.set_updated_at();

create trigger settlements_set_published_at
before insert or update on public.settlements
for each row execute function private.set_settlement_published_at();

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger claims_set_updated_at
before update on public.claims
for each row execute function private.set_updated_at();

create trigger purchase_events_set_updated_at
before update on private.purchase_events
for each row execute function private.set_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.replace_profile_brands(p_brand_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  delete from public.profile_brands
  where user_id = (select auth.uid());

  insert into public.profile_brands (user_id, brand_id)
  select (select auth.uid()), brand_id
  from unnest(coalesce(p_brand_ids, '{}')) as brand_id;
end;
$$;

revoke all on function public.replace_profile_brands(uuid[]) from public, anon;
grant execute on function public.replace_profile_brands(uuid[]) to authenticated;

create or replace function public.register_notification_device(
  p_apns_token text,
  p_environment text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_environment not in ('sandbox', 'production') then
    raise exception 'Invalid APNs environment';
  end if;

  if p_apns_token !~ '^[0-9A-Fa-f]{32,256}$' then
    raise exception 'Invalid APNs token';
  end if;

  insert into public.notification_devices (
    user_id,
    apns_token,
    environment
  )
  values (
    current_user_id,
    lower(p_apns_token),
    p_environment
  )
  on conflict (apns_token) do update set
    user_id = excluded.user_id,
    environment = excluded.environment,
    last_seen_at = now();

  delete from public.notification_devices
  where id in (
    select id
    from public.notification_devices
    where user_id = current_user_id
    order by last_seen_at desc, id
    offset 10
  );
end;
$$;

revoke all on function public.register_notification_device(text, text)
  from public, anon;
grant execute on function public.register_notification_device(text, text)
  to authenticated;

alter table public.brands enable row level security;
alter table public.settlements enable row level security;
alter table public.profiles enable row level security;
alter table public.profile_brands enable row level security;
alter table public.claims enable row level security;
alter table public.notification_devices enable row level security;

create policy "Public can read brands"
on public.brands for select
to anon, authenticated
using (true);

create policy "Public can read verified settlements"
on public.settlements for select
to anon, authenticated
using (status = 'verified');

create policy "Users can read own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read own brand picks"
on public.profile_brands for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add own brand picks"
on public.profile_brands for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can remove own brand picks"
on public.profile_brands for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can update own brand picks"
on public.profile_brands for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can read own claims"
on public.claims for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can add own claims"
on public.claims for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own claims"
on public.claims for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete own claims"
on public.claims for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can read own devices"
on public.notification_devices for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can delete own devices"
on public.notification_devices for delete
to authenticated
using ((select auth.uid()) = user_id);

revoke all on public.brands, public.settlements from anon, authenticated;
grant select on public.brands, public.settlements to anon, authenticated;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (display_name, state_code, notifications_enabled) on public.profiles to authenticated;

revoke all on public.profile_brands, public.claims, public.notification_devices from anon, authenticated;
grant select, insert, update, delete on public.profile_brands to authenticated;
grant select, insert, update, delete on public.claims to authenticated;
grant select, delete on public.notification_devices to authenticated;

grant select, update on public.profiles to service_role;
grant select on public.profile_brands, public.settlements, public.claims
  to service_role;
grant select, delete on public.notification_devices to service_role;
