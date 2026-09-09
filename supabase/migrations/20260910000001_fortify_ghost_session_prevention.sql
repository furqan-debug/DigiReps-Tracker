-- ==============================================================
-- Fortified Server-Side Auto-Terminate & Ghost Session Prevention
-- Automatically seals all orphaned sessions across:
-- 1. Org-level Auto-Terminate Grace Period (autoStopOnIdle)
-- 2. Power cuts, sudden shutdowns, crashes, lid closes (heartbeat loss)
-- 3. Reads both block_records and activity_samples for exact end timestamp
-- ==============================================================

CREATE OR REPLACE FUNCTION public.rpc_auto_terminate_inactive_sessions(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_session RECORD;
    v_closed_count integer := 0;
    v_closed_sessions jsonb := '[]'::jsonb;
    v_auto_stop_enabled boolean;
    v_grace_period_mins integer;
    v_last_block_end timestamptz;
    v_last_sample_at timestamptz;
    v_last_active_time timestamptz;
    v_trailing_idle_mins integer;
    v_effective_end timestamptz;
    v_now timestamptz := now();
BEGIN
    FOR v_session IN
        SELECT 
            s.id AS session_id,
            s.user_id,
            s.organization_id,
            s.started_at,
            o.settings AS org_settings
        FROM public.sessions s
        LEFT JOIN public.organizations o ON o.id = s.organization_id
        WHERE s.ended_at IS NULL
          AND s.manual = false
          AND (p_org_id IS NULL OR s.organization_id = p_org_id)
    LOOP
        v_auto_stop_enabled := COALESCE((v_session.org_settings->>'autoStopOnIdle')::boolean, false);
        v_grace_period_mins := COALESCE((v_session.org_settings->>'idleAutoStopMinutes')::integer, 15);
        IF v_grace_period_mins <= 0 THEN
            v_grace_period_mins := 15;
        END IF;

        -- Find latest block_record end
        SELECT MAX(block_end) INTO v_last_block_end
        FROM public.block_records
        WHERE session_id = v_session.session_id;

        -- Find latest activity_sample timestamp
        SELECT MAX(recorded_at) INTO v_last_sample_at
        FROM public.activity_samples
        WHERE session_id = v_session.session_id;

        -- Determine the latest heartbeat seen from this session
        v_effective_end := COALESCE(v_last_block_end, v_last_sample_at);

        -- Case 1: Session has zero blocks and zero samples
        IF v_effective_end IS NULL THEN
            IF v_now - v_session.started_at >= (v_grace_period_mins * interval '1 minute') THEN
                UPDATE public.sessions
                SET ended_at = v_session.started_at + interval '1 minute'
                WHERE id = v_session.session_id AND ended_at IS NULL;

                v_closed_count := v_closed_count + 1;
                v_closed_sessions := v_closed_sessions || jsonb_build_object(
                    'session_id', v_session.session_id,
                    'reason', 'zero_data_exceeded_grace_period',
                    'ended_at', v_session.started_at + interval '1 minute'
                );
            END IF;

        -- Case 2: Heartbeat lost (Power cut, crash, lid closed, offline)
        -- No block or sample has arrived for longer than the grace period (or 30 mins absolute max)
        ELSIF v_now - v_effective_end >= (v_grace_period_mins * interval '1 minute') THEN
            -- Find the last active timestamp from blocks or samples
            SELECT MAX(block_end) INTO v_last_active_time
            FROM public.block_records
            WHERE session_id = v_session.session_id
              AND (credited = true OR activity_percent > 0);

            IF v_last_active_time IS NULL THEN
                SELECT MAX(recorded_at) INTO v_last_active_time
                FROM public.activity_samples
                WHERE session_id = v_session.session_id
                  AND (COALESCE(mouse_clicks, 0) > 0 OR COALESCE(key_presses, 0) > 0 OR idle = false);
            END IF;

            -- Stamp end at the last active moment (or last received heartbeat)
            v_effective_end := COALESCE(v_last_active_time, v_effective_end, v_session.started_at + interval '1 minute');

            UPDATE public.sessions
            SET ended_at = v_effective_end
            WHERE id = v_session.session_id AND ended_at IS NULL;

            v_closed_count := v_closed_count + 1;
            v_closed_sessions := v_closed_sessions || jsonb_build_object(
                'session_id', v_session.session_id,
                'reason', 'heartbeat_lost_auto_closed',
                'ended_at', v_effective_end
            );

        -- Case 3: Org Auto-Stop Enabled & User Left Timer Running (Trailing continuous inactivity)
        ELSIF v_auto_stop_enabled THEN
            WITH ranked_samples AS (
                SELECT 
                    recorded_at,
                    mouse_clicks,
                    key_presses,
                    idle,
                    ROW_NUMBER() OVER (ORDER BY recorded_at DESC) as rn
                FROM public.activity_samples
                WHERE session_id = v_session.session_id
            ),
            first_active AS (
                SELECT MIN(rn) as active_rn
                FROM ranked_samples
                WHERE (COALESCE(mouse_clicks, 0) > 0 OR COALESCE(key_presses, 0) > 0 OR idle = false)
            )
            SELECT COALESCE(
                (SELECT active_rn - 1 FROM first_active WHERE active_rn IS NOT NULL),
                (SELECT COUNT(*) FROM ranked_samples)
            ) INTO v_trailing_idle_mins;

            IF v_trailing_idle_mins >= v_grace_period_mins THEN
                SELECT MAX(recorded_at) INTO v_last_active_time
                FROM public.activity_samples
                WHERE session_id = v_session.session_id
                  AND (COALESCE(mouse_clicks, 0) > 0 OR COALESCE(key_presses, 0) > 0 OR idle = false);

                v_effective_end := COALESCE(v_last_active_time + interval '1 minute', v_session.started_at + interval '1 minute');

                UPDATE public.sessions
                SET ended_at = v_effective_end
                WHERE id = v_session.session_id AND ended_at IS NULL;

                -- Also uncredit any trailing dead blocks from this inactivity
                UPDATE public.block_records
                SET credited = false
                WHERE session_id = v_session.session_id
                  AND block_start >= v_effective_end;

                v_closed_count := v_closed_count + 1;
                v_closed_sessions := v_closed_sessions || jsonb_build_object(
                    'session_id', v_session.session_id,
                    'reason', 'trailing_inactivity_grace_period_exceeded',
                    'ended_at', v_effective_end
                );
            END IF;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'closed_count', v_closed_count,
        'closed_sessions', v_closed_sessions
    );
END;
$$;
