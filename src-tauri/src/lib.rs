// lib.rs — Trackora (Tauri v2)
// Phases 2-5: IPC, native tracking, SQLite cache, notifications, auto-updater
// Phase 6+: Direct Supabase REST API — no Express backend needed

mod tracker;
mod cache;
mod updater;

use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

// ─── Shared App State ─────────────────────────────────────────────────────────
pub struct AppState {
    pub active_session_id: Option<String>,
    /// User's Supabase JWT — stored as Arc so cache.rs sync loop can read it
    pub auth_token: Arc<Mutex<Option<String>>>,
    /// https://<project>.supabase.co
    pub supabase_url: String,
    /// public anon key (safe to embed in app, RLS enforces access)
    pub supabase_anon_key: String,
    pub tracking_running: Arc<Mutex<bool>>,
    pub counts: Arc<Mutex<tracker::TrackerCounts>>,
    pub db: Arc<Mutex<Option<rusqlite::Connection>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let db = cache::init_db()
            .map(Some)
            .unwrap_or_else(|e| { eprintln!("[cache] DB init error: {}", e); None });

        Self {
            active_session_id: None,
            auth_token: Arc::new(Mutex::new(None)),
            supabase_url: std::env::var("VITE_SUPABASE_URL")
                .unwrap_or_else(|_| "https://your-project.supabase.co".to_string()),
            supabase_anon_key: std::env::var("VITE_SUPABASE_ANON_KEY")
                .unwrap_or_default(),
            tracking_running: Arc::new(Mutex::new(false)),
            counts: Arc::new(Mutex::new(tracker::TrackerCounts::default())),
            db: Arc::new(Mutex::new(db)),
        }
    }
}

// ─── Supabase API config (passed around instead of a bare URL string) ─────────
#[derive(Clone, Debug)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
}

// ─── Response types ────────────────────────────────────────────────────────────
/// Supabase PostgREST returns an array on insert with Prefer: return=representation
#[derive(Serialize, Deserialize, Debug, Clone)]
struct SupabaseSessionRow {
    pub id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TrackingResult {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ─── Supabase REST helpers ─────────────────────────────────────────────────────

/// POST to a Supabase PostgREST endpoint.
/// Returns the raw response body on success.
pub fn supabase_post(
    cfg: &SupabaseConfig,
    table: &str,
    body: &str,
    auth_token: Option<&str>,
    prefer: Option<&str>,
) -> Result<String, String> {
    let url = format!("{}/rest/v1/{}", cfg.url, table);

    let mut req = ureq::post(&url)
        .set("apikey", &cfg.anon_key)
        .set("Content-Type", "application/json");

    if let Some(token) = auth_token {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }
    if let Some(p) = prefer {
        req = req.set("Prefer", p);
    }

    req.send_string(body)
        .map_err(|e| format!("Supabase POST error: {}", e))
        .and_then(|resp| resp.into_string().map_err(|e| e.to_string()))
}

/// PATCH a Supabase PostgREST row by filter.
/// `filter` e.g. `"id=eq.my-uuid"`
pub fn supabase_patch(
    cfg: &SupabaseConfig,
    table: &str,
    filter: &str,
    body: &str,
    auth_token: Option<&str>,
) -> Result<String, String> {
    let url = format!("{}/rest/v1/{}?{}", cfg.url, table, filter);

    let mut req = ureq::patch(&url)
        .set("apikey", &cfg.anon_key)
        .set("Content-Type", "application/json");

    if let Some(token) = auth_token {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }

    req.send_string(body)
        .map_err(|e| format!("Supabase PATCH error: {}", e))
        .and_then(|resp| resp.into_string().map_err(|e| e.to_string()))
}

// ─── IPC Commands ─────────────────────────────────────────────────────────────

/// invoke('start_tracking', { projectId, userId, token })
/// Creates a session row in Supabase and starts tracker threads.
#[tauri::command]
fn start_tracking(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    user_id: String,
    token: String,
) -> TrackingResult {
    let (cfg, counts, running, auth_arc, db_arc) = {
        let mut s = state.lock().unwrap();
        *s.auth_token.lock().unwrap() = Some(token.clone());
        (
            SupabaseConfig { url: s.supabase_url.clone(), anon_key: s.supabase_anon_key.clone() },
            Arc::clone(&s.counts),
            Arc::clone(&s.tracking_running),
            Arc::clone(&s.auth_token),
            Arc::clone(&s.db),
        )
    };

    // Insert session row — PostgREST returns array with Prefer: return=representation
    let now = chrono::Utc::now().to_rfc3339();
    let body = serde_json::json!({
        "user_id": user_id,
        "project_id": project_id,
        "started_at": now,
    }).to_string();

    match supabase_post(&cfg, "sessions", &body, Some(&token), Some("return=representation")) {
        Ok(resp_body) => {
            // PostgREST returns an array: [{...}]
            let rows: Result<Vec<SupabaseSessionRow>, _> = serde_json::from_str(&resp_body);
            match rows.ok().and_then(|mut v| v.pop()) {
                Some(row) => {
                    let session_id = row.id.clone();
                    {
                        let mut s = state.lock().unwrap();
                        s.active_session_id = Some(session_id.clone());
                        *s.tracking_running.lock().unwrap() = true;
                    }

                    // Reset counters
                    { let mut c = counts.lock().unwrap(); c.mouse_count = 0; c.keyboard_count = 0; }

                    // Start native trackers
                    tracker::start_sample_loop(
                        app.clone(), Arc::clone(&counts), session_id.clone(),
                        cfg.clone(), Arc::clone(&running), 60_000,
                        Arc::clone(&db_arc), Arc::clone(&auth_arc),
                    );
                    tracker::start_screenshot_loop(
                        app.clone(), session_id.clone(), cfg.clone(), Arc::clone(&running),
                    );

                    // 30s offline sync loop
                    cache::start_sync_loop(cfg.clone(), Arc::clone(&auth_arc), Arc::clone(&running));

                    TrackingResult { status: "running".to_string(), session_id: Some(session_id), error: None }
                }
                None => TrackingResult {
                    status: "error".to_string(), session_id: None,
                    error: Some(format!("Unexpected response from Supabase: {}", resp_body)),
                },
            }
        }
        Err(msg) => TrackingResult { status: "error".to_string(), session_id: None, error: Some(msg) },
    }
}

/// invoke('stop_tracking')
#[tauri::command]
fn stop_tracking(state: tauri::State<'_, Mutex<AppState>>) -> TrackingResult {
    let (cfg, token, session_id, running) = {
        let mut s = state.lock().unwrap();
        let token = s.auth_token.lock().unwrap().clone();
        let cfg = SupabaseConfig { url: s.supabase_url.clone(), anon_key: s.supabase_anon_key.clone() };
        (cfg, token, s.active_session_id.take(), Arc::clone(&s.tracking_running))
    };

    *running.lock().unwrap() = false;

    if let Some(sid) = session_id {
        let ended = chrono::Utc::now().to_rfc3339();
        let body = serde_json::json!({ "ended_at": ended }).to_string();
        let _ = supabase_patch(&cfg, "sessions", &format!("id=eq.{}", sid), &body, token.as_deref());
    }

    TrackingResult { status: "stopped".to_string(), session_id: None, error: None }
}

/// invoke('pause_tracking')
#[tauri::command]
fn pause_tracking(state: tauri::State<'_, Mutex<AppState>>) -> TrackingResult {
    *state.lock().unwrap().tracking_running.lock().unwrap() = false;
    TrackingResult { status: "paused".to_string(), session_id: None, error: None }
}

/// invoke('resume_tracking')
#[tauri::command]
fn resume_tracking(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<AppState>>,
) -> TrackingResult {
    let (cfg, session_id, counts, running, auth_arc, db_arc) = {
        let s = state.lock().unwrap();
        (
            SupabaseConfig { url: s.supabase_url.clone(), anon_key: s.supabase_anon_key.clone() },
            s.active_session_id.clone(),
            Arc::clone(&s.counts),
            Arc::clone(&s.tracking_running),
            Arc::clone(&s.auth_token),
            Arc::clone(&s.db),
        )
    };

    let sid = match session_id {
        Some(id) => id,
        None => return TrackingResult {
            status: "error".to_string(), session_id: None,
            error: Some("No active session to resume".to_string()),
        },
    };

    *running.lock().unwrap() = true;

    tracker::start_sample_loop(
        app.clone(), Arc::clone(&counts), sid.clone(),
        cfg.clone(), Arc::clone(&running), 60_000, Arc::clone(&db_arc), Arc::clone(&auth_arc),
    );
    tracker::start_screenshot_loop(app.clone(), sid.clone(), cfg.clone(), Arc::clone(&running));
    cache::start_sync_loop(cfg.clone(), Arc::clone(&auth_arc), Arc::clone(&running));

    TrackingResult { status: "running".to_string(), session_id: Some(sid), error: None }
}

/// invoke('show_notification_cmd', { title, body })
#[tauri::command]
fn show_notification_cmd(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
}

/// invoke('install_update')
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    updater::install_update(app).await
}

/// invoke('set_auth_token', { token })
#[tauri::command]
fn set_auth_token(state: tauri::State<'_, Mutex<AppState>>, token: String) -> Result<(), String> {
    *state.lock().unwrap().auth_token.lock().unwrap() = Some(token);
    Ok(())
}

// ─── App entry point ──────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();
    let counts = Arc::clone(&state.counts);

    tauri::Builder::default()
        .manage(Mutex::new(state))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(move |app| {
            tracker::spawn_input_listener(Arc::clone(&counts));

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                updater::check_for_updates(app_handle).await;
            });

            #[cfg(debug_assertions)]
            {
                let window = app.get_webview_window("main").unwrap();
                window.open_devtools();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_tracking,
            stop_tracking,
            pause_tracking,
            resume_tracking,
            show_notification_cmd,
            install_update,
            set_auth_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Trackora");
}
