-- Separate the ingest delta baseline from the display snapshot.
--
-- Device uploads are cumulative counters; the Hub books usage_events from the
-- difference between consecutive snapshots. That difference needs the *previous
-- cumulative* snapshot, while /api/stats reads the *current display* snapshot.
-- Both lived in device_ingest_state.snapshot_json, which made any operation that
-- rewrites the display snapshot (device data transfer) unable to avoid either
-- double-counting the source device's whole history or freezing its baseline.
--
-- device_ingest_baseline holds the last fully-ingested cumulative snapshot per
-- device. Regular ingest updates it in the same transaction as the display
-- snapshot, so everyday behaviour is byte-identical. The `transferred` flag marks
-- a device whose recorded history was moved to another device: its display
-- snapshot is derived from (previous display + fresh cumulative - baseline),
-- so only post-transfer usage is attributed to it, while the baseline keeps
-- advancing with its raw reports.
--
-- Backfill: an existing database already has correct baselines in
-- device_ingest_state, so each row is seeded from there. A device without a
-- matching row falls back to the display snapshot at read time, matching the
-- pre-baseline behaviour exactly.

CREATE TABLE IF NOT EXISTS device_ingest_baseline (
  device_id VARCHAR(191) NOT NULL,
  snapshot_json JSON NOT NULL,
  transferred TINYINT(1) NOT NULL DEFAULT 0,
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (device_id),
  CONSTRAINT fk_device_ingest_baseline_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO device_ingest_baseline (device_id, snapshot_json, transferred)
  SELECT device_id, snapshot_json, 0 FROM device_ingest_state;
