SET @token_monitor_deleted_at_exists = (
  SELECT COUNT(*)
  FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'devices'
    AND COLUMN_NAME = 'deleted_at'
);
SET @token_monitor_add_deleted_at = IF(
  @token_monitor_deleted_at_exists = 0,
  'ALTER TABLE `devices` ADD COLUMN `deleted_at` DATETIME(3) NULL',
  'SELECT 1'
);
PREPARE token_monitor_device_soft_delete FROM @token_monitor_add_deleted_at;
EXECUTE token_monitor_device_soft_delete;
DEALLOCATE PREPARE token_monitor_device_soft_delete;
