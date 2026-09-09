-- ==============================================================
-- Align get_sessions_activity_stats to read strictly from block_records
-- so Timesheets, Dashboard, and Reports all display matching 10-minute block totals
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
  )
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
  GROUP BY br.session_id;
END;
$$;
