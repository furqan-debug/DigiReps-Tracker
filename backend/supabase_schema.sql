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

-- -----------------------------------------------------------------------------
-- Members (real user accounts)
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Weekly Timesheet Approvals
-- -----------------------------------------------------------------------------
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

-- -----------------------------------------------------------------------------
-- Projects
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 TEXT NOT NULL,
  description          TEXT,
  status               TEXT NOT NULL DEFAULT 'Active',  -- Active | Archived
  color                TEXT NOT NULL DEFAULT '#3b82f6',
  client_id            UUID, -- Added for client linking
  billable             BOOLEAN NOT NULL DEFAULT true,
  disable_activity     BOOLEAN NOT NULL DEFAULT false,
  allow_tracking       BOOLEAN NOT NULL DEFAULT true,
  disable_idle_time    BOOLEAN NOT NULL DEFAULT false,
  budget_type          TEXT DEFAULT 'No budget', -- 'No budget' | 'Total hours' | 'Total amount' | 'Monthly hours' | 'Monthly amount'
  budget_limit         NUMERIC(10,2),
  budget_notifications BOOLEAN NOT NULL DEFAULT true,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Clients
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT,
  company     TEXT,
  status      TEXT NOT NULL DEFAULT 'Active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Update projects to reference clients
ALTER TABLE projects ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- To-dos (Tasks)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS todos (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES members(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'Todo', -- 'Todo', 'In Progress', 'Done'
  due_date    DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Project / Member assignments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_members (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, member_id)
);

-- -----------------------------------------------------------------------------
-- Project / Team assignments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_teams (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id     UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, team_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_project_members_member ON project_members(member_id);
CREATE INDEX IF NOT EXISTS idx_project_teams_team ON project_teams(team_id);

-- -----------------------------------------------------------------------------
-- Job Sites
-- -----------------------------------------------------------------------------
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
-- -----------------------------------------------------------------------------
-- Payments
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Pending', -- Pending | Completed | Failed
  method      TEXT NOT NULL,                    -- Bank Transfer | PayPal | Stripe | Crypto
  reference   TEXT,
  paid_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Custom Reports
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS custom_reports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL, -- Time | Financial | Team
  filters     JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Activity Samples v1.2: Add domain/window title tracking
-- -----------------------------------------------------------------------------
-- (Table already has these columns, just ensuring indexes exist for performance)
CREATE INDEX IF NOT EXISTS idx_activity_samples_recorded_at ON activity_samples (recorded_at);
CREATE INDEX IF NOT EXISTS idx_activity_samples_app_name ON activity_samples (app_name);

-- -----------------------------------------------------------------------------
-- Teams
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS teams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  description TEXT,
  manager_id  UUID REFERENCES members(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Team Members
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS team_members (
  team_id   UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_member ON team_members(member_id);

-- -----------------------------------------------------------------------------
-- Invoices
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  amount      NUMERIC(10,2) NOT NULL,
  status      TEXT NOT NULL DEFAULT 'Draft', -- Draft | Sent | Paid | Overdue
  issue_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date    DATE NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- Expenses
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expenses (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  amount      NUMERIC(10,2) NOT NULL,
  category    TEXT NOT NULL,
  description TEXT,
  date        DATE NOT NULL DEFAULT CURRENT_DATE,
  status      TEXT NOT NULL DEFAULT 'Pending', -- Pending | Approved | Rejected
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
