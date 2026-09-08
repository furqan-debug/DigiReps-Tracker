-- =============================================================================
-- STEP 1 — Persist raw active seconds per sample
--
-- Why: activity is currently stored only as a rounded integer percentage, and
-- minutes containing mouse movement but no clicks/keypresses were force-zeroed
-- before being written. That means the raw signal is lost at write time and no
-- later change of definition can be applied retroactively.
--
-- Storing the raw count fixes that permanently: from here on, "what counts as
-- activity" becomes a question the server can re-answer over historical data
-- instead of a decision baked irreversibly into the desktop client.
--
-- NULLABLE ON PURPOSE. NULL means "this row predates Step 1, the real value is
-- unknown". It must not default to 0 — 0 would assert the minute had no
-- activity, which for movement-only minutes is exactly the false claim this
-- change exists to stop making. Consumers must treat NULL as unknown and fall
-- back to activity_percent.
-- =============================================================================

ALTER TABLE activity_samples
  ADD COLUMN IF NOT EXISTS active_seconds SMALLINT;

COMMENT ON COLUMN activity_samples.active_seconds IS
  'Distinct seconds within the sample window that saw any input (keyboard, mouse click, mouse movement or scroll). 0-60 for a 60s window. NULL for rows written before Step 1, where the value was never captured.';
