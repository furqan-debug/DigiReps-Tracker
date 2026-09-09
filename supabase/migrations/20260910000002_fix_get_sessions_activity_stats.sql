-- ==============================================================
-- Fix get_sessions_activity_stats to combine block_records and
-- activity_samples per-session rather than all-or-nothing
-- ==============================================================

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
  WITH sessions_input AS (
    SELECT DISTINCT unnest(p_session_ids)::uuid AS sid
  ),
  block_stats AS (
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
    INNER JOIN sessions_input si ON si.sid = br.session_id
    GROUP BY br.session_id
  ),
  sample_stats AS (
    SELECT
      a.session_id,
      COUNT(*)::bigint AS duration_mins,
      COUNT(*)::bigint AS sample_count,
      COALESCE(SUM(a.activity_percent), 0)::numeric AS activity_sum,
      COALESCE(AVG(a.activity_percent), 0)::numeric AS activity_percent,
      MAX(a.recorded_at) AS last_sample_at,
      COUNT(*) FILTER (WHERE a.is_offline = true)::bigint AS offline_count,
      COUNT(*) FILTER (WHERE a.activity_percent > 0)::bigint AS active_count
    FROM public.activity_samples a
    INNER JOIN sessions_input si ON si.sid = a.session_id
    WHERE a.session_id NOT IN (SELECT bs.session_id FROM block_stats bs)
    GROUP BY a.session_id
  )
  SELECT * FROM block_stats
  UNION ALL
  SELECT * FROM sample_stats;
END;
$$;
