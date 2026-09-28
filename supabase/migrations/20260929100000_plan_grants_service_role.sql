-- Fix: private.plan_grants was created without any grant to service_role, but
-- private.recompute_subscription_plan (security invoker) reads it. Every call made by the
-- server — razorpay-verify after a payment, and every razorpay-webhook event — failed with
-- "permission denied for table plan_grants", so paid subscriptions were never recorded and
-- Razorpay disabled the webhook after 24 hours of 500s.

grant select on private.plan_grants to service_role;
