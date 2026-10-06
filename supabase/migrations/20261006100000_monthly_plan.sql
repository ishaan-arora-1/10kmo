-- Web monthly plan (Razorpay plan "rightful_monthly", $9.99 a month), added 2026-10-06.
-- Weekly stays in the enum: it's no longer sold, but existing weekly subscriptions still renew.
-- recompute_subscription_plan already ranks yearly first and treats every other plan alike,
-- so it needs no change.

alter type public.plan_type add value if not exists 'monthly' after 'yearly';

-- Funnel events record the plan picked at checkout.
alter table public.funnel_events drop constraint if exists funnel_events_plan_check;
alter table public.funnel_events
  add constraint funnel_events_plan_check
    check (plan is null or plan in ('yearly', 'monthly', 'weekly'));
