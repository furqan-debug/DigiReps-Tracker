-- ==============================================================
-- Unified Time Tracking Architecture — Phase 1
-- Creates block_records: the single source of truth for all time
-- calculations across Desktop App, Timesheets, and Reports.
-- ==============================================================

CREATE TABLE IF NOT EXISTS public.block_records (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid        NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  organization_id  uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL,
  business_date    date        NOT NULL,
  block_start      timestamptz NOT NULL,
  block_end        timestamptz NOT NULL,
  active_seconds   integer     NOT NULL DEFAULT 0,
  activity_percent integer     NOT NULL DEFAULT 0,
  is_productive    boolean     NOT NULL DEFAULT false,
  credited         boolean     NOT NULL DEFAULT true,
  mouse_clicks     integer     NOT NULL DEFAULT 0,
  key_presses      integer     NOT NULL DEFAULT 0,
  app_name         text,
  domain           text,
  is_offline       boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_block_records_user_date ON public.block_records (user_id, business_date, credited);
CREATE INDEX IF NOT EXISTS idx_block_records_org_date ON public.block_records (organization_id, business_date, credited);
CREATE INDEX IF NOT EXISTS idx_block_records_session ON public.block_records (session_id);
CREATE INDEX IF NOT EXISTS idx_block_records_block_start ON public.block_records (block_start);

ALTER TABLE public.block_records DROP CONSTRAINT IF EXISTS uq_block_records_session_start;
ALTER TABLE public.block_records ADD CONSTRAINT uq_block_records_session_start UNIQUE (session_id, block_start);

ALTER TABLE public.block_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_block_records" ON public.block_records;
CREATE POLICY "service_role_all_block_records" ON public.block_records FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "org_read_block_records" ON public.block_records;
CREATE POLICY "org_read_block_records" ON public.block_records FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "member_insert_block_records" ON public.block_records;
CREATE POLICY "member_insert_block_records" ON public.block_records FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "member_update_credited" ON public.block_records;
CREATE POLICY "member_update_credited" ON public.block_records FOR UPDATE TO authenticated, anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.trg_block_records_set_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL OR NEW.user_id IS NULL THEN
    SELECT organization_id, user_id INTO NEW.organization_id, NEW.user_id FROM public.sessions WHERE id = NEW.session_id;
  END IF;
  IF NEW.organization_id IS NULL THEN RETURN NULL; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_block_records_set_org ON public.block_records;
CREATE TRIGGER trg_block_records_set_org BEFORE INSERT ON public.block_records FOR EACH ROW EXECUTE FUNCTION public.trg_block_records_set_org();
