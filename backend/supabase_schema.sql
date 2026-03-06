-- =============================================
-- DigiReps Tracker — Supabase Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Sessions: one row per tracking session
CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL,
  project_id  TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Activity samples: keyboard + mouse + app window data
CREATE TABLE IF NOT EXISTS activity_samples (
  id               BIGSERIAL PRIMARY KEY,
  session_id       UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  recorded_at      TIMESTAMPTZ NOT NULL,
  mouse_clicks     INTEGER NOT NULL DEFAULT 0,
  key_presses      INTEGER NOT NULL DEFAULT 0,
  app_name         TEXT,
  window_title     TEXT,
  domain           TEXT,
  idle             BOOLEAN NOT NULL DEFAULT false,
  activity_percent INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Screenshots: metadata pointing to Supabase Storage
CREATE TABLE IF NOT EXISTS screenshots (
  id           BIGSERIAL PRIMARY KEY,
  session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_url     TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_activity_session  ON activity_samples (session_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_screenshots_session ON screenshots (session_id, recorded_at DESC);

-- ── Migrations (run these if the tables already exist) ──
-- v1.1: Add ip_address so Locations page has real per-user IP data
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address TEXT;
-- v1.1: Add ended_at so time calculations use real duration, not sample counts
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;

-- ── Members (real user accounts) ──────────────────────────────────────────────
-- Run once. Links to Supabase Auth via auth_user_id.
CREATE TABLE IF NOT EXISTS members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT UNIQUE NOT NULL,
  full_name        TEXT NOT NULL,
  role             TEXT NOT NULL DEFAULT 'User',  -- Admin | Manager | User | Viewer
  status           TEXT NOT NULL DEFAULT 'Active', -- Active | Inactive
  pay_rate         NUMERIC(10,2),
  bill_rate        NUMERIC(10,2),
  weekly_limit     INTEGER NOT NULL DEFAULT 40,
  daily_limit      INTEGER NOT NULL DEFAULT 8,
  tracking_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Weekly Timesheet Approvals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS timesheet_approvals (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id    UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  week_start   DATE NOT NULL,
  week_end     DATE NOT NULL,
  total_hours  NUMERIC(10,2) NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected
  approved_by  UUID REFERENCES members(id),
  approved_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, week_start)
);

-- ── Projects ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'Active',  -- Active | Archived
  color       TEXT NOT NULL DEFAULT '#3b82f6',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Project ↔ Member assignments ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS project_members (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, member_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_members_member ON project_members(member_id);

-- ── Job Sites ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS job_sites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  address          TEXT NOT NULL,
  radius           INTEGER NOT NULL DEFAULT 150,
  status           TEXT NOT NULL DEFAULT 'Active',
  assigned_members INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Member migrations ─────────────────────────────────────────────────────────
-- v1.2: Add phone column for member onboarding
ALTER TABLE members ADD COLUMN IF NOT EXISTS phone TEXT;
-- v1.2: status now supports 'Pending' (invited but not yet onboarded)
--       status: Active | Inactive | Pending
--       (No schema change needed — column is TEXT, just documenting the new value)

-- ── Storage Bucket ──
-- In Supabase Dashboard → Storage, create a bucket called "screenshots"
-- Set it to private (access via service key only)

-- ── SEED: Insert a test admin (run after creating user in Supabase Auth dashboard) ──
-- Replace the email and auth_user_id with real values after you create the auth user.
-- INSERT INTO members (email, full_name, role, auth_user_id)
-- VALUES ('admin@digireps.app', 'Admin', 'Admin', '<auth-user-uuid>');
