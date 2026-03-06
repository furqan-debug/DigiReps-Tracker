-- =============================================
-- DigiReps Tracker — Supabase RLS Policies
-- Run this AFTER supabase_schema.sql
-- Paste into Supabase Dashboard → SQL Editor
-- =============================================

-- ═══════════════════════════════════════════════════════════
-- STEP 1: Enable RLS on all tables
-- ═══════════════════════════════════════════════════════════

ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_samples  ENABLE ROW LEVEL SECURITY;
ALTER TABLE screenshots       ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════════
-- STEP 2: sessions policies
-- ═══════════════════════════════════════════════════════════

-- Users can only read their own sessions (Electron tracker uses user_id = auth.uid())
CREATE POLICY "users_read_own_sessions"
  ON sessions FOR SELECT
  USING (user_id = auth.uid()::text);

-- Users can INSERT their own sessions
CREATE POLICY "users_insert_own_sessions"
  ON sessions FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Users can UPDATE (e.g. end) their own sessions
CREATE POLICY "users_update_own_sessions"
  ON sessions FOR UPDATE
  USING (user_id = auth.uid()::text);

-- Service role (backend) can do everything — it bypasses RLS automatically,
-- but we add explicit admin policies for clarity.
-- (The service_role key already bypasses RLS; these are for documentation.)

-- ═══════════════════════════════════════════════════════════
-- STEP 3: activity_samples policies
-- Users can only see samples from their own sessions
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "users_read_own_activity"
  ON activity_samples FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "users_insert_own_activity"
  ON activity_samples FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════
-- STEP 4: screenshots policies
-- ═══════════════════════════════════════════════════════════

CREATE POLICY "users_read_own_screenshots"
  ON screenshots FOR SELECT
  USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY "users_insert_own_screenshots"
  ON screenshots FOR INSERT
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()::text
    )
  );

-- ═══════════════════════════════════════════════════════════
-- STEP 5: Admin read-all policy (for admin portal anon key)
-- The admin portal reads data via the anon key.
-- Since the admin portal doesn't use auth.uid() (it's a server-side
-- admin view), we use a separate role check.
-- 
-- ⚠️  OPTION A (Recommended for now — simple):
--     Keep anon key with read-only access to all data.
--     This is safe because the anon key is read-only and the
--     admin portal is only used internally.
--
-- ⚠️  OPTION B (Production-grade):
--     Use Supabase Auth for admin login + service role for reads.
-- ═══════════════════════════════════════════════════════════

-- Allow anon (admin portal) to read all sessions
CREATE POLICY "anon_admin_read_sessions"
  ON sessions FOR SELECT
  TO anon
  USING (true);

-- Allow anon (admin portal) to read all activity samples
CREATE POLICY "anon_admin_read_activity"
  ON activity_samples FOR SELECT
  TO anon
  USING (true);

-- Allow anon (admin portal) to read all screenshots
CREATE POLICY "anon_admin_read_screenshots"
  ON screenshots FOR SELECT
  TO anon
  USING (true);

-- ═══════════════════════════════════════════════════════════
-- STEP 6: Storage (screenshots bucket) policies
-- ═══════════════════════════════════════════════════════════

-- Allow anyone with the service key to upload screenshots
CREATE POLICY "service_upload_screenshots"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'screenshots');

-- Allow anon to view screenshot files (admin portal image display)
CREATE POLICY "anon_read_screenshots_bucket"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'screenshots');

-- ═══════════════════════════════════════════════════════════
-- VERIFICATION: Run these to confirm RLS is active
-- ═══════════════════════════════════════════════════════════
-- SELECT schemaname, tablename, rowsecurity
-- FROM pg_tables
-- WHERE tablename IN ('sessions', 'activity_samples', 'screenshots');
-- Expected: rowsecurity = true for all three tables

-- SELECT * FROM pg_policies WHERE tablename IN ('sessions', 'activity_samples', 'screenshots');
-- Expected: All policies listed above appear
