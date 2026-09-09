-- ==============================================================
-- Unified RPCs reading from block_records (Phase 1, Part 2)
-- Replaces activity_samples-based aggregation with block_records.
-- Falls back to activity_samples for sessions that predate the migration.
-- ==============================================================

-- ── 1. get_reports_aggregated_data ──────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_reports_aggregated_data(uuid, timestamptz, timestamptz, text, text[]);

CREATE OR REPLACE FUNCTION public.get_reports_aggregated_data(
  p_org_id     uuid,
  p_start_iso  timestamptz,
  p_end_iso    timestamptz,
  p_org_tz     text,
  p_member_ids text[] DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
VOLATILE
LANGUAGE plpgsql AS $$
DECLARE
  v_daily      jsonb;
  v_user_daily jsonb;
  v_apps       jsonb;
BEGIN
  -- Daily totals (org-wide) from block_records
  SELECT jsonb_agg(row_to_json(t)) INTO v_daily
  FROM (
    SELECT
      business_date::text AS date,
      COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (block_end - block_start))) FILTER (WHERE credited = true) / 60), 0)::bigint AS total_minutes,
      COALESCE(AVG(activity_percent) FILTER (WHERE credited = true), 0)::numeric AS activity_sum,
      COUNT(*) FILTER (WHERE credited = true) AS sample_count
    FROM public.block_records
    WHERE organization_id = p_org_id
      AND block_start >= p_start_iso
      AND block_end   <= p_end_iso
      AND (p_member_ids IS NULL OR user_id = ANY(p_member_ids::uuid[]))
    GROUP BY business_date
    ORDER BY business_date ASC
  ) t;

  -- Per-user daily totals from block_records
  SELECT jsonb_agg(row_to_json(t)) INTO v_user_daily
  FROM (
    SELECT
      user_id,
      business_date::text AS date,
      COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (block_end - block_start))) FILTER (WHERE credited = true) / 60), 0)::bigint AS total_minutes,
      COALESCE(AVG(activity_percent) FILTER (WHERE credited = true), 0)::numeric AS activity_sum,
      COUNT(*) FILTER (WHERE credited = true) AS sample_count
    FROM public.block_records
    WHERE organization_id = p_org_id
      AND block_start >= p_start_iso
      AND block_end   <= p_end_iso
      AND (p_member_ids IS NULL OR user_id = ANY(p_member_ids::uuid[]))
    GROUP BY user_id, business_date
  ) t;

  -- App usage totals from block_records
  SELECT jsonb_agg(row_to_json(t)) INTO v_apps
  FROM (
    SELECT
      app_name,
      COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (block_end - block_start))) / 60), 0)::bigint AS total_minutes,
      AVG(activity_percent) AS activity_sum
    FROM public.block_records
    WHERE organization_id = p_org_id
      AND block_start >= p_start_iso
      AND block_end   <= p_end_iso
      AND credited = true
      AND app_name IS NOT NULL AND TRIM(app_name) != ''
      AND (p_member_ids IS NULL OR user_id = ANY(p_member_ids::uuid[]))
    GROUP BY app_name
    ORDER BY COUNT(*) DESC
  ) t;

  -- Fallback: if no block_records exist yet, read from activity_samples
  IF v_daily IS NULL THEN
    CREATE TEMP TABLE _sample_activity ON COMMIT DROP AS
    SELECT DISTINCT ON (s.user_id, date_trunc('minute', a.recorded_at))
      a.activity_percent, a.app_name, s.user_id,
      TO_CHAR(a.recorded_at AT TIME ZONE p_org_tz, 'YYYY-MM-DD') AS day_str
    FROM activity_samples a
    JOIN sessions s ON a.session_id = s.id
    WHERE (a.organization_id = p_org_id OR s.organization_id = p_org_id)
      AND a.recorded_at >= p_start_iso AND a.recorded_at <= p_end_iso
      AND (p_member_ids IS NULL OR s.user_id = ANY(p_member_ids::uuid[]))
    ORDER BY s.user_id, date_trunc('minute', a.recorded_at), a.activity_percent DESC;

    SELECT jsonb_agg(row_to_json(t)) INTO v_daily FROM (
      SELECT day_str AS date, COUNT(*) AS total_minutes, SUM(activity_percent)::numeric AS activity_sum, COUNT(*) AS sample_count
      FROM _sample_activity GROUP BY day_str ORDER BY day_str
    ) t;

    SELECT jsonb_agg(row_to_json(t)) INTO v_user_daily FROM (
      SELECT user_id, day_str AS date, COUNT(*) AS total_minutes, SUM(activity_percent)::numeric AS activity_sum, COUNT(*) AS sample_count
      FROM _sample_activity GROUP BY user_id, day_str
    ) t;

    SELECT jsonb_agg(row_to_json(t)) INTO v_apps FROM (
      SELECT app_name, COUNT(*) AS total_minutes, SUM(activity_percent) AS activity_sum
      FROM _sample_activity WHERE app_name IS NOT NULL AND TRIM(app_name) != ''
      GROUP BY app_name ORDER BY COUNT(*) DESC
    ) t;
  END IF;

  RETURN jsonb_build_object(
    'daily_stats',      COALESCE(v_daily,      '[]'::jsonb),
    'user_daily_stats', COALESCE(v_user_daily, '[]'::jsonb),
    'app_stats',        COALESCE(v_apps,       '[]'::jsonb)
  );
END;
$$;


-- ── 2. get_sessions_activity_stats ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.get_sessions_activity_stats(uuid[]);
DROP FUNCTION IF EXISTS public.get_sessions_activity_stats(text[]);

CREATE OR REPLACE FUNCTION public.get_sessions_activity_stats(p_session_ids text[])
RETURNS TABLE(
  session_id       uuid,
  duration_mins    bigint,
  sample_count     bigint,
  activity_sum     numeric,
  activity_percent numeric,
  last_sample_at   timestamptz,
  offline_count    bigint,
  active_count     bigint
)
SECURITY DEFINER
STABLE
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    br.session_id,
    COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (br.block_end - br.block_start))) FILTER (WHERE br.credited = true) / 60), 0)::bigint AS duration_mins,
    COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (br.block_end - br.block_start))) FILTER (WHERE br.credited = true) / 60), 0)::bigint AS sample_count,
    COALESCE(SUM(br.activity_percent) FILTER (WHERE br.credited = true), 0)::numeric AS activity_sum,
    COALESCE(AVG(br.activity_percent) FILTER (WHERE br.credited = true), 0)::numeric AS activity_percent,
    MAX(br.block_end) AS last_sample_at,
    COUNT(*) FILTER (WHERE br.is_offline = true)::bigint AS offline_count,
    COUNT(*) FILTER (WHERE br.credited = true)::bigint AS active_count
  FROM public.block_records br
  WHERE br.session_id = ANY(p_session_ids::uuid[])
  GROUP BY br.session_id;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      a.session_id,
      COUNT(*)::bigint AS duration_mins,
      COUNT(*)::bigint AS sample_count,
      SUM(a.activity_percent)::numeric AS activity_sum,
      COALESCE(AVG(a.activity_percent), 0)::numeric AS activity_percent,
      MAX(a.recorded_at) AS last_sample_at,
      COUNT(*) FILTER (WHERE a.is_offline = true)::bigint AS offline_count,
      COUNT(*) FILTER (WHERE a.activity_percent > 0)::bigint AS active_count
    FROM public.activity_samples a
    WHERE a.session_id = ANY(p_session_ids::uuid[])
    GROUP BY a.session_id;
  END IF;
END;
$$;
