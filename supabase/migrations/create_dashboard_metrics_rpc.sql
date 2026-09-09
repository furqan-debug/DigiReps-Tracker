-- ==============================================================
-- Updated get_dashboard_metrics to read from block_records
-- ==============================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_metrics(
  p_org_id uuid,
  p_start_iso timestamptz,
  p_end_iso timestamptz,
  p_prev_start_iso timestamptz,
  p_prev_end_iso timestamptz,
  p_member_ids text[] DEFAULT NULL,
  p_project_ids text[] DEFAULT NULL
)
RETURNS jsonb
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_mins int := 0;
  v_activity_sum bigint := 0;
  v_activity_count int := 0;
  v_prev_total_mins int := 0;
  v_prev_activity_sum bigint := 0;
  v_prev_activity_count int := 0;
  
  v_app_usage jsonb;
  v_proj_stats jsonb;
  v_user_stats jsonb;
  v_user_screenshots jsonb;
  v_daily_stats jsonb;
  v_screenshot_count int := 0;
  v_projects_worked int := 0;
  v_active_members int := 0;
  v_has_blocks boolean := false;
BEGIN
  -- Check if block_records exist for this period
  SELECT EXISTS (
    SELECT 1 FROM public.block_records br
    WHERE br.organization_id = p_org_id
      AND br.block_start >= p_start_iso
      AND br.block_end <= p_end_iso
  ) INTO v_has_blocks;

  -- 1. Total screenshot count
  SELECT COUNT(*)
  INTO v_screenshot_count
  FROM screenshots ss
  JOIN sessions s ON ss.session_id = s.id
  WHERE ss.organization_id = p_org_id
    AND ss.recorded_at >= p_start_iso 
    AND ss.recorded_at <= p_end_iso
    AND (
      (p_member_ids IS NULL AND p_project_ids IS NULL)
      OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
      OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
    );

  IF v_has_blocks THEN
    -- Read from block_records (single source of truth)
    SELECT 
      COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (br.block_end - br.block_start))) FILTER (WHERE br.credited = true) / 60), 0)::int,
      COALESCE(SUM(br.activity_percent) FILTER (WHERE br.credited = true), 0)::bigint,
      COALESCE(COUNT(*) FILTER (WHERE br.credited = true), 0)::int,
      COUNT(DISTINCT s.project_id),
      COUNT(DISTINCT br.user_id)
    INTO 
      v_total_mins, 
      v_activity_sum,
      v_activity_count,
      v_projects_worked,
      v_active_members
    FROM public.block_records br
    JOIN sessions s ON br.session_id = s.id
    WHERE br.organization_id = p_org_id
      AND br.block_start >= p_start_iso 
      AND br.block_end <= p_end_iso
      AND (
        (p_member_ids IS NULL AND p_project_ids IS NULL)
        OR (p_member_ids IS NOT NULL AND br.user_id = ANY(p_member_ids::uuid[]))
        OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
      );

    -- Prev period from block_records
    SELECT 
      COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (br.block_end - br.block_start))) FILTER (WHERE br.credited = true) / 60), 0)::int,
      COALESCE(SUM(br.activity_percent) FILTER (WHERE br.credited = true), 0)::bigint,
      COALESCE(COUNT(*) FILTER (WHERE br.credited = true), 0)::int
    INTO 
      v_prev_total_mins, 
      v_prev_activity_sum,
      v_prev_activity_count
    FROM public.block_records br
    JOIN sessions s ON br.session_id = s.id
    WHERE br.organization_id = p_org_id
      AND br.block_start >= p_prev_start_iso 
      AND br.block_end <= p_prev_end_iso
      AND (
        (p_member_ids IS NULL AND p_project_ids IS NULL)
        OR (p_member_ids IS NOT NULL AND br.user_id = ANY(p_member_ids::uuid[]))
        OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
      );

    -- Top Apps usage from block_records
    SELECT jsonb_object_agg(COALESCE(app_name, 'Unknown'), cnt)
    INTO v_app_usage
    FROM (
      SELECT br.app_name, COUNT(*) as cnt
      FROM public.block_records br
      JOIN sessions s ON br.session_id = s.id
      WHERE br.organization_id = p_org_id
        AND br.block_start >= p_start_iso 
        AND br.block_end <= p_end_iso
        AND br.credited = true
        AND br.app_name IS NOT NULL
        AND TRIM(br.app_name) != ''
        AND LOWER(br.app_name) != 'program manager'
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND br.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY br.app_name
      ORDER BY cnt DESC
      LIMIT 20
    ) t;

    -- User stats from block_records
    SELECT COALESCE(jsonb_object_agg(user_id::text, json_build_object('mins', mins, 'activity_sum', act_sum, 'cnt', cnt)), '{}'::jsonb)
    INTO v_user_stats
    FROM (
      SELECT 
        br.user_id, 
        COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (br.block_end - br.block_start))) FILTER (WHERE br.credited = true) / 60), 0)::int as mins, 
        COALESCE(SUM(br.activity_percent) FILTER (WHERE br.credited = true), 0) as act_sum,
        COUNT(*) FILTER (WHERE br.credited = true) as cnt
      FROM public.block_records br
      JOIN sessions s ON br.session_id = s.id
      WHERE br.organization_id = p_org_id
        AND br.block_start >= p_start_iso 
        AND br.block_end <= p_end_iso
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND br.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY br.user_id
    ) t;

    -- Project stats from block_records
    SELECT COALESCE(jsonb_object_agg(project_id::text, json_build_object('mins', mins, 'activity_sum', act_sum, 'cnt', cnt)), '{}'::jsonb)
    INTO v_proj_stats
    FROM (
      SELECT 
        s.project_id, 
        COALESCE(ROUND(SUM(EXTRACT(EPOCH FROM (br.block_end - br.block_start))) FILTER (WHERE br.credited = true) / 60), 0)::int as mins, 
        COALESCE(SUM(br.activity_percent) FILTER (WHERE br.credited = true), 0) as act_sum,
        COUNT(*) FILTER (WHERE br.credited = true) as cnt
      FROM public.block_records br
      JOIN sessions s ON br.session_id = s.id
      WHERE br.organization_id = p_org_id
        AND br.block_start >= p_start_iso 
        AND br.block_end <= p_end_iso
        AND s.project_id IS NOT NULL
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND br.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY s.project_id
    ) t;

    -- Daily stats from block_records
    SELECT COALESCE(jsonb_object_agg(day_name, cnt), '{}'::jsonb)
    INTO v_daily_stats
    FROM (
      SELECT 
        TO_CHAR(br.block_start AT TIME ZONE 'UTC', 'Dy') as day_name, 
        COUNT(*) as cnt
      FROM public.block_records br
      JOIN sessions s ON br.session_id = s.id
      WHERE br.organization_id = p_org_id
        AND br.block_start >= p_start_iso 
        AND br.block_end <= p_end_iso
        AND br.credited = true
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND br.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY TO_CHAR(br.block_start AT TIME ZONE 'UTC', 'Dy')
    ) t;

  ELSE
    -- Fallback to activity_samples for historical periods
    SELECT 
      COUNT(*), 
      COALESCE(SUM(activity_percent), 0),
      COUNT(DISTINCT s.project_id),
      COUNT(DISTINCT s.user_id)
    INTO 
      v_total_mins, 
      v_activity_sum,
      v_projects_worked,
      v_active_members
    FROM activity_samples a
    JOIN sessions s ON a.session_id = s.id
    WHERE a.organization_id = p_org_id
      AND a.recorded_at >= p_start_iso 
      AND a.recorded_at <= p_end_iso
      AND (
        (p_member_ids IS NULL AND p_project_ids IS NULL)
        OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
        OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
      );
      
    v_activity_count := v_total_mins;

    SELECT 
      COUNT(*), 
      COALESCE(SUM(activity_percent), 0)
    INTO 
      v_prev_total_mins, 
      v_prev_activity_sum
    FROM activity_samples a
    JOIN sessions s ON a.session_id = s.id
    WHERE a.organization_id = p_org_id
      AND a.recorded_at >= p_prev_start_iso 
      AND a.recorded_at <= p_prev_end_iso
      AND (
        (p_member_ids IS NULL AND p_project_ids IS NULL)
        OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
        OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
      );
      
    v_prev_activity_count := v_prev_total_mins;

    SELECT jsonb_object_agg(COALESCE(app_name, 'Unknown'), cnt)
    INTO v_app_usage
    FROM (
      SELECT a.app_name, COUNT(*) as cnt
      FROM activity_samples a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.organization_id = p_org_id
        AND a.recorded_at >= p_start_iso 
        AND a.recorded_at <= p_end_iso
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
        AND a.app_name IS NOT NULL
        AND TRIM(a.app_name) != ''
        AND LOWER(a.app_name) != 'program manager'
      GROUP BY a.app_name
      ORDER BY cnt DESC
      LIMIT 20
    ) t;

    SELECT COALESCE(jsonb_object_agg(user_id::text, json_build_object('mins', mins, 'activity_sum', act_sum, 'cnt', cnt)), '{}'::jsonb)
    INTO v_user_stats
    FROM (
      SELECT 
        s.user_id, 
        COUNT(*) as mins, 
        COALESCE(SUM(a.activity_percent), 0) as act_sum,
        COUNT(a.id) as cnt
      FROM activity_samples a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.organization_id = p_org_id
        AND a.recorded_at >= p_start_iso 
        AND a.recorded_at <= p_end_iso
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY s.user_id
    ) t;

    SELECT COALESCE(jsonb_object_agg(project_id::text, json_build_object('mins', mins, 'activity_sum', act_sum, 'cnt', cnt)), '{}'::jsonb)
    INTO v_proj_stats
    FROM (
      SELECT 
        s.project_id, 
        COUNT(*) as mins, 
        COALESCE(SUM(a.activity_percent), 0) as act_sum,
        COUNT(a.id) as cnt
      FROM activity_samples a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.organization_id = p_org_id
        AND a.recorded_at >= p_start_iso 
        AND a.recorded_at <= p_end_iso
        AND s.project_id IS NOT NULL
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY s.project_id
    ) t;

    SELECT COALESCE(jsonb_object_agg(day_name, cnt), '{}'::jsonb)
    INTO v_daily_stats
    FROM (
      SELECT 
        TO_CHAR(a.recorded_at AT TIME ZONE 'UTC', 'Dy') as day_name, 
        COUNT(*) as cnt
      FROM activity_samples a
      JOIN sessions s ON a.session_id = s.id
      WHERE a.organization_id = p_org_id
        AND a.recorded_at >= p_start_iso 
        AND a.recorded_at <= p_end_iso
        AND (
          (p_member_ids IS NULL AND p_project_ids IS NULL)
          OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
          OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
        )
      GROUP BY TO_CHAR(a.recorded_at AT TIME ZONE 'UTC', 'Dy')
    ) t;
  END IF;

  -- Screenshots query
  SELECT COALESCE(jsonb_agg(to_jsonb(ss)), '[]'::jsonb)
  INTO v_user_screenshots
  FROM (
    SELECT 
      ss.id,
      ss.user_id,
      ss.file_url as path,
      ss.recorded_at as "recordedAt",
      0 as "activityPercent"
    FROM screenshots ss
    JOIN sessions s ON ss.session_id = s.id
    WHERE ss.organization_id = p_org_id
      AND ss.recorded_at >= p_start_iso 
      AND ss.recorded_at <= p_end_iso
      AND (
        (p_member_ids IS NULL AND p_project_ids IS NULL)
        OR (p_member_ids IS NOT NULL AND s.user_id = ANY(p_member_ids::uuid[]))
        OR (p_project_ids IS NOT NULL AND s.project_id = ANY(p_project_ids))
      )
    ORDER BY ss.recorded_at DESC
  ) ss;

  RETURN json_build_object(
    'total_mins', v_total_mins,
    'activity_sum', v_activity_sum,
    'activity_count', v_activity_count,
    'prev_total_mins', v_prev_total_mins,
    'prev_activity_sum', v_prev_activity_sum,
    'prev_activity_count', v_prev_activity_count,
    'screenshot_count', v_screenshot_count,
    'projects_worked', v_projects_worked,
    'active_members', v_active_members,
    'app_usage', v_app_usage,
    'user_stats', v_user_stats,
    'proj_stats', v_proj_stats,
    'daily_stats', v_daily_stats,
    'screenshots', v_user_screenshots
  );
END;
$$ LANGUAGE plpgsql;
