// block_accumulator.rs
// Accumulates 10 × 60-second activity samples into a single 10-minute BlockRecord.
// This is the Hubstaff-equivalent primitive:
//   activity_percent = active_seconds / 600 * 100
//
// BlockRecord is the single source of truth written to Supabase block_records.
// All pages (Desktop Dashboard, Timesheets, Reports) read from block_records —
// no page re-derives time from raw activity_samples.

use std::sync::{Arc, Mutex};
use serde::{Deserialize, Serialize};
use crate::tracker::ActivitySample;

/// How many 60-second samples form one block (10 minutes)
const SAMPLES_PER_BLOCK: usize = 10;
/// Seconds in one block window
const BLOCK_WINDOW_SECS: f32 = 600.0;

// ─── BlockRecord: immutable 10-minute aggregate ────────────────────────────────
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct BlockRecord {
    pub session_id:      String,
    pub block_start:     String,   // RFC3339 UTC
    pub block_end:       String,   // RFC3339 UTC
    pub active_seconds:  u32,      // 0..600
    pub activity_percent: i32,     // 0..100
    pub is_productive:   bool,     // activity_percent > 0
    pub credited:        bool,     // org idle policy applied at close time
    pub mouse_clicks:    u32,
    pub key_presses:     u32,
    pub app_name:        String,   // dominant app in this block (most frequent)
    pub domain:          String,
    pub is_offline:      bool,
    pub business_date:   String,   // YYYY-MM-DD in org timezone
}

// ─── BlockAccumulator: collects samples and flushes complete blocks ────────────
#[derive(Debug)]
pub struct BlockAccumulator {
    samples:       Vec<ActivitySample>,
    block_start:   Option<chrono::DateTime<chrono::Utc>>,
    org_timezone:  String,      // e.g. "America/Los_Angeles"
    idle_policy:   String,      // "always" | "prompt" | "never"
}

impl BlockAccumulator {
    pub fn new(org_timezone: String, idle_policy: String) -> Self {
        Self {
            samples: Vec::with_capacity(SAMPLES_PER_BLOCK),
            block_start: None,
            org_timezone,
            idle_policy,
        }
    }

    /// Add a 60-second sample. Returns a completed BlockRecord if the block is now full.
    pub fn push(&mut self, sample: ActivitySample) -> Option<BlockRecord> {
        if self.block_start.is_none() {
            // Parse start from first sample's recorded_at
            self.block_start = chrono::DateTime::parse_from_rfc3339(&sample.recorded_at)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc));
        }
        self.samples.push(sample);

        if self.samples.len() >= SAMPLES_PER_BLOCK {
            let block = self.flush();
            Some(block)
        } else {
            None
        }
    }

    /// Force-flush a partial block at session stop (may be < 10 samples)
    pub fn flush_partial(&mut self) -> Option<BlockRecord> {
        if self.samples.is_empty() {
            return None;
        }
        Some(self.flush())
    }

    fn flush(&mut self) -> BlockRecord {
        use chrono::TimeZone;

        let samples = std::mem::replace(&mut self.samples, Vec::with_capacity(SAMPLES_PER_BLOCK));
        let block_start = self.block_start.take().unwrap_or_else(chrono::Utc::now);

        // The block_end is the recorded_at of the last sample + 60s
        let last_sample_time = samples.last()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(&s.recorded_at).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or(block_start);
        let block_end = last_sample_time + chrono::Duration::seconds(60);

        // Aggregate active_seconds across all samples in the block
        let active_seconds: u32 = samples.iter().map(|s| s.active_seconds).sum();
        let activity_percent = ((active_seconds as f32 / BLOCK_WINDOW_SECS) * 100.0)
            .min(100.0) as i32;
        let is_productive = activity_percent > 0;

        // Apply idle policy at block close time
        let credited = match self.idle_policy.as_str() {
            "always" => true,          // always keep — idle time is credited
            "never"  => is_productive, // always discard idle blocks
            "prompt" => true,          // user will decide; default credit=true until discard action
            _        => is_productive,
        };

        // Aggregate clicks/keypresses
        let mouse_clicks: u32 = samples.iter().map(|s| s.mouse_clicks).sum();
        let key_presses: u32 = samples.iter().map(|s| s.key_presses).sum();

        // Dominant app in this block = the app that appeared most often
        let mut app_freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        let mut domain_freq: std::collections::HashMap<String, usize> = std::collections::HashMap::new();
        for s in &samples {
            if !s.app_name.is_empty() {
                *app_freq.entry(s.app_name.clone()).or_insert(0) += 1;
            }
            if !s.domain.is_empty() {
                *domain_freq.entry(s.domain.clone()).or_insert(0) += 1;
            }
        }
        let app_name = app_freq.into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(name, _)| name)
            .unwrap_or_default();
        let domain = domain_freq.into_iter()
            .max_by_key(|(_, count)| *count)
            .map(|(name, _)| name)
            .unwrap_or_default();

        let is_offline = samples.iter().any(|s| s.is_offline);
        let session_id = samples.first().map(|s| s.session_id.clone()).unwrap_or_default();

        // Compute business_date in org timezone
        let business_date = compute_business_date(&block_end, &self.org_timezone);

        BlockRecord {
            session_id,
            block_start: block_start.to_rfc3339(),
            block_end: block_end.to_rfc3339(),
            active_seconds,
            activity_percent,
            is_productive,
            credited,
            mouse_clicks,
            key_presses,
            app_name,
            domain,
            is_offline,
            business_date,
        }
    }
}

/// Convert a UTC timestamp to the org-timezone date string (YYYY-MM-DD).
/// Falls back to UTC if the timezone string is invalid.
pub fn compute_business_date(utc: &chrono::DateTime<chrono::Utc>, org_tz: &str) -> String {
    // Use chrono-tz if available; otherwise fall back to a simple UTC offset
    // We implement a simple lookup for common IANA timezone offsets
    let offset_hours = iana_tz_offset_hours(org_tz);
    let local = *utc + chrono::Duration::hours(offset_hours);
    local.format("%Y-%m-%d").to_string()
}

/// Returns a whole-hour UTC offset for common IANA timezone names.
/// This is a simple fallback since chrono-tz is not in the dependency tree.
/// Covers all timezone strings actually stored in org settings.
fn iana_tz_offset_hours(tz: &str) -> i64 {
    match tz {
        "America/Los_Angeles" | "US/Pacific"              => -8,
        "America/Denver" | "US/Mountain"                  => -7,
        "America/Chicago" | "US/Central"                  => -6,
        "America/New_York" | "US/Eastern"                 => -5,
        "America/Halifax"                                  => -4,
        "America/Sao_Paulo"                               => -3,
        "Atlantic/Azores"                                  => -1,
        "UTC" | "Etc/UTC" | "GMT"                         =>  0,
        "Europe/London" | "Europe/Lisbon"                  =>  0,
        "Europe/Berlin" | "Europe/Paris" | "Europe/Rome"  =>  1,
        "Europe/Helsinki" | "Europe/Kiev"                  =>  2,
        "Europe/Moscow"                                    =>  3,
        "Asia/Dubai"                                       =>  4,
        "Asia/Karachi" | "Asia/Tashkent"                  =>  5,
        "Asia/Dhaka"                                       =>  6,
        "Asia/Bangkok" | "Asia/Jakarta"                    =>  7,
        "Asia/Shanghai" | "Asia/Singapore" | "Asia/Hong_Kong" => 8,
        "Asia/Tokyo" | "Asia/Seoul"                        =>  9,
        "Australia/Sydney" | "Australia/Melbourne"         => 10,
        "Pacific/Auckland"                                 => 12,
        _ => 0, // default UTC
    }
}

// ─── SQLite cache for block_records ───────────────────────────────────────────

/// Initialize the block_records cache table in local SQLite
pub fn init_block_cache(conn: &rusqlite::Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS block_records (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id       TEXT NOT NULL,
            block_start      TEXT NOT NULL,
            block_end        TEXT NOT NULL,
            active_seconds   INTEGER NOT NULL DEFAULT 0,
            activity_percent INTEGER NOT NULL DEFAULT 0,
            is_productive    INTEGER NOT NULL DEFAULT 0,
            credited         INTEGER NOT NULL DEFAULT 1,
            mouse_clicks     INTEGER NOT NULL DEFAULT 0,
            key_presses      INTEGER NOT NULL DEFAULT 0,
            app_name         TEXT NOT NULL DEFAULT '',
            domain           TEXT NOT NULL DEFAULT '',
            is_offline       INTEGER NOT NULL DEFAULT 0,
            business_date    TEXT NOT NULL,
            synced           INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_block_cache_synced ON block_records(synced);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_block_cache_session_start
            ON block_records(session_id, block_start);
        "
    )
}

/// Write a BlockRecord to the local SQLite cache
pub fn cache_block(conn: &rusqlite::Connection, b: &BlockRecord) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT OR IGNORE INTO block_records
            (session_id, block_start, block_end, active_seconds, activity_percent,
             is_productive, credited, mouse_clicks, key_presses, app_name,
             domain, is_offline, business_date, synced)
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,0)",
        rusqlite::params![
            b.session_id, b.block_start, b.block_end,
            b.active_seconds, b.activity_percent,
            b.is_productive as i32, b.credited as i32,
            b.mouse_clicks, b.key_presses,
            b.app_name, b.domain, b.is_offline as i32,
            b.business_date,
        ],
    )?;
    Ok(())
}

/// Get unsynced blocks from local SQLite (batch of up to 20)
pub fn get_pending_blocks(conn: &rusqlite::Connection) -> rusqlite::Result<Vec<(i64, BlockRecord)>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, block_start, block_end, active_seconds,
                activity_percent, is_productive, credited, mouse_clicks, key_presses,
                app_name, domain, is_offline, business_date
         FROM block_records WHERE synced = 0 ORDER BY id ASC LIMIT 20"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            BlockRecord {
                session_id:       row.get(1)?,
                block_start:      row.get(2)?,
                block_end:        row.get(3)?,
                active_seconds:   row.get(4)?,
                activity_percent: row.get(5)?,
                is_productive:    row.get::<_, i32>(6)? != 0,
                credited:         row.get::<_, i32>(7)? != 0,
                mouse_clicks:     row.get(8)?,
                key_presses:      row.get(9)?,
                app_name:         row.get(10)?,
                domain:           row.get(11)?,
                is_offline:       row.get::<_, i32>(12)? != 0,
                business_date:    row.get(13)?,
            }
        ))
    })?;
    rows.collect()
}

/// Mark a set of block cache rows as synced
pub fn mark_blocks_synced(conn: &rusqlite::Connection, ids: &[i64]) -> rusqlite::Result<()> {
    let tx = conn.unchecked_transaction()?;
    for id in ids {
        tx.execute("UPDATE block_records SET synced = 1 WHERE id = ?1", rusqlite::params![id])?;
    }
    tx.commit()
}

// ─── Upload pending blocks to Supabase ────────────────────────────────────────

pub fn sync_blocks(
    conn: &rusqlite::Connection,
    cfg: &crate::SupabaseConfig,
    auth_token: &str,
) {
    let pending = match get_pending_blocks(conn) {
        Ok(p) => p,
        Err(e) => { eprintln!("[blocks] get_pending error: {}", e); return; }
    };
    if pending.is_empty() { return; }

    let ids: Vec<i64> = pending.iter().map(|(id, _)| *id).collect();
    let payload: Vec<serde_json::Value> = pending.into_iter().map(|(_, b)| {
        serde_json::json!({
            "session_id":       b.session_id,
            "block_start":      b.block_start,
            "block_end":        b.block_end,
            "active_seconds":   b.active_seconds,
            "activity_percent": b.activity_percent,
            "is_productive":    b.is_productive,
            "credited":         b.credited,
            "mouse_clicks":     b.mouse_clicks,
            "key_presses":      b.key_presses,
            "app_name":         b.app_name,
            "domain":           b.domain,
            "is_offline":       b.is_offline,
            "business_date":    b.business_date,
        })
    }).collect();

    let body = serde_json::json!(payload).to_string();

    match crate::supabase_post(cfg, "block_records", &body, Some(auth_token), Some("resolution=ignore-duplicates")) {
        Ok(_) => {
            if let Err(e) = mark_blocks_synced(conn, &ids) {
                eprintln!("[blocks] mark_synced error: {}", e);
            } else {
                println!("[blocks] ✅ Synced {} blocks to Supabase", ids.len());
            }
        }
        Err(e) => {
            if e.contains("409") || e.contains("duplicate") || e.contains("unique") {
                // Already on server — mark as synced locally
                let _ = mark_blocks_synced(conn, &ids);
            } else if e.contains("23503") || e.contains("foreign key") {
                // Session deleted — discard these blocks
                let _ = mark_blocks_synced(conn, &ids);
                eprintln!("[blocks] FK violation — session deleted, discarding {} blocks", ids.len());
            } else {
                eprintln!("[blocks] sync failed (will retry): {}", e);
            }
        }
    }
}

pub fn sync_blocks_from_arc(
    db_arc: &Arc<Mutex<Option<rusqlite::Connection>>>,
    cfg: &crate::SupabaseConfig,
    auth_token: &Arc<Mutex<Option<String>>>,
) {
    let token = auth_token.lock().unwrap().clone().unwrap_or_default();
    let db_lock = db_arc.lock().unwrap();
    if let Some(conn) = db_lock.as_ref() {
        sync_blocks(conn, cfg, &token);
    }
}
