-- Turns on the three-claim free trial (see 20261020100000_limited_trial.sql) now that the
-- website explaining it is live: trials started from here on are limited. Earlier trials keep
-- full access.
alter table private.paddle_subscriptions alter column limited_trial set default true;
