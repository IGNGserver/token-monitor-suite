-- Lead the usage_events range scan with recorded_at.
--
-- Every /api/usage/range ledger query filters on recorded_at alone
-- (repository.aggregateUsageRange: WHERE recorded_at >= ? AND recorded_at < ?),
-- plus a GROUP BY client, model. The only range-bearing index was
-- idx_usage_events_device_recorded (device_id, recorded_at), whose leading column
-- is not in the predicate, so the planner fell back to a full scan (and a temp
-- table for the GROUP BY) over an append-only table that grows with the fleet.
--
-- Idempotent so the migration can be re-run safely on an existing database.

SET @token_monitor_recorded_idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usage_events'
    AND INDEX_NAME = 'idx_usage_events_recorded'
);
SET @token_monitor_add_recorded_idx = IF(
  @token_monitor_recorded_idx_exists = 0,
  'ALTER TABLE `usage_events` ADD INDEX `idx_usage_events_recorded` (`recorded_at`)',
  'SELECT 1'
);
PREPARE token_monitor_usage_events_recorded FROM @token_monitor_add_recorded_idx;
EXECUTE token_monitor_usage_events_recorded;
DEALLOCATE PREPARE token_monitor_usage_events_recorded;

-- Cover the range GROUP BY so the aggregate can be answered from the index.
SET @token_monitor_recorded_group_idx_exists = (
  SELECT COUNT(*)
  FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'usage_events'
    AND INDEX_NAME = 'idx_usage_events_recorded_client_model'
);
SET @token_monitor_add_recorded_group_idx = IF(
  @token_monitor_recorded_group_idx_exists = 0,
  'ALTER TABLE `usage_events` ADD INDEX `idx_usage_events_recorded_client_model` (`recorded_at`, `client`, `model`)',
  'SELECT 1'
);
PREPARE token_monitor_usage_events_recorded_group FROM @token_monitor_add_recorded_group_idx;
EXECUTE token_monitor_usage_events_recorded_group;
DEALLOCATE PREPARE token_monitor_usage_events_recorded_group;
