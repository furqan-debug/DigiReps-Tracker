-- =============================================================================
-- STEP 0 — Block model shadow comparison  (READ ONLY)
--
-- Computes, side by side, the four different answers to "how many hours did
-- this person work" that TrackOwl can currently produce, so the impact of
-- switching to the 10-minute block model is known BEFORE anything changes.
--
-- This file is deliberately NOT in supabase/migrations/. It must never be
-- applied automatically. It creates nothing, writes nothing, and changes no
-- existing function. Run it manually, read the output, decide.
--
-- The four columns:
--   reports_h  — what the Reports page shows today.
--                get_reports_aggregated_data returns total_minutes = COUNT(*)
--                over every deduped minute. NO idle filtering at all.
--   owed_h     — what Amounts Owed / payroll shows today.
--                get_amounts_owed_stats counts only minutes where idle = false,
--                with NO idle-limit threshold. A 1-minute idle blip is unpaid.
--   daily_h    — what the Daily Totals page shows today.
--                Contiguous-run rule applied client side in report.service.ts:
--                non-idle minutes always count; a run of idle minutes counts
--                only if the run is SHORTER than the member's idle_limit.
--   block_h    — the PROPOSED model.
--                10-minute blocks counted FROM THE START OF EACH SESSION, so
--                every session begins on block 0 and none inherits a block
--                that began before it did. A block is Active if any minute in
--                it had input; an Active block credits every minute it
--                actually contains (so partial blocks credit partially).
--
-- NOTE ON THE BASELINES: reports_h / owed_h / daily_h are reimplementations of
-- the live logic, applied over a single consistently de-duplicated sample set
-- so the four numbers are comparable. The live get_amounts_owed_stats does not
-- de-duplicate same-minute rows, so it reads ~0.7% higher than owed_h here.
-- =============================================================================

-- ── Parameters — edit these ────────────────────────────────────────────────
--   org_id    : the organization to analyse
--   org_tz    : organization timezone (organizations.settings->>'orgTimezone')
--   start_ts  : window start (inclusive)
--   end_ts    : window end (inclusive)

with params as (
  select
    'aeceb4fc-1d4e-4083-9ae8-1f6a6bd0c404'::uuid as org_id,
    'America/Los_Angeles'::text                  as org_tz,
    timestamptz '2026-08-25 00:00:00+00'         as start_ts,
    timestamptz '2026-09-08 23:59:59+00'         as end_ts
),

-- One row per (member, minute). Highest activity wins a tie, matching the
-- dedup the live RPC and the desktop app both apply.
deduped as (
  select distinct on (s.user_id, date_trunc('minute', a.recorded_at))
    s.user_id,
    a.recorded_at,
    a.idle,
    a.mouse_clicks,
    a.key_presses,
    coalesce(m.idle_limit, 10) as idle_limit,
    s.id         as session_id,
    s.started_at as session_started_at
  from activity_samples a
  join sessions s  on a.session_id = s.id
  left join members m on m.id = s.user_id
  cross join params p
  where (a.organization_id = p.org_id or s.organization_id = p.org_id)
    and a.recorded_at >= p.start_ts
    and a.recorded_at <= p.end_ts
  order by s.user_id, date_trunc('minute', a.recorded_at),
           a.activity_percent desc, a.recorded_at
),

enriched as (
  select d.*,
    -- "this minute had real input". Note: on historical rows this cannot see
    -- mouse-movement-only minutes, because activity_percent was force-zeroed
    -- for them and raw active_seconds was never stored. That is the Step 1
    -- seam — after Step 1 ships, re-run this and the number will rise.
    (d.idle = false
       or coalesce(d.mouse_clicks, 0) > 0
       or coalesce(d.key_presses, 0) > 0)                       as has_activity,
    to_char(d.recorded_at at time zone p.org_tz, 'YYYY-MM-DD')  as day_str,
    -- 10-minute block index within this sample's own session
    floor(extract(epoch from (d.recorded_at - d.session_started_at)) / 600)::bigint as block_id
  from deduped d cross join params p
),

-- Contiguous runs, broken by a >125s gap or an idle/active flip.
-- Used only to reproduce the current Daily Totals number.
lagged as (
  select e.*,
    lag(e.recorded_at) over w as prev_time,
    lag(e.idle)        over w as prev_idle
  from enriched e
  window w as (partition by e.user_id order by e.recorded_at)
),
runs as (
  select l.*,
    sum(case when l.prev_time is null
              or l.idle is distinct from l.prev_idle
              or extract(epoch from (l.recorded_at - l.prev_time)) > 125
             then 1 else 0 end)
      over (partition by l.user_id order by l.recorded_at) as run_id
  from lagged l
),
run_len as (
  select user_id, run_id, count(*) as len
  from runs group by user_id, run_id
),

-- Proposed model: a block is Active if ANY minute inside it had input.
block_state as (
  select user_id, session_id, block_id, bool_or(has_activity) as block_active
  from enriched group by user_id, session_id, block_id
),

joined as (
  select r.*, rl.len, bs.block_active
  from runs r
  join run_len    rl on rl.user_id = r.user_id and rl.run_id   = r.run_id
  join block_state bs on bs.user_id    = r.user_id
                     and bs.session_id = r.session_id
                     and bs.block_id   = r.block_id
)

-- ── Per-member summary ─────────────────────────────────────────────────────
-- Swap the final SELECT for one of the variants at the bottom of this file
-- to get org totals or a day-by-day breakdown instead.
select
  coalesce(m.full_name, '(unknown)')                                  as member,
  round(count(*) / 60.0, 1)                                           as reports_h,
  round(count(*) filter (where j.idle = false) / 60.0, 1)             as owed_h,
  round(count(*) filter (where j.idle = false
                            or j.len < j.idle_limit) / 60.0, 1)       as daily_h,
  round(count(*) filter (where j.block_active) / 60.0, 1)             as block_h,
  round((count(*) filter (where j.block_active)
       - count(*) filter (where j.idle = false)) / 60.0, 1)           as payroll_delta_h
from joined j
left join members m on m.id = j.user_id
group by j.user_id, m.full_name
order by abs(count(*) filter (where j.block_active)
           - count(*) filter (where j.idle = false)) desc;


-- ── Variant: organization totals ───────────────────────────────────────────
-- select
--   round(count(*)/60.0,1)                                              as reports_h,
--   round(count(*) filter (where j.idle=false)/60.0,1)                  as owed_h,
--   round(count(*) filter (where j.idle=false or j.len<j.idle_limit)/60.0,1) as daily_h,
--   round(count(*) filter (where j.block_active)/60.0,1)                as block_h
-- from joined j;

-- ── Variant: day by day ────────────────────────────────────────────────────
-- select j.day_str as day,
--   round(count(*)/60.0,1)                                              as reports_h,
--   round(count(*) filter (where j.idle=false)/60.0,1)                  as owed_h,
--   round(count(*) filter (where j.idle=false or j.len<j.idle_limit)/60.0,1) as daily_h,
--   round(count(*) filter (where j.block_active)/60.0,1)                as block_h
-- from joined j group by j.day_str order by j.day_str;
