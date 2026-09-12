CREATE TABLE IF NOT EXISTS hub_accounts (
  account_id VARCHAR(128) NOT NULL,
  provider VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  label VARCHAR(256) NOT NULL DEFAULT '',
  account_key VARCHAR(255) NOT NULL DEFAULT '',
  account_email VARCHAR(254) NOT NULL DEFAULT '',
  account_label VARCHAR(256) NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status VARCHAR(32) NOT NULL DEFAULT 'pending',
  last_error_code VARCHAR(128) NOT NULL DEFAULT '',
  last_error_message VARCHAR(512) NOT NULL DEFAULT '',
  last_attempt_at DATETIME(3) NULL,
  last_success_at DATETIME(3) NULL,
  next_refresh_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (account_id),
  KEY idx_hub_accounts_provider_key (provider, account_key, account_email),
  KEY idx_hub_accounts_provider_status (provider, status, enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS hub_account_credentials (
  account_id VARCHAR(128) NOT NULL,
  credential_envelope JSON NOT NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (account_id),
  CONSTRAINT fk_hub_account_credentials_account FOREIGN KEY (account_id) REFERENCES hub_accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS hub_account_limits (
  account_id VARCHAR(128) NOT NULL,
  provider_snapshot JSON NULL,
  last_good_snapshot JSON NULL,
  updated_at DATETIME(3) NOT NULL,
  PRIMARY KEY (account_id),
  CONSTRAINT fk_hub_account_limits_account FOREIGN KEY (account_id) REFERENCES hub_accounts(account_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS hub_account_audit (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  account_id VARCHAR(128) NULL,
  action VARCHAR(64) NOT NULL,
  actor VARCHAR(255) NOT NULL DEFAULT '',
  details JSON NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_hub_account_audit_account_created (account_id, created_at),
  CONSTRAINT fk_hub_account_audit_account FOREIGN KEY (account_id) REFERENCES hub_accounts(account_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
