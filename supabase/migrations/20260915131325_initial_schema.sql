create extension if not exists pgcrypto;

create schema if not exists private;
revoke all on schema private from anon, authenticated;

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
  apns_token text not null,
  environment text not null check (environment in ('sandbox', 'production')),
  last_seen_at timestamptz not null default now(),
  unique (user_id, apns_token)
);

create table private.purchase_events (
  transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id text not null,
  original_transaction_id text not null,
  expires_at timestamptz,
  revoked_at timestamptz,
  signed_transaction_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table private.subscription_owners (
  original_transaction_id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table private.notification_log (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  payload jsonb not null,
  sent_at timestamptz not null default now()
);

create index notification_log_user_sent_idx
  on private.notification_log (user_id, sent_at desc);

grant usage on schema private to service_role;
grant select, insert, update on private.purchase_events to service_role;
grant select, insert on private.subscription_owners to service_role;
grant select, insert on private.notification_log to service_role;

create or replace function public.record_purchase_event(
  p_transaction_id text,
  p_user_id uuid,
  p_product_id text,
  p_original_transaction_id text,
  p_expires_at timestamptz,
  p_revoked_at timestamptz,
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
    signed_transaction_hash
  )
  values (
    p_transaction_id,
    p_user_id,
    p_product_id,
    p_original_transaction_id,
    p_expires_at,
    p_revoked_at,
    p_signed_transaction_hash
  )
  on conflict (transaction_id) do nothing;

  return owner_id;
end;
$$;

create or replace function public.existing_notification_ids(p_ids text[])
returns table (id text)
language sql
security invoker
set search_path = ''
as $$
  select notification_log.id
  from private.notification_log
  where notification_log.id = any (p_ids);
$$;

create or replace function public.apply_subscription_status(
  p_original_transaction_id text,
  p_transaction_id text,
  p_product_id text,
  p_expires_at timestamptz,
  p_revoked_at timestamptz,
  p_signed_transaction_hash text,
  p_plan public.plan_type,
  p_is_active boolean
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  owner_id uuid;
begin
  select user_id
  into owner_id
  from private.subscription_owners
  where original_transaction_id = p_original_transaction_id;

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
    signed_transaction_hash
  )
  values (
    p_transaction_id,
    owner_id,
    p_product_id,
    p_original_transaction_id,
    p_expires_at,
    p_revoked_at,
    p_signed_transaction_hash
  )
  on conflict (transaction_id) do update set
    expires_at = excluded.expires_at,
    revoked_at = excluded.revoked_at,
    signed_transaction_hash = excluded.signed_transaction_hash;

  update public.profiles
  set plan = case when p_is_active then p_plan else 'free'::public.plan_type end
  where user_id = owner_id;

  return owner_id;
end;
$$;

create or replace function public.record_notification_sent(
  p_id text,
  p_user_id uuid,
  p_notification_type text,
  p_payload jsonb
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into private.notification_log (
    id,
    user_id,
    notification_type,
    payload
  )
  values (
    p_id,
    p_user_id,
    p_notification_type,
    p_payload
  )
  on conflict (id) do nothing;
$$;

revoke all on function public.record_purchase_event(text, uuid, text, text, timestamptz, timestamptz, text)
  from public, anon, authenticated;
revoke all on function public.existing_notification_ids(text[])
  from public, anon, authenticated;
revoke all on function public.apply_subscription_status(text, text, text, timestamptz, timestamptz, text, public.plan_type, boolean)
  from public, anon, authenticated;
revoke all on function public.record_notification_sent(text, uuid, text, jsonb)
  from public, anon, authenticated;

grant execute on function public.record_purchase_event(text, uuid, text, text, timestamptz, timestamptz, text)
  to service_role;
grant execute on function public.existing_notification_ids(text[])
  to service_role;
grant execute on function public.apply_subscription_status(text, text, text, timestamptz, timestamptz, text, public.plan_type, boolean)
  to service_role;
grant execute on function public.record_notification_sent(text, uuid, text, jsonb)
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

create trigger settlements_set_updated_at
before update on public.settlements
for each row execute function private.set_updated_at();

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

create policy "Users can add own devices"
on public.notification_devices for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update own devices"
on public.notification_devices for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

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
grant select, insert, update, delete on public.notification_devices to authenticated;
