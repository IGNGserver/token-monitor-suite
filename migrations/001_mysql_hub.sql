CREATE TABLE IF NOT EXISTS devices (
  device_id VARCHAR(191) NOT NULL,
  hostname VARCHAR(255) NOT NULL DEFAULT '',
  platform VARCHAR(255) NOT NULL DEFAULT '',
  updated_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL,
  agent_version VARCHAR(255) NOT NULL DEFAULT '',
  agent_runtime VARCHAR(255) NOT NULL DEFAULT '',
  tracked_clients JSON NULL,
  client_status JSON NULL,
  wsl_status JSON NULL,
  projects_enabled BOOLEAN NULL,
  all_time_projects_omitted BOOLEAN NULL,
  all_time_projects_incomplete BOOLEAN NULL,
  sync_upload_interval_ms BIGINT NULL,
  period_windows JSON NULL,
  limits JSON NULL,
  history JSON NULL,
  PRIMARY KEY (device_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS device_ingest_state (
  device_id VARCHAR(191) NOT NULL,
  snapshot_json JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (device_id),
  CONSTRAINT fk_device_ingest_state_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS model_pricing (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  model VARCHAR(255) NOT NULL,
  input_price_per_million DECIMAL(20,8) NOT NULL DEFAULT 0,
  output_price_per_million DECIMAL(20,8) NOT NULL DEFAULT 0,
  cache_read_price_per_million DECIMAL(20,8) NOT NULL DEFAULT 0,
  cache_write_price_per_million DECIMAL(20,8) NOT NULL DEFAULT 0,
  source ENUM('manual', 'tokscale_upstream') NOT NULL,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_model_pricing_model (model)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS usage_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id VARCHAR(191) NULL,
  client VARCHAR(100) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NULL,
  project_id VARCHAR(255) NULL,
  project_label VARCHAR(255) NULL,
  recorded_at DATETIME(3) NOT NULL,
  input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cache_write_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reasoning_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  message_count_delta BIGINT UNSIGNED NOT NULL DEFAULT 0,
  price_input_per_million DECIMAL(20,8) NULL,
  price_output_per_million DECIMAL(20,8) NULL,
  price_cache_read_per_million DECIMAL(20,8) NULL,
  price_cache_write_per_million DECIMAL(20,8) NULL,
  pricing_source VARCHAR(64) NOT NULL,
  pricing_snapshot_at DATETIME(3) NULL,
  cost_usd DECIMAL(24,10) NOT NULL DEFAULT 0,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_usage_events_device_recorded (device_id, recorded_at),
  KEY idx_usage_events_device_session (device_id, session_id),
  KEY idx_usage_events_model (model),
  CONSTRAINT fk_usage_events_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  device_id VARCHAR(191) NOT NULL,
  client VARCHAR(100) NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  total_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  input_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  output_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cache_read_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cache_write_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reasoning_tokens BIGINT UNSIGNED NOT NULL DEFAULT 0,
  message_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  cost_usd DECIMAL(24,10) NOT NULL DEFAULT 0,
  started_at DATETIME(3) NULL,
  last_used_at DATETIME(3) NULL,
  models JSON NOT NULL,
  PRIMARY KEY (device_id, client, session_id),
  KEY idx_sessions_device_last_used (device_id, last_used_at),
  CONSTRAINT fk_sessions_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
