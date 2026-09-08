// cache.rs — Phase 4: Offline SQLite cache + sync loop
// Phase 6+: Syncs directly to Supabase /rest/v1/activity_samples (no Express backend)

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::tracker::ActivitySample;
use crate::SupabaseConfig;

// Global lock to prevent concurrent sync loops from overlapping
static SYNC_LOCK: Mutex<()> = Mutex::new(());

// ─── Row types ─────────────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CachedSample {
    pub id: i64,
    pub session_id: String,
    pub recorded_at: String,
    pub mouse_clicks: u32,
    pub key_presses: u32,
    pub app_name: String,
    pub window_title: String,
    pub domain: String,
    pub idle: bool,
    pub activity_percent: i32,
    /// None for rows queued by a pre-Step-1 build — synced as null (unknown)
    /// rather than 0, which would falsely assert the minute had no activity.
    pub active_seconds: Option<u32>,
    pub is_offline: bool,
    pub synced: bool,
}

// ─── DB path ───────────────────────────────────────────────────────────────────
fn db_path() -> std::path::PathBuf {
    let base = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("TrackOwl").join("tracker_cache.sqlite")
}

// ─── Initialize DB ────────────────────────────────────────────────────────────
pub fn init_db() -> rusqlite::Result<Connection> {
    let path = db_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(&path)?;

    // --- Migration: Rename timestamp to recorded_at, add activity_percent ---
    let table_info: Vec<String> = {
        let mut stmt = conn.prepare("PRAGMA table_info(activity_samples)")?;
        let rows = stmt.query_map([], |row| row.get::<_, String>(1))?;
        rows.map(|r| r.unwrap_or_default()).collect()
    };

    if !table_info.is_empty() {
        if table_info.contains(&"timestamp".to_string()) && !table_info.contains(&"recorded_at".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples RENAME COLUMN timestamp TO recorded_at", []);
        }
        if !table_info.contains(&"activity_percent".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples ADD COLUMN activity_percent INTEGER NOT NULL DEFAULT 0", []);
        }
        if !table_info.contains(&"mouse_clicks".to_string()) && table_info.contains(&"mouse_count".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples RENAME COLUMN mouse_count TO mouse_clicks", []);
        }
        if !table_info.contains(&"key_presses".to_string()) && table_info.contains(&"keyboard_count".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples RENAME COLUMN keyboard_count TO key_presses", []);
        }
        if !table_info.contains(&"idle".to_string()) && table_info.contains(&"idle_flag".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples RENAME COLUMN idle_flag TO idle", []);
        }
        if !table_info.contains(&"is_offline".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples ADD COLUMN is_offline INTEGER NOT NULL DEFAULT 0", []);
        }
        // Step 1: added nullable on purpose — rows already queued by an older
        // build genuinely don't know their active seconds, and must sync as
        // null rather than claiming 0.
        if !table_info.contains(&"active_seconds".to_string()) {
            let _ = conn.execute("ALTER TABLE activity_samples ADD COLUMN active_seconds INTEGER", []);
        }
    }

    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS activity_samples (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id       TEXT    NOT NULL,
            recorded_at      TEXT    NOT NULL,
            mouse_clicks     INTEGER NOT NULL DEFAULT 0,
            key_presses      INTEGER NOT NULL DEFAULT 0,
            app_name         TEXT    NOT NULL DEFAULT '',
            window_title     TEXT    NOT NULL DEFAULT '',
            domain           TEXT    NOT NULL DEFAULT '',
            idle             INTEGER NOT NULL DEFAULT 0,
            activity_percent INTEGER NOT NULL DEFAULT 0,
            active_seconds   INTEGER,
            is_offline       INTEGER NOT NULL DEFAULT 0,
            synced           INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_synced ON activity_samples(synced);
        CREATE TABLE IF NOT EXISTS screenshot_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            captured_at INTEGER NOT NULL  -- Unix timestamp in milliseconds
        );
        CREATE INDEX IF NOT EXISTS idx_screenshot_time ON screenshot_log(captured_at);
        CREATE TABLE IF NOT EXISTS pending_session_stops (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id  TEXT    NOT NULL,
            ended_at    TEXT    NOT NULL
        );",
    )?;

    // ── Startup cleanup: discard unsynced samples older than 24 hours ──────────
    // A sample that hasn't synced after 24h has been retried ~2,880 times and its
    // session_id no longer exists on the server. Keeping it blocks every newer
    // sample behind it. Active users' queues are always seconds-to-minutes old,
    // so this threshold never affects a healthy, online user.
    let cutoff_24h = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::hours(24))
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();
    let pruned = conn.execute(
        "DELETE FROM activity_samples WHERE synced = 0 AND recorded_at < ?1",
        params![cutoff_24h],
    ).unwrap_or(0);
    if pruned > 0 {
        eprintln!("[cache] 🧹 Pruned {} stale unsynced samples (>24h old) on startup", pruned);
    }

    Ok(conn)
}

// ─── Screenshot Rate-Limit Helpers ────────────────────────────────────────────

/// Record a screenshot capture timestamp (ms since UNIX epoch).
pub fn log_screenshot_time(conn: &Connection, timestamp_ms: i64) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO screenshot_log (captured_at) VALUES (?1)",
        params![timestamp_ms],
    )?;
    Ok(())
}

/// Count screenshots captured since `since_ms` (rolling-window query).
pub fn count_screenshots_since(conn: &Connection, since_ms: i64) -> rusqlite::Result<usize> {
    let count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM screenshot_log WHERE captured_at >= ?1",
        params![since_ms],
        |row| row.get(0),
    )?;
    Ok(count as usize)
}

/// Delete screenshot_log rows older than 24 hours to keep the table lean.
pub fn prune_screenshot_log(conn: &Connection) {
    use std::time::{SystemTime, UNIX_EPOCH};
    let cutoff = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
        - (24 * 60 * 60 * 1000);
    let _ = conn.execute(
        "DELETE FROM screenshot_log WHERE captured_at < ?1",
        params![cutoff],
    );
}


// ─── Public API ────────────────────────────────────────────────────────────────
pub fn cache_sample(conn: &Connection, sample: &ActivitySample) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO activity_samples
             (session_id, recorded_at, mouse_clicks, key_presses, app_name, window_title, domain, idle, activity_percent, active_seconds, is_offline, synced)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, 0)",
        params![
            sample.session_id, sample.recorded_at, sample.mouse_clicks,
            sample.key_presses, sample.app_name, sample.window_title,
            sample.domain, sample.idle as i32, sample.activity_percent,
            sample.active_seconds, sample.is_offline as i32,
        ],
    )?;
    Ok(())
}

pub fn get_unsynced_samples(conn: &Connection) -> rusqlite::Result<Vec<CachedSample>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, recorded_at, mouse_clicks, key_presses,
                app_name, window_title, domain, idle, activity_percent, is_offline, synced,
                active_seconds
         FROM activity_samples WHERE synced = 0 ORDER BY id ASC LIMIT 50"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CachedSample {
            id: row.get(0)?,
            session_id: row.get(1)?,
            recorded_at: row.get(2)?,
            mouse_clicks: row.get::<_, u32>(3)?,
            key_presses: row.get::<_, u32>(4)?,
            app_name: row.get(5)?,
            window_title: row.get(6)?,
            domain: row.get(7)?,
            idle: row.get::<_, i32>(8)? != 0,
            activity_percent: row.get(9)?,
            is_offline: row.get::<_, i32>(10)? != 0,
            synced: row.get::<_, i32>(11)? != 0,
            active_seconds: row.get::<_, Option<u32>>(12)?,
        })
    })?;
    rows.collect()
}

pub fn mark_synced(conn: &mut Connection, ids: &[i64]) -> rusqlite::Result<()> {
    if ids.is_empty() { return Ok(()); }
    
    // Use a transaction for atomic updates
    let tx = conn.transaction()?;
    
    for id in ids {
        tx.execute("UPDATE activity_samples SET synced = 1 WHERE id = ?1", params![id])?;
    }
    
    // Prune synced rows older than 7 days
    let cutoff = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(7))
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();
    
    tx.execute(
        "DELETE FROM activity_samples WHERE synced = 1 AND recorded_at < ?1",
        params![cutoff],
    )?;
    
    tx.commit()?;
    Ok(())
}

/// Delete unsynced samples for a session after the given cutoff time.
/// Called by discard_idle_cache to remove idle samples from local SQLite
/// so stop_tracking's sync doesn't re-upload them to Supabase.
pub fn purge_samples_after(
    conn: &Connection,
    session_id: &str,
    after_iso: &str,
) -> rusqlite::Result<usize> {
    let n = conn.execute(
        "DELETE FROM activity_samples WHERE session_id = ?1 AND recorded_at >= ?2",
        params![session_id, after_iso],
    )?;
    Ok(n)
}

// ─── 30s Sync Loop ─────────────────────────────────────────────────────────────
/// Spawns a background thread that syncs unsynced samples to Supabase every 30s.
pub fn start_sync_loop(
    cfg: SupabaseConfig,
    auth_token: Arc<Mutex<Option<String>>>,
    running: Arc<Mutex<bool>>,
) {
    thread::spawn(move || {
        let mut conn = match init_db() {
            Ok(c) => c,
            Err(e) => { eprintln!("[cache] Failed to open DB: {}", e); return; }
        };
        loop {
            thread::sleep(Duration::from_secs(30));
            if !*running.lock().unwrap() { break; }
            sync_once(&mut conn, &cfg, &auth_token);
        }
    });
}

/// One sync pass — inserts unsynced samples as a batch into Supabase.
pub fn sync_once(
    conn: &mut Connection,
    cfg: &SupabaseConfig,
    auth_token: &Arc<Mutex<Option<String>>>,
) {
    // Prevent concurrent syncs
    let _guard = match SYNC_LOCK.try_lock() {
        Ok(g) => g,
        Err(_) => return, // Already syncing
    };

    // Sync any pending session stops first
    let stops = get_pending_session_stops(conn).unwrap_or_default();
    if !stops.is_empty() {
        let token = auth_token.lock().unwrap().clone().unwrap_or_default();
        for (id, sid, ended_at) in &stops {
            let body = serde_json::json!({
                "p_session_id": sid,
                "p_ended_at": ended_at
            }).to_string();
            match crate::supabase_post(cfg, "rpc/rpc_stop_session_v2", &body, Some(&token), None) {
                Ok(_) => {
                    let _ = delete_pending_session_stop(conn, *id);
                    println!("[cache] ✅ Synced offline session stop for session {}", sid);
                }
                Err(e) => {
                    eprintln!("[cache] Failed to sync offline session stop for session {}: {}", sid, e);
                }
            }
        }
    }

    let samples = match get_unsynced_samples(conn) {
        Ok(s) => s,
        Err(e) => { eprintln!("[cache] get_unsynced error: {}", e); return; }
    };
    if samples.is_empty() { return; }

    let token = auth_token.lock().unwrap().clone().unwrap_or_default();

    let payload: Vec<serde_json::Value> = samples.iter().map(|s| {
        // If the sample is more than 3 minutes old, it was likely cached while offline
        let recorded_at_dt = chrono::DateTime::parse_from_rfc3339(&s.recorded_at).ok();
        let is_delayed = recorded_at_dt.map(|dt| {
            chrono::Utc::now().signed_duration_since(dt) > chrono::Duration::minutes(3)
        }).unwrap_or(false);

        serde_json::json!({
            "session_id":       s.session_id,
            "recorded_at":      s.recorded_at,
            "mouse_clicks":     s.mouse_clicks,
            "key_presses":      s.key_presses,
            "app_name":         s.app_name,
            "window_title":     s.window_title,
            "domain":           s.domain,
            "idle":             s.idle,
            "activity_percent": s.activity_percent,
            "active_seconds":   s.active_seconds,
            "is_offline":       s.is_offline || is_delayed,
        })
    }).collect();

    let body = serde_json::json!(payload).to_string();

    match crate::supabase_post(cfg, "activity_samples", &body, Some(&token), Some("resolution=ignore-duplicates")) {
        Ok(_) => {
            let ids: Vec<i64> = samples.iter().map(|s| s.id).collect();
            if let Err(e) = mark_synced(conn, &ids) {
                eprintln!("[cache] mark_synced error: {}", e);
            } else {
                println!("[cache] ✅ Synced {} samples to Supabase", ids.len());
            }
        }
        Err(e) => {
            // 409 Conflict: rows already exist on the server from a previous partial sync.
            // 23503 FK violation: the session_id no longer exists in the sessions table.
            // Both cases are unrecoverable — discard to unblock the queue.
            if e.contains("409") || e.contains("duplicate key") {
                println!("[cache] ⚠️ Conflict (already synced). Marking as synced locally.");
                let ids: Vec<i64> = samples.iter().map(|s| s.id).collect();
                let _ = mark_synced(conn, &ids);
            } else if e.contains("23503") || e.contains("foreign key") {
                eprintln!("[cache] ⚠️ FK violation — session_id not found in sessions table. Discarding {} stale samples to unblock queue.", samples.len());
                let ids: Vec<i64> = samples.iter().map(|s| s.id).collect();
                let _ = mark_synced(conn, &ids);
            } else {
                eprintln!("[cache] sync failed (will retry): {}", e);
            }
        }
    }
}

/// Safely syncs by dropping the DB mutex while performing the network request.
/// This prevents blocking the main thread (or IPC thread queue) during long HTTP posts.
pub fn sync_from_arc(
    db_arc: &Arc<Mutex<Option<Connection>>>,
    cfg: &SupabaseConfig,
    auth_token: &Arc<Mutex<Option<String>>>,
) {
    // Prevent concurrent syncs
    let _guard = match SYNC_LOCK.try_lock() {
        Ok(g) => g,
        Err(_) => return, // Already syncing
    };

    let stops = {
        let db_lock = db_arc.lock().unwrap();
        if let Some(conn) = db_lock.as_ref() {
            get_pending_session_stops(conn).unwrap_or_default()
        } else {
            Vec::new()
        }
    };

    if !stops.is_empty() {
        let token = auth_token.lock().unwrap().clone().unwrap_or_default();
        for (id, sid, ended_at) in &stops {
            let body = serde_json::json!({
                "p_session_id": sid,
                "p_ended_at": ended_at
            }).to_string();
            match crate::supabase_post(cfg, "rpc/rpc_stop_session_v2", &body, Some(&token), None) {
                Ok(_) => {
                    let mut db_lock = db_arc.lock().unwrap();
                    if let Some(conn) = db_lock.as_mut() {
                        let _ = delete_pending_session_stop(conn, *id);
                    }
                    println!("[cache] ✅ Synced offline session stop for session {}", sid);
                }
                Err(e) => {
                    eprintln!("[cache] Failed to sync offline session stop for session {}: {}", sid, e);
                }
            }
        }
    }

    let samples = {
        let db_lock = db_arc.lock().unwrap();
        if let Some(conn) = db_lock.as_ref() {
            match get_unsynced_samples(conn) {
                Ok(s) => s,
                Err(e) => { eprintln!("[cache] get_unsynced error: {}", s_format_error(e)); return; }
            }
        } else {
            return;
        }
    }; // DB lock is explicitly DROPPED here before network call!

    if samples.is_empty() { return; }

    let token = auth_token.lock().unwrap().clone().unwrap_or_default();
    
    let payload: Vec<serde_json::Value> = samples.iter().map(|s| {
        // If the sample is more than 3 minutes old, it was likely cached while offline
        let recorded_at_dt = chrono::DateTime::parse_from_rfc3339(&s.recorded_at).ok();
        let is_delayed = recorded_at_dt.map(|dt| {
            chrono::Utc::now().signed_duration_since(dt) > chrono::Duration::minutes(3)
        }).unwrap_or(false);

        serde_json::json!({
            "session_id":       s.session_id,
            "recorded_at":      s.recorded_at,
            "mouse_clicks":     s.mouse_clicks,
            "key_presses":      s.key_presses,
            "app_name":         s.app_name,
            "window_title":     s.window_title,
            "domain":           s.domain,
            "idle":             s.idle,
            "activity_percent": s.activity_percent,
            "active_seconds":   s.active_seconds,
            "is_offline":       s.is_offline || is_delayed,
        })
    }).collect();

    let body = serde_json::json!(payload).to_string();

    match crate::supabase_post(cfg, "activity_samples", &body, Some(&token), Some("resolution=ignore-duplicates")) {
        Ok(_) => {
            let ids: Vec<i64> = samples.iter().map(|s| s.id).collect();
            let mut db_lock = db_arc.lock().unwrap(); // RE-ACQUIRE lock just to mark synced
            if let Some(conn) = db_lock.as_mut() {
                if let Err(e) = mark_synced(conn, &ids) {
                    eprintln!("[cache] mark_synced error: {}", e);
                } else {
                    println!("[cache] ✅ Synced {} samples to Supabase", ids.len());
                }
            }
        }
        Err(e) => {
            // 409 Conflict: already on server. 23503 FK: session gone. Both unrecoverable — discard.
            if e.contains("409") || e.contains("duplicate key") {
                println!("[cache] ⚠️ Conflict (already synced). Marking as synced locally.");
                let ids: Vec<i64> = samples.iter().map(|s| s.id).collect();
                let mut db_lock = db_arc.lock().unwrap();
                if let Some(conn) = db_lock.as_mut() {
                    let _ = mark_synced(conn, &ids);
                }
            } else if e.contains("23503") || e.contains("foreign key") {
                eprintln!("[cache] ⚠️ FK violation — session_id not found. Discarding ALL stale samples for these sessions to unblock queue.");
                let mut db_lock = db_arc.lock().unwrap();
                if let Some(conn) = db_lock.as_mut() {
                    if let Ok(tx) = conn.transaction() {
                        for s in &samples {
                            let _ = tx.execute("UPDATE activity_samples SET synced = 1 WHERE session_id = ?1", rusqlite::params![s.session_id]);
                        }
                        let _ = tx.commit();
                    }
                }
            } else {
                eprintln!("[cache] sync failed (will retry): {}", e);
            }
        }
    }
}

fn s_format_error(e: rusqlite::Error) -> String {
    e.to_string()
}

pub fn cache_session_stop(conn: &Connection, session_id: &str, ended_at: &str) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO pending_session_stops (session_id, ended_at) VALUES (?1, ?2)",
        params![session_id, ended_at],
    )?;
    Ok(())
}

pub fn get_pending_session_stops(conn: &Connection) -> rusqlite::Result<Vec<(i64, String, String)>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, ended_at FROM pending_session_stops ORDER BY id ASC LIMIT 10"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
        ))
    })?;
    rows.collect()
}

pub fn delete_pending_session_stop(conn: &Connection, id: i64) -> rusqlite::Result<()> {
    conn.execute("DELETE FROM pending_session_stops WHERE id = ?1", params![id])?;
    Ok(())
}

