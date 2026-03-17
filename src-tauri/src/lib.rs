// lib.rs — DigiReps Tracker (Tauri v2)
// Phase 2: IPC commands replacing Electron ipcMain handlers
// Phase 3: Native activity tracking via Rust (rdev + Win32)
// Phase 4: Offline SQLite cache with 30s sync loop
// Phase 5: Notifications + Auto-Updater

mod tracker;
mod cache;
mod updater;

use tauri::Manager;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

// ─── Shared App State ─────────────────────────────────────────────────────────
pub struct AppState {
    pub active_session_id: Option<String>,
    /// JWT stored as an Arc so cache.rs sync loop can read it
    pub auth_token: Arc<Mutex<Option<String>>>,
    pub api_url: String,
    /// Set to false to stop tracker + sync loops
    pub tracking_running: Arc<Mutex<bool>>,
    /// Shared input event counts for the rdev listener
    pub counts: Arc<Mutex<tracker::TrackerCounts>>,
    /// Shared SQLite connection for cache operations
    pub db: Arc<Mutex<Option<rusqlite::Connection>>>,
}

impl Default for AppState {
    fn default() -> Self {
        let db = cache::init_db()
            .map(|c| Some(c))
            .unwrap_or_else(|e| { eprintln!("[cache] DB init error: {}", e); None });

        Self {
            active_session_id: None,
            auth_token: Arc::new(Mutex::new(None)),
            api_url: std::env::var("VITE_API_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:3001".to_string()),
            tracking_running: Arc::new(Mutex::new(false)),
            counts: Arc::new(Mutex::new(tracker::TrackerCounts::default())),
            db: Arc::new(Mutex::new(db)),
        }
    }
}

// ─── Response types ────────────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Debug, Clone)]
struct SessionResponse {
    session_id: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct TrackingResult {
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ─── Simple HTTP POST helper (no external deps) ────────────────────────────────
pub fn http_post(url: &str, body: Option<&str>) -> Result<String, String> {
    use std::io::{Read, Write};
    use std::net::TcpStream;

    let url_str = url.replace("http://", "");
    let parts: Vec<&str> = url_str.splitn(2, '/').collect();
    let host_port = parts[0];
    let path = format!("/{}", parts.get(1).unwrap_or(&""));
    let host = host_port.split(':').next().unwrap_or("localhost");
    let body_str = body.unwrap_or("{}");

    let stream = TcpStream::connect(host_port)
        .map_err(|e| format!("Cannot connect to backend: {}", e))?;
    stream.set_write_timeout(Some(std::time::Duration::from_secs(5))).ok();
    stream.set_read_timeout(Some(std::time::Duration::from_secs(10))).ok();

    let request = format!(
        "POST {} HTTP/1.1\r\nHost: {}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        path, host, body_str.len(), body_str
    );

    let mut stream = stream;
    stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;

    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|e| e.to_string())?;

    let body_start = response.find("\r\n\r\n").map(|i| i + 4).unwrap_or(0);
    let status_code: u16 = response.lines().next().unwrap_or("")
        .split_whitespace().nth(1)
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);
    let resp_body = response[body_start..].to_string();

    if status_code >= 200 && status_code < 300 {
        Ok(resp_body)
    } else {
        Err(serde_json::from_str::<serde_json::Value>(&resp_body)
            .ok()
            .and_then(|v| v["error"].as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| format!("Backend returned {}", status_code)))
    }
}

// ─── IPC Commands ─────────────────────────────────────────────────────────────

/// invoke('start_tracking', { projectId, userId, token })
#[tauri::command]
fn start_tracking(
    app: tauri::AppHandle,
    state: tauri::State<'_, Mutex<AppState>>,
    project_id: String,
    user_id: String,
    token: String,
) -> TrackingResult {
    let (api_url, counts, running, auth_arc, db_arc) = {
        let mut s = state.lock().unwrap();
        *s.auth_token.lock().unwrap() = Some(token);
        (
            s.api_url.clone(),
            Arc::clone(&s.counts),
            Arc::clone(&s.tracking_running),
            Arc::clone(&s.auth_token),
            Arc::clone(&s.db),
        )
    };

    // Create backend session
    let body = serde_json::json!({ "user_id": user_id, "project_id": project_id }).to_string();
    match http_post(&format!("{}/api/sessions", api_url), Some(&body)) {
        Ok(resp_body) => {
            match serde_json::from_str::<SessionResponse>(&resp_body) {
                Ok(data) => {
                    let session_id = data.session_id.clone();
                    {
                        let mut s = state.lock().unwrap();
                        s.active_session_id = Some(session_id.clone());
                        *s.tracking_running.lock().unwrap() = true;
                    }

                    // Reset counters
                    { let mut c = counts.lock().unwrap(); c.mouse_count = 0; c.keyboard_count = 0; }

                    // Start native activity tracking
                    tracker::start_sample_loop(
                        app.clone(), Arc::clone(&counts), session_id.clone(),
                        api_url.clone(), Arc::clone(&running), 60_000, Arc::clone(&db_arc),
                        Arc::clone(&auth_arc),
                    );
                    tracker::start_screenshot_loop(
                        app.clone(), session_id.clone(), api_url.clone(), Arc::clone(&running),
                    );

                    // Start offline sync loop (30s interval)
                    cache::start_sync_loop(api_url.clone(), Arc::clone(&auth_arc), Arc::clone(&running));

                    TrackingResult { status: "running".to_string(), session_id: Some(session_id), error: None }
                }
                Err(e) => TrackingResult {
                    status: "error".to_string(), session_id: None,
                    error: Some(format!("Parse error: {}", e)),
                },
            }
        }
        Err(msg) => TrackingResult { status: "error".to_string(), session_id: None, error: Some(msg) },
    }
}

/// invoke('stop_tracking')
#[tauri::command]
fn stop_tracking(state: tauri::State<'_, Mutex<AppState>>) -> TrackingResult {
    let (api_url, session_id, running) = {
        let mut s = state.lock().unwrap();
        (s.api_url.clone(), s.active_session_id.take(), Arc::clone(&s.tracking_running))
    };
    *running.lock().unwrap() = false;
    if let Some(sid) = session_id {
        let _ = http_post(&format!("{}/api/sessions/{}/end", api_url, sid), None);
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
    let (api_url, session_id, counts, running, auth_arc, db_arc) = {
        let s = state.lock().unwrap();
        (
            s.api_url.clone(),
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
        api_url.clone(), Arc::clone(&running), 60_000, Arc::clone(&db_arc), Arc::clone(&auth_arc),
    );
    tracker::start_screenshot_loop(app.clone(), sid.clone(), api_url.clone(), Arc::clone(&running));
    cache::start_sync_loop(api_url.clone(), Arc::clone(&auth_arc), Arc::clone(&running));

    TrackingResult { status: "running".to_string(), session_id: Some(sid), error: None }
}

/// invoke('show_notification_cmd', { title, body })
#[tauri::command]
fn show_notification_cmd(
    app: tauri::AppHandle,
    title: String,
    body: String,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

/// invoke('install_update') — downloads and installs the pending update
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
            // Start rdev global input listener (runs for app lifetime)
            tracker::spawn_input_listener(Arc::clone(&counts));

            // Spawn background update check (15s delay)
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
        .expect("error while running DigiReps Tracker");
}
