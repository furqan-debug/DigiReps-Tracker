// cache.rs — Phase 4: Offline SQLite cache + sync loop
// Phase 6+: Syncs directly to Supabase /rest/v1/activity_samples (no Express backend)

use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};

use crate::tracker::ActivitySample;
use crate::SupabaseConfig;

// ─── Row types ─────────────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct CachedSample {
    pub id: i64,
    pub session_id: String,
    pub timestamp: String,
    pub mouse_count: u32,
    pub keyboard_count: u32,
    pub app_name: String,
    pub window_title: String,
    pub domain: String,
    pub idle_flag: bool,
    pub synced: bool,
}

// ─── DB path ───────────────────────────────────────────────────────────────────
fn db_path() -> std::path::PathBuf {
    let base = std::env::var("APPDATA")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    base.join("trackora").join("tracker_cache.sqlite")
}

// ─── Initialize DB ────────────────────────────────────────────────────────────
pub fn init_db() -> rusqlite::Result<Connection> {
    let path = db_path();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let conn = Connection::open(&path)?;
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS activity_samples (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id     TEXT    NOT NULL,
            timestamp      TEXT    NOT NULL,
            mouse_count    INTEGER NOT NULL DEFAULT 0,
            keyboard_count INTEGER NOT NULL DEFAULT 0,
            app_name       TEXT    NOT NULL DEFAULT '',
            window_title   TEXT    NOT NULL DEFAULT '',
            domain         TEXT    NOT NULL DEFAULT '',
            idle_flag      INTEGER NOT NULL DEFAULT 0,
            synced         INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_synced ON activity_samples(synced);",
    )?;
    Ok(conn)
}

// ─── Public API ────────────────────────────────────────────────────────────────
pub fn cache_sample(conn: &Connection, sample: &ActivitySample) -> rusqlite::Result<()> {
    conn.execute(
        "INSERT INTO activity_samples
             (session_id, timestamp, mouse_count, keyboard_count, app_name, window_title, domain, idle_flag, synced)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0)",
        params![
            sample.session_id, sample.timestamp, sample.mouse_count,
            sample.keyboard_count, sample.app_name, sample.window_title,
            sample.domain, sample.idle_flag as i32,
        ],
    )?;
    Ok(())
}

pub fn get_unsynced_samples(conn: &Connection) -> rusqlite::Result<Vec<CachedSample>> {
    let mut stmt = conn.prepare(
        "SELECT id, session_id, timestamp, mouse_count, keyboard_count,
                app_name, window_title, domain, idle_flag, synced
         FROM activity_samples WHERE synced = 0 ORDER BY id ASC LIMIT 50"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(CachedSample {
            id: row.get(0)?,
            session_id: row.get(1)?,
            timestamp: row.get(2)?,
            mouse_count: row.get::<_, u32>(3)?,
            keyboard_count: row.get::<_, u32>(4)?,
            app_name: row.get(5)?,
            window_title: row.get(6)?,
            domain: row.get(7)?,
            idle_flag: row.get::<_, i32>(8)? != 0,
            synced: row.get::<_, i32>(9)? != 0,
        })
    })?;
    rows.collect()
}

pub fn mark_synced(conn: &Connection, ids: &[i64]) -> rusqlite::Result<()> {
    if ids.is_empty() { return Ok(()); }
    for id in ids {
        conn.execute("UPDATE activity_samples SET synced = 1 WHERE id = ?1", params![id])?;
    }
    // Prune synced rows older than 7 days
    let cutoff = chrono::Utc::now()
        .checked_sub_signed(chrono::Duration::days(7))
        .map(|dt| dt.to_rfc3339())
        .unwrap_or_default();
    conn.execute(
        "DELETE FROM activity_samples WHERE synced = 1 AND timestamp < ?1",
        params![cutoff],
    )?;
    Ok(())
}

// ─── 30s Sync Loop ─────────────────────────────────────────────────────────────
/// Spawns a background thread that syncs unsynced samples to Supabase every 30s.
pub fn start_sync_loop(
    cfg: SupabaseConfig,
    auth_token: Arc<Mutex<Option<String>>>,
    running: Arc<Mutex<bool>>,
) {
    thread::spawn(move || {
        let conn = match init_db() {
            Ok(c) => c,
            Err(e) => { eprintln!("[cache] Failed to open DB: {}", e); return; }
        };
        loop {
            thread::sleep(Duration::from_secs(30));
            if !*running.lock().unwrap() { break; }
            sync_once(&conn, &cfg, &auth_token);
        }
    });
}

/// One sync pass — inserts unsynced samples as a batch into Supabase.
/// PostgREST supports multi-row inserts by sending a JSON array.
pub fn sync_once(
    conn: &Connection,
    cfg: &SupabaseConfig,
    auth_token: &Arc<Mutex<Option<String>>>,
) {
    let samples = match get_unsynced_samples(conn) {
        Ok(s) => s,
        Err(e) => { eprintln!("[cache] get_unsynced error: {}", e); return; }
    };
    if samples.is_empty() { return; }

    let token = auth_token.lock().unwrap().clone().unwrap_or_default();

    // Build JSON array — Supabase PostgREST accepts array inserts natively
    let payload: Vec<serde_json::Value> = samples.iter().map(|s| {
        serde_json::json!({
            "session_id":      s.session_id,
            "timestamp":       s.timestamp,
            "mouse_count":     s.mouse_count,
            "keyboard_count":  s.keyboard_count,
            "app_name":        s.app_name,
            "window_title":    s.window_title,
            "domain":          s.domain,
            "idle_flag":       s.idle_flag,
        })
    }).collect();

    let body = serde_json::json!(payload).to_string();

    match crate::supabase_post(cfg, "activity_samples", &body, Some(&token), None) {
        Ok(_) => {
            let ids: Vec<i64> = samples.iter().map(|s| s.id).collect();
            if let Err(e) = mark_synced(conn, &ids) {
                eprintln!("[cache] mark_synced error: {}", e);
            } else {
                println!("[cache] ✅ Synced {} samples to Supabase", ids.len());
            }
        }
        Err(e) => eprintln!("[cache] sync failed (will retry): {}", e),
    }
}
