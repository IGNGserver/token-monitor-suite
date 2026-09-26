-- Persist the provider credit meter in the append-only usage ledger.
--
-- `usage_events` is what answers /api/usage/range once the rolling daily history
-- no longer covers the requested window, so a measurement that exists only on the
-- live device period is invisible to every custom range. Qoder bills in credits
-- rather than tokens and publishes an exact per-request figure for them, which
-- makes it the first measurement with no USD cost to stand in for it.
--
-- The column lives on the (client, session, model) event row because that is the
-- grain the adapter already attributes: a Qoder transcript row carries its own
-- session, model and credit before it reaches the hub, so no client total has to
-- be split across rows it cannot attribute.
--
-- Restart-safe and idempotent: MySQL offers no conditional ADD COLUMN, so the
-- guard goes through information_schema and a prepared statement, matching
-- 003_device_soft_delete.sql. An existing database keeps its history and simply
-- reports no credits for events written before this ran — which is accurate, not
-- a gap to backfill.

SET @token_monitor_usage_events_credits_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usage_events'
    AND COLUMN_NAME = 'credits'
);
SET @token_monitor_add_usage_events_credits = IF(
  @token_monitor_usage_events_credits_exists = 0,
  'ALTER TABLE `usage_events` ADD COLUMN `credits` DECIMAL(24,10) NOT NULL DEFAULT 0 AFTER `cost_usd`',
  'SELECT 1'
);
PREPARE token_monitor_usage_events_credits FROM @token_monitor_add_usage_events_credits;
EXECUTE token_monitor_usage_events_credits;
DEALLOCATE PREPARE token_monitor_usage_events_credits;
