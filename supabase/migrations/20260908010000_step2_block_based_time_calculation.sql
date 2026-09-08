-- =============================================================================
-- STEP 2 — Switch the calculation to 10-minute blocks
--
-- Reports and Amounts Owed start reading hours as blocks instead of counting
-- raw minutes. This is the step where reported numbers change.
--
-- DO NOT APPLY until Step 1 is released and Step 0 has been re-run against
-- post-Step-1 data. See supabase/analysis/step0_block_shadow_comparison.sql.
--
-- The model
--   Block        = fixed, clock-aligned 10 minutes: floor(epoch / 600).
--                  Derived from the timestamp alone, so client and server
--                  compute identical block ids with no coordination.
--   Active block = at least one minute inside it had input.
--   Credit       = every minute actually present in an Active block. Partial
--                  blocks credit partially; a block with no samples credits
--                  nothing and needs no correction.
--
-- Ships four changes together, deliberately. Splitting them would leave
-- Reports and Amounts Owed disagreeing with each other.
-- =============================================================================


-- ── Shared definitions ──────────────────────────────────────────────────────

-- What counts as activity in one sample.
-- Prefers the raw active_seconds recorded from Step 1 onward. Falls back to the
-- old flags for historical rows, where active_seconds is NULL and the raw signal
-- was never captured. STABLE, not IMMUTABLE: date_part over timestamptz is not
-- immutable, and we never index on these.
CREATE OR REPLACE FUNCTION public.sample_has_activity(
  p_active_seconds smallint,
  p_idle           boolean,
  p_mouse_clicks   integer,
  p_key_presses    integer
) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_active_seconds IS NOT NULL THEN p_active_seconds > 0
    ELSE COALESCE(p_idle, true) = false
      OR COALESCE(p_mouse_clicks, 0) > 0
      OR COALESCE(p_key_presses, 0) > 0
  END;
$$;

COMMENT ON FUNCTION public.sample_has_activity IS
  'True when a sample saw any input. Uses active_seconds when present (Step 1 onward); falls back to idle/clicks/keypresses for older rows where the raw value was never recorded.';

-- The clock-aligned 10-minute block a timestamp falls into.
CREATE OR REPLACE FUNCTION public.block_id_of(p_ts timestamptz)
RETURNS bigint
LANGUAGE sql STABLE AS $$
  SELECT floor(extract(epoch FROM p_ts) / 600)::bigint;
$$;

COMMENT ON FUNCTION public.block_id_of IS
  'Clock-aligned 10-minute block id. block_id_of(t) * 600 is the block start as a unix epoch.';


-- ── 1. Reports ──────────────────────────────────────────────────────────────
-- Same JSON shape as before so report.service.ts needs no change.
-- total_minutes now means CREDITED minutes rather than every recorded minute.
-- activity_sum / sample_count are computed over credited minutes only, so the
-- average activity describes the time actually being paid for.

CREATE OR REPLACE FUNCTION public.get_reports_aggregated_data(
  p_org_id     uuid,
  p_start_iso  timestamptz,
  p_end_iso    timestamptz,
  p_org_tz     text,
  p_member_ids text[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  v_daily      jsonb;
  v_user_daily jsonb;
  v_apps       jsonb;
BEGIN
  CREATE TEMP TABLE _credited ON COMMIT DROP AS
  WITH deduped AS (
    SELECT DISTINCT ON (s.user_id, date_trunc('minute', a.recorded_at))
      s.user_id,
      a.recorded_at,
      a.activity_percent,
      a.app_name,
      public.sample_has_activity(a.active_seconds, a.idle, a.mouse_clicks, a.key_presses) AS has_activity,
      public.block_id_of(a.recorded_at) AS block_id
    FROM activity_samples a
    JOIN sessions s ON a.session_id = s.id
    WHERE (a.organization_id = p_org_id OR s.organization_id = p_org_id)
      AND a.recorded_at >= p_start_iso
      AND a.recorded_at <= p_end_iso
      AND (p_member_ids IS NULL OR s.user_id = ANY(p_member_ids::uuid[]))
    ORDER BY s.user_id, date_trunc('minute', a.recorded_at), a.activity_percent DESC
  ),
  -- A block counts if ANY minute in it saw input.
  block_state AS (
    SELECT user_id, block_id, bool_or(has_activity) AS block_active
    FROM deduped
    GROUP BY user_id, block_id
  )
  SELECT d.user_id,
         d.recorded_at,
         d.activity_percent,
         d.app_name,
         TO_CHAR(d.recorded_at AT TIME ZONE p_org_tz, 'YYYY-MM-DD') AS day_str
  FROM deduped d
  JOIN block_state b ON b.user_id = d.user_id AND b.block_id = d.block_id
  WHERE b.block_active;
  -- Each surviving row is one credited minute. Note days are assigned per
  -- MINUTE, not per block, so a block straddling a local midnight (possible in
  -- zones with :45 offsets) still splits across days correctly.

  SELECT jsonb_agg(row_to_json(t)) INTO v_daily
  FROM (
    SELECT day_str                          AS date,
           COUNT(*)::bigint                 AS total_minutes,
           SUM(activity_percent)::numeric   AS activity_sum,
           COUNT(*)::bigint                 AS sample_count
    FROM _credited
    GROUP BY day_str
    ORDER BY day_str ASC
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_user_daily
  FROM (
    SELECT user_id,
           day_str                          AS date,
           COUNT(*)::bigint                 AS total_minutes,
           SUM(activity_percent)::numeric   AS activity_sum,
           COUNT(*)::bigint                 AS sample_count
    FROM _credited
    GROUP BY user_id, day_str
  ) t;

  SELECT jsonb_agg(row_to_json(t)) INTO v_apps
  FROM (
    SELECT app_name,
           COUNT(*)              AS total_minutes,
           SUM(activity_percent) AS activity_sum
    FROM _credited
    WHERE app_name IS NOT NULL AND TRIM(app_name) != ''
    GROUP BY app_name
    ORDER BY COUNT(*) DESC
  ) t;

  RETURN jsonb_build_object(
    'daily_stats',      COALESCE(v_daily,      '[]'::jsonb),
    'user_daily_stats', COALESCE(v_user_daily, '[]'::jsonb),
    'app_stats',        COALESCE(v_apps,       '[]'::jsonb)
  );
END;
$function$;


-- ── 2. Amounts Owed ─────────────────────────────────────────────────────────
-- Was: count of minutes where idle = false, with no threshold — so a single
-- idle minute went unpaid. Now the same block rule as Reports, so the two
-- surfaces finally agree. Signature unchanged.

CREATE OR REPLACE FUNCTION public.get_amounts_owed_stats(
  p_org_id    uuid,
  p_start_iso timestamptz
)
RETURNS TABLE(user_id uuid, productive_mins bigint, last_tracked timestamptz)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  WITH deduped AS (
    SELECT DISTINCT ON (s.user_id, date_trunc('minute', a.recorded_at))
      s.user_id AS uid,
      a.recorded_at,
      public.sample_has_activity(a.active_seconds, a.idle, a.mouse_clicks, a.key_presses) AS has_activity,
      public.block_id_of(a.recorded_at) AS block_id
    FROM activity_samples a
    JOIN sessions s ON a.session_id = s.id
    WHERE (a.organization_id = p_org_id OR s.organization_id = p_org_id)
      AND a.recorded_at >= p_start_iso
    ORDER BY s.user_id, date_trunc('minute', a.recorded_at), a.activity_percent DESC
  ),
  block_state AS (
    SELECT uid, block_id, bool_or(has_activity) AS block_active
    FROM deduped GROUP BY uid, block_id
  )
  SELECT d.uid,
         COUNT(*) FILTER (WHERE b.block_active)::bigint,
         MAX(d.recorded_at)
  FROM deduped d
  JOIN block_state b ON b.uid = d.uid AND b.block_id = d.block_id
  GROUP BY d.uid;
END;
$function$;


-- ── 3. Auto-terminate ───────────────────────────────────────────────────────
-- Was: close abandoned sessions at (last active sample + 1 minute).
-- Now: close at the END of the last block that had activity, so a crashed or
-- powered-off machine leaves behind whole blocks rather than a ragged edge.

CREATE OR REPLACE FUNCTION public.rpc_auto_terminate_inactive_sessions(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_session          RECORD;
    v_closed_count     integer := 0;
    v_closed_sessions  jsonb := '[]'::jsonb;
    v_auto_stop        boolean;
    v_grace_mins       integer;
    v_last_sample_at   timestamptz;
    v_sample_count     bigint;
    v_last_block       bigint;
    v_block_end        timestamptz;
    v_new_end          timestamptz;
    v_reason           text;
    v_now              timestamptz := now();
BEGIN
    FOR v_session IN
        SELECT s.id AS session_id, s.started_at, o.settings AS org_settings
        FROM public.sessions s
        LEFT JOIN public.organizations o ON o.id = s.organization_id
        WHERE s.ended_at IS NULL
          AND s.manual = false
          AND (p_org_id IS NULL OR s.organization_id = p_org_id)
    LOOP
        v_auto_stop  := COALESCE((v_session.org_settings->>'autoStopOnIdle')::boolean, false);
        v_grace_mins := COALESCE((v_session.org_settings->>'idleAutoStopMinutes')::integer, 60);

        CONTINUE WHEN NOT v_auto_stop OR v_grace_mins <= 0;

        SELECT MAX(recorded_at), COUNT(*)
        INTO v_last_sample_at, v_sample_count
        FROM public.activity_samples
        WHERE session_id = v_session.session_id;

        v_new_end := NULL;
        v_reason  := NULL;

        IF v_sample_count = 0 OR v_last_sample_at IS NULL THEN
            -- Never produced a single sample. Nothing was ever proven worked.
            IF v_now - v_session.started_at >= (v_grace_mins * interval '1 minute') THEN
                v_new_end := v_session.started_at + interval '1 minute';
                v_reason  := 'no_samples_exceeded_grace_period';
            END IF;

        ELSIF v_now - v_last_sample_at >= (v_grace_mins * interval '1 minute') THEN
            -- Heartbeat stopped: crash, power cut, lid closed.
            v_reason := 'heartbeat_stopped_exceeded_grace_period';

        ELSE
            -- Still reporting, but check for a long trailing run of dead blocks.
            SELECT COUNT(*) INTO v_sample_count
            FROM public.activity_samples
            WHERE session_id = v_session.session_id
              AND recorded_at > v_now - (v_grace_mins * interval '1 minute')
              AND public.sample_has_activity(active_seconds, idle, mouse_clicks, key_presses);

            IF v_sample_count = 0 THEN
                v_reason := 'continuous_inactivity_exceeded_grace_period';
            END IF;
        END IF;

        IF v_reason IS NOT NULL AND v_new_end IS NULL THEN
            -- Close at the end of the last block that actually had activity.
            SELECT MAX(public.block_id_of(recorded_at))
            INTO v_last_block
            FROM public.activity_samples
            WHERE session_id = v_session.session_id
              AND public.sample_has_activity(active_seconds, idle, mouse_clicks, key_presses);

            IF v_last_block IS NOT NULL THEN
                v_block_end := to_timestamp((v_last_block + 1) * 600);
                v_new_end   := LEAST(v_now, v_block_end);
            ELSE
                -- Session existed but never saw input at all.
                v_new_end := v_session.started_at + interval '1 minute';
            END IF;
        END IF;

        IF v_new_end IS NOT NULL THEN
            UPDATE public.sessions
            SET ended_at = v_new_end
            WHERE id = v_session.session_id AND ended_at IS NULL;

            v_closed_count := v_closed_count + 1;
            v_closed_sessions := v_closed_sessions || jsonb_build_object(
                'session_id', v_session.session_id,
                'reason',     v_reason,
                'ended_at',   v_new_end
            );
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
      'closed_count',    v_closed_count,
      'closed_sessions', v_closed_sessions
    );
END;
$function$;


-- ── 4. Late-sync expansion guard ────────────────────────────────────────────
-- This trigger reopens a closed session when a late sample lands after its
-- ended_at. Left as-is it would silently resurrect discarded idle tails that
-- sync up after the session was capped. Now it only expands for samples that
-- actually contain activity.

CREATE OR REPLACE FUNCTION public.trg_expand_session_ended_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    v_session_id UUID;
    v_ended_at   TIMESTAMPTZ;
BEGIN
    -- Idle minutes must never reopen a capped session.
    IF NOT public.sample_has_activity(NEW.active_seconds, NEW.idle, NEW.mouse_clicks, NEW.key_presses) THEN
        RETURN NEW;
    END IF;

    SELECT id, ended_at
    INTO v_session_id, v_ended_at
    FROM sessions
    WHERE id = NEW.session_id;

    -- Only for genuine offline catch-up, never across hours or days.
    IF v_ended_at IS NOT NULL AND NEW.recorded_at > v_ended_at THEN
        IF (NEW.recorded_at - v_ended_at) <= interval '30 minutes' THEN
            UPDATE sessions
            SET ended_at = NEW.recorded_at
            WHERE id = v_session_id;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;
