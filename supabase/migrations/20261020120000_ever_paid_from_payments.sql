-- "Paid before" comes from real payments (2026-10-20). When a trial ends, Paddle first sends the
-- subscription as 'active' and only then charges the card, so treating 'active' as paid let two
-- trials whose $39.99 charge failed keep a year of access (past_due + ever_paid). The functions
-- now ask Paddle whether the subscription has a paid transaction above $0 and pass that in
-- p_paid; ever_paid only turns true from that. Null means unknown and leaves it as it is.
-- (Access while 'active' or 'trialing' is unchanged; ever_paid only matters once past_due.)

drop function public.upsert_paddle_subscription(
  text, uuid, text, text, public.plan_type, text, timestamptz, boolean, timestamptz
);

create function public.upsert_paddle_subscription(
  p_subscription_id text,
  p_user_id uuid,
  p_customer_id text,
  p_price_id text,
  p_plan public.plan_type,
  p_status text,
  p_current_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_occurred_at timestamptz,
  p_paid boolean default null
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
    p_current_period_end, coalesce(p_cancel_at_period_end, false), p_occurred_at, coalesce(p_paid, false)
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

revoke all on function public.upsert_paddle_subscription(
  text, uuid, text, text, public.plan_type, text, timestamptz, boolean, timestamptz, boolean
) from public, anon, authenticated;
grant execute on function public.upsert_paddle_subscription(
  text, uuid, text, text, public.plan_type, text, timestamptz, boolean, timestamptz, boolean
) to service_role;

-- Checked against Paddle on 2026-10-20: these two trials' $39.99 charges failed (no paid
-- transaction), so they were never paid. Every other subscription marked paid has a payment.
update private.paddle_subscriptions
set ever_paid = false
where subscription_id in ('sub_01m58x85npdef5gfk9c402x0py', 'sub_01m59819gsxd4dm7jhpxpjgras');

select private.recompute_subscription_plan(user_id)
from private.paddle_subscriptions
where subscription_id in ('sub_01m58x85npdef5gfk9c402x0py', 'sub_01m59819gsxd4dm7jhpxpjgras');
