// lib.rs — TrackOwl (Tauri v2)
// Phases 2-5: IPC, native tracking, SQLite cache, notifications, auto-updater
// Phase 6+: Direct Supabase REST API — no Express backend needed

mod tracker;
mod cache;
mod block_accumulator;
#[cfg(not(feature = "app-store"))]
mod updater;

use tauri::{Manager, Emitter};
use serde::{Deserialize, Serialize};
use serde_json;
use std::sync::{Arc, Mutex};
use std::thread;

// ─── Shared App State ─────────────────────────────────────────────────────────
pub struct AppState {
    pub active_session_id: Option<String>,
    /// User's Supabase JWT — stored as Arc so cache.rs sync loop can read it
    pub auth_token: Arc<Mutex<Option<String>>>,
    pub supabase_url: String,
    pub supabase_anon_key: String,
    pub user_id: Option<String>,
    pub org_id: Option<String>,
    pub tracking_running: Arc<Mutex<bool>>,
    /// Controls the always-on sync loop — independent of tracking sessions.
    /// Set true when the user logs in (set_auth_token), false only on app exit.
    pub sync_running: Arc<Mutex<bool>>,
    pub counts: Arc<tracker::TrackerCounts>,
    pub db: Arc<Mutex<Option<rusqlite::Connection>>>,
    pub is_idle_monitoring: Arc<Mutex<bool>>,
    pub last_idle_limit: Arc<Mutex<u32>>,
    pub plan_type: Arc<Mutex<String>>,
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
                .unwrap_or_default(),
            supabase_anon_key: std::env::var("VITE_SUPABASE_ANON_KEY")
                .unwrap_or_default(),
            user_id: None,
            org_id: None,
            tracking_running: Arc::new(Mutex::new(false)),
            sync_running: Arc::new(Mutex::new(false)),
            counts: Arc::new(tracker::TrackerCounts::default()),
            db: Arc::new(Mutex::new(db)),
            is_idle_monitoring: Arc::new(Mutex::new(false)),
            last_idle_limit: Arc::new(Mutex::new(10)),
            plan_type: Arc::new(Mutex::new("Basic".to_string())),
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

pub fn supabase_post(
    cfg: &SupabaseConfig,
    table: &str,
    body: &str,
    auth_token: Option<&str>,
    prefer: Option<&str>,
) -> Result<String, String> {
    let url = format!("{}/rest/v1/{}", cfg.url, table);

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .build();

    let mut req = agent.post(&url)
        .set("apikey", &cfg.anon_key)
        .set("Content-Type", "application/json");

    if let Some(token) = auth_token {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }
    if let Some(p) = prefer {
        req = req.set("Prefer", p);
    }

    match req.send_string(body) {
        Ok(resp) => resp.into_string().map_err(|e| e.to_string()),
        Err(ureq::Error::Status(_code, resp)) => {
            let body = resp.into_string().unwrap_or_else(|_| "Unknown error body".to_string());
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(msg) = json.get("message").and_then(|m| m.as_str()) {
                    return Err(msg.to_string());
                }
            }
            Err(format!("Supabase error: {}", body))
        }
        Err(e) => Err(format!("Supabase transport error: {}", e)),
    }
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

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .build();

    let mut req = agent.patch(&url)
        .set("apikey", &cfg.anon_key)
        .set("Content-Type", "application/json");

    if let Some(token) = auth_token {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }

    match req.send_string(body) {
        Ok(resp) => resp.into_string().map_err(|e| e.to_string()),
        Err(ureq::Error::Status(_code, resp)) => {
            let body = resp.into_string().unwrap_or_else(|_| "Unknown error body".to_string());
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(msg) = json.get("message").and_then(|m| m.as_str()) {
                    return Err(msg.to_string());
                }
            }
            Err(format!("Supabase error: {}", body))
        }
        Err(e) => Err(format!("Supabase transport error: {}", e)),
    }
}

/// Robust stop and sync logic used on exit or manual stop.
fn stop_and_sync_internal(state_handle: &Mutex<AppState>) {
    let (cfg, token, session_id, running, sync_running, db_arc, auth_token_arc) = {
        let mut s = state_handle.lock().unwrap();
        let token = s.auth_token.lock().unwrap().clone();
        let cfg = SupabaseConfig { 
            url: s.supabase_url.clone(), 
            anon_key: s.supabase_anon_key.clone() 
        };
        let sid = s.active_session_id.take();
        (cfg, token, sid, Arc::clone(&s.tracking_running), Arc::clone(&s.sync_running), Arc::clone(&s.db), Arc::clone(&s.auth_token))
    };
    
    *running.lock().unwrap() = false;
    // Stop the always-on sync loop on app exit (not on stop_tracking)
    *sync_running.lock().unwrap() = false;
    if let Some(sid) = session_id {
        println!("[lib] 🛑 Stopping session via RPC: {}", sid);
        let body = serde_json::json!({ "p_session_id": sid }).to_string();
        let _ = supabase_post(&cfg, "rpc/rpc_stop_session", &body, token.as_deref(), None);
    }

    println!("[lib] 🔄 Final sync of cached samples...");
    cache::sync_from_arc(&db_arc, &cfg, &auth_token_arc);
}

/// GET from a Supabase PostgREST endpoint.
pub fn supabase_get(
    cfg: &SupabaseConfig,
    table: &str,
    filter: &str,
    auth_token: Option<&str>,
) -> Result<String, String> {
    let url = format!("{}/rest/v1/{}?{}", cfg.url, table, filter);

    let agent = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(10))
        .build();

    let mut req = agent.get(&url)
        .set("apikey", &cfg.anon_key);

    if let Some(token) = auth_token {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }

    match req.call() {
        Ok(resp) => resp.into_string().map_err(|e| e.to_string()),
        Err(ureq::Error::Status(_code, resp)) => {
            let body = resp.into_string().unwrap_or_else(|_| "Unknown error body".to_string());
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                if let Some(msg) = json.get("message").and_then(|m| m.as_str()) {
                    return Err(msg.to_string());
                }
            }
            Err(format!("Supabase error: {}", body))
        }
        Err(e) => Err(format!("Supabase transport error: {}", e)),
    }
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
    // Check if tracking is already running to prevent duplicate loops
    {
        let is_running = state.lock().unwrap().tracking_running.lock().unwrap().clone();
        if is_running {
            return TrackingResult { 
                status: "running".to_string(), 
                session_id: state.lock().unwrap().active_session_id.clone(), 
                error: None 
            };
        }
    }

    #[cfg(all(target_os = "macos", not(feature = "app-store")))]
    {
        println!("[tracker-diag] start_tracking called. Checking macOS permissions.");
        if !tracker::check_macos_accessibility() {
            println!("[tracker-diag] start_tracking: Accessibility false. Opening settings and returning error.");
            tracker::open_macos_accessibility_settings();
            return TrackingResult {
                status: "error".to_string(),
                session_id: None,
                error: Some("macOS Accessibility Permission Required: Please enable 'TrackOwl' in the System Settings window that just opened, then try starting again.".to_string()),
            };
        }
        println!("[tracker-diag] start_tracking: Accessibility true. Proceeding to screen recording check.");

        if !tracker::check_macos_screen_recording() {
            // CGRequestScreenCaptureAccess (now used in check_macos_screen_recording) 
            // automatically prompts the user if permission is missing.
            return TrackingResult {
                status: "error".to_string(),
                session_id: None,
                error: Some("macOS Screen Recording Permission Required: Please grant Screen Recording permission to 'TrackOwl' in System Settings (Privacy & Security -> Screen Recording), then try starting again.".to_string()),
            };
        }
    }
    #[cfg(all(target_os = "macos", feature = "app-store"))]
    {
        // App Store build: skip Accessibility permission check (not needed for
        // CGEventSourceCounterForEventType-based input monitoring).
        // Screen recording is still required for screenshots.
        if !tracker::check_macos_screen_recording() {
            return TrackingResult {
                status: "error".to_string(),
                session_id: None,
                error: Some("macOS Screen Recording Permission Required: Please grant Screen Recording permission to 'TrackOwl' in System Settings (Privacy & Security -> Screen Recording), then try starting again.".to_string()),
            };
        }
    }
    
    let (cfg, counts, running, auth_arc, db_arc): (SupabaseConfig, Arc<tracker::TrackerCounts>, Arc<Mutex<bool>>, Arc<Mutex<Option<String>>>, Arc<Mutex<Option<rusqlite::Connection>>>) = {
        let s = state.lock().unwrap();
        *s.auth_token.lock().unwrap() = Some(token.clone());
        let res = (
            SupabaseConfig { url: s.supabase_url.clone(), anon_key: s.supabase_anon_key.clone() },
            Arc::clone(&s.counts),
            Arc::clone(&s.tracking_running),
            Arc::clone(&s.auth_token),
            Arc::clone(&s.db),
        );
        res
    };
    
    // ─── Phase 1: Clean/Start Session Atomic ─────────────────────────────────────
    // We now use an RPC function to ensure atomicity (closes old sessions and starts new one)

    // Fetch organization_id, plan_type, org_timezone, and idle_policy in one call
    let (org_id, plan_type, org_timezone, idle_policy): (Option<String>, String, String, String) = match crate::supabase_get(
        &cfg,
        "projects",
        &format!("id=eq.{}&select=organization_id,organizations(plan_type,settings)", project_id),
        Some(&token),
    ) {
        Ok(resp_body) => {
            let json_rows: serde_json::Value = serde_json::from_str(&resp_body).unwrap_or(serde_json::json!([]));
            let first = json_rows.get(0);
            let id = first.and_then(|r| r.get("organization_id")).and_then(|v| v.as_str()).map(|s| s.to_string());
            let plan = first.and_then(|r| r.get("organizations")).and_then(|v| v.get("plan_type")).and_then(|v| v.as_str()).unwrap_or("Basic").to_string();
            let tz = first.and_then(|r| r.get("organizations")).and_then(|v| v.get("settings")).and_then(|s| s.get("orgTimezone")).and_then(|v| v.as_str()).unwrap_or("UTC").to_string();
            println!("[lib] 🔍 Organization lookup for project {}: {:?}, Plan: {}, TZ: {}", project_id, id, plan, tz);
            (id, plan, tz, "never".to_string()) // idle_policy fetched below
        }
        Err(e) => {
            println!("[lib] ❌ Organization lookup FAILED for project {}: {}", project_id, e);
            (None, "Basic".to_string(), "UTC".to_string(), "never".to_string())
        }
    };

    // Fetch member-level idle policy (keep_idle_mode: "always" | "prompt" | "never")
    let idle_policy = if let Some(ref oid) = org_id {
        match crate::supabase_get(
            &cfg,
            "members",
            &format!("or=(id.eq.{},auth_user_id.eq.{})&organization_id=eq.{}&select=keep_idle_mode&limit=1", user_id, user_id, oid),
            Some(&token),
        ) {
            Ok(body) => {
                let rows: serde_json::Value = serde_json::from_str(&body).unwrap_or(serde_json::json!([]));
                let policy = rows.get(0)
                    .and_then(|r| r.get("keep_idle_mode"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("prompt")
                    .to_string();
                println!("[lib] 🔍 Member idle policy: {}", policy);
                policy
            }
            Err(_) => idle_policy,
        }
    } else {
        idle_policy
    };

    // Guard: org_id must be present — sessions.organization_id is NOT NULL
    if org_id.is_none() {
        return TrackingResult {
            status: "error".to_string(),
            session_id: None,
            error: Some("Your account is not linked to an organization. Please contact your administrator.".to_string()),
        };
    }

    // Get public IP
    let ip_address: Option<String> = ureq::get("https://api.ipify.org")
        .call()
        .ok()
        .and_then(|r| r.into_string().ok());

    let body = serde_json::json!({
        "p_user_id": user_id,
        "p_project_id": project_id,
        "p_organization_id": org_id,
        "p_ip_address": ip_address,
        "p_app_version": env!("CARGO_PKG_VERSION"),
        "p_os_platform": std::env::consts::OS,
    }).to_string();

    match supabase_post(&cfg, "rpc/rpc_start_session", &body, Some(&token), None) {
        Ok(resp_body) => {
            // RPC returns the JSON result directly: {"id": "...", "started_at": "..."}
            let row: Result<SupabaseSessionRow, _> = serde_json::from_str(&resp_body);
            match row {
                Ok(row) => {
                    let session_id: String = row.id.clone();
                    {
                        let mut s = state.lock().unwrap();
                        s.active_session_id = Some(session_id.clone());
                        s.user_id = Some(user_id.clone());
                        s.org_id = org_id.clone();
                        *s.plan_type.lock().unwrap() = plan_type.clone();
                        *s.tracking_running.lock().unwrap() = true;
                    }

                    // Reset counters atomics
                    counts.mouse_count.store(0, std::sync::atomic::Ordering::Relaxed);
                    counts.keyboard_count.store(0, std::sync::atomic::Ordering::Relaxed);
                    counts.active_seconds.store(0, std::sync::atomic::Ordering::Relaxed);

                    // Spawn the input listener since we are starting tracking and permissions are verified!
                    tracker::spawn_input_listener(Arc::clone(&counts));

                    // Start native trackers
                    tracker::start_sample_loop_inner(
                        app.clone(), Arc::clone(&counts), session_id.clone(),
                        cfg.clone(), Arc::clone(&running), 60_000,
                        Arc::clone(&db_arc), Arc::clone(&auth_arc),
                        plan_type.clone(),
                        org_timezone.clone(),
                        idle_policy.clone(),
                    );
                    tracker::start_screenshot_loop(
                        app.clone(), session_id.clone(), cfg.clone(), Arc::clone(&running), 
                        Arc::clone(&auth_arc), org_id, user_id.clone(),
                        plan_type.clone(),
                    );

                    // The always-on sync loop is started in set_auth_token.
                    // No need to start a new one here — it is already running.

                    TrackingResult { status: "running".to_string(), session_id: Some(session_id), error: None }
                }
                Err(e) => TrackingResult {
                    status: "error".to_string(), session_id: None,
                    error: Some(format!("Failed to parse RPC response: {} (Body: {})", e, resp_body)),
                },
            }
        }
        Err(msg) => TrackingResult { status: "error".to_string(), session_id: None, error: Some(msg.to_string()) },
    }
}

/// invoke('stop_tracking')
#[tauri::command]
fn stop_tracking(app: tauri::AppHandle, state: tauri::State<'_, Mutex<AppState>>) -> TrackingResult {
    let (cfg, auth_arc, session_id, running, db_arc, user_id, org_id, plan_type) = {
        let mut s = state.lock().unwrap();
        let res = (
            SupabaseConfig { url: s.supabase_url.clone(), anon_key: s.supabase_anon_key.clone() },
            Arc::clone(&s.auth_token),
            s.active_session_id.take(),
            Arc::clone(&s.tracking_running),
            Arc::clone(&s.db),
            s.user_id.clone(),
            s.org_id.clone(),
            s.plan_type.lock().unwrap().clone(),
        );
        res
    };

    *running.lock().unwrap() = false;

    // ── Mandatory STOP screenshot ─────────────────────────────────────────────
    if (plan_type == "Premium" || plan_type == "Trial") && session_id.is_some() && user_id.is_some() {
        let sid = session_id.clone().unwrap();
        let uid = user_id.clone().unwrap();
        let app2      = app.clone();
        let cfg2      = cfg.clone();
        let auth2     = Arc::clone(&auth_arc);
        let org2      = org_id.clone();
        thread::spawn(move || {
            let db_conn = cache::init_db().ok();
            tracker::take_mandatory_screenshot(
                &app2,
                &sid,
                &cfg2,
                &auth2,
                org2.as_deref(),
                &uid,
                "STOP",
                db_conn.as_ref(),
            );
        });
    }

    // Final sync from cache to Supabase
    cache::sync_from_arc(&db_arc, &cfg, &auth_arc);

    if let Some(sid) = session_id {
        let token = auth_arc.lock().unwrap().clone();
        let stop_time = chrono::Utc::now().to_rfc3339();
        let body = serde_json::json!({
            "p_session_id": sid,
            "p_ended_at": stop_time
        }).to_string();

        match supabase_post(&cfg, "rpc/rpc_stop_session_v2", &body, token.as_deref(), None) {
            Ok(_) => {
                println!("[lib] ✅ Successfully stopped session {}", sid);
            }
            Err(e) => {
                println!("[lib] ⚠️ Failed to stop session on server (likely offline): {}. Caching stop locally.", e);
                let db_lock = db_arc.lock().unwrap();
                if let Some(conn) = db_lock.as_ref() {
                    let _ = cache::cache_session_stop(conn, &sid, &stop_time);
                }
            }
        }
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
    let (cfg, session_id, counts, running, auth_arc, db_arc, user_id, org_id, plan_type): (SupabaseConfig, Option<String>, Arc<tracker::TrackerCounts>, Arc<Mutex<bool>>, Arc<Mutex<Option<String>>>, Arc<Mutex<Option<rusqlite::Connection>>>, Option<String>, Option<String>, String) = {
        let s = state.lock().unwrap();
        // Guard against duplicate loops
        if *s.tracking_running.lock().unwrap() {
            return TrackingResult { 
                status: "running".to_string(), 
                session_id: s.active_session_id.clone(), 
                error: None 
            };
        }
        let res = (
            SupabaseConfig { url: s.supabase_url.clone(), anon_key: s.supabase_anon_key.clone() },
            s.active_session_id.clone(),
            Arc::clone(&s.counts),
            Arc::clone(&s.tracking_running),
            Arc::clone(&s.auth_token),
            Arc::clone(&s.db),
            s.user_id.clone(),
            s.org_id.clone(),
            s.plan_type.lock().unwrap().clone(),
        );
        res
    };

    let sid: String = match session_id {
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
        plan_type.clone(),
    );
    tracker::start_screenshot_loop(
        app.clone(), sid.clone(), cfg.clone(), Arc::clone(&running), 
        Arc::clone(&auth_arc), org_id, user_id.unwrap_or_default(),
        plan_type.clone(),
    );
    // The always-on sync loop is started in set_auth_token.
    // No need to start a new one here — it is already running.

    TrackingResult { status: "running".to_string(), session_id: Some(sid), error: None }
}

/// invoke('discard_idle_cache', { sessionId, afterIso })
/// Deletes unsynced idle samples from the local SQLite cache after `after_iso`.
/// Must be called alongside the Supabase delete in discardIdleTime so that
/// stop_tracking's sync doesn't re-upload idle samples that were already discarded.
#[tauri::command]
fn discard_idle_cache(
    state: tauri::State<'_, Mutex<AppState>>,
    session_id: String,
    after_iso: String,
) -> Result<usize, String> {
    let s = state.lock().unwrap();
    let db_guard = s.db.lock().unwrap();
    if let Some(conn) = db_guard.as_ref() {
        cache::purge_samples_after(conn, &session_id, &after_iso)
            .map_err(|e| e.to_string())
    } else {
        Ok(0) // No local cache — nothing to purge
    }
}

/// invoke('show_notification_cmd', { title, body })
#[tauri::command]
fn show_notification_cmd(app: tauri::AppHandle, title: String, body: String) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    app.notification().builder().title(title).body(body).show().map_err(|e: tauri_plugin_notification::Error| e.to_string())
}

/// invoke('install_update')
#[cfg(not(feature = "app-store"))]
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    updater::install_update(app).await
}

/// invoke('set_auth_token', { token, supabaseUrl, supabaseAnonKey })
/// Also starts the always-on background sync loop (if not already running)
/// and fires an immediate sync to flush any SQLite data from the previous session.
#[tauri::command]
fn set_auth_token(
    state: tauri::State<'_, Mutex<AppState>>,
    token: String,
    supabase_url: Option<String>,
    supabase_anon_key: Option<String>,
) -> Result<(), String> {
    let (cfg, auth_arc, sync_running_arc, db_arc) = {
        let mut s = state.lock().unwrap();
        *s.auth_token.lock().unwrap() = Some(token);
        if let Some(url) = supabase_url {
            if !url.is_empty() {
                s.supabase_url = url.clone();
            }
        }
        if let Some(key) = supabase_anon_key {
            if !key.is_empty() {
                s.supabase_anon_key = key.clone();
            }
        }
        let cfg = SupabaseConfig {
            url: s.supabase_url.clone(),
            anon_key: s.supabase_anon_key.clone(),
        };
        (
            cfg,
            Arc::clone(&s.auth_token),
            Arc::clone(&s.sync_running),
            Arc::clone(&s.db),
        )
    };

    // Start the always-on sync loop the first time a valid token is provided.
    // This loop runs for the entire app lifetime (stopped only on exit),
    // so offline-cached samples are flushed as soon as internet is restored —
    // even if the user has already pressed Stop.
    let already_syncing = *sync_running_arc.lock().unwrap();
    if !already_syncing {
        *sync_running_arc.lock().unwrap() = true;
        println!("[lib] 🔄 Starting always-on sync loop (app lifetime).");
        cache::start_sync_loop(cfg.clone(), Arc::clone(&auth_arc), Arc::clone(&sync_running_arc));
    }

    // Immediate startup sync: push any SQLite data left from the previous app session
    // (e.g. the user was offline when they last pressed Stop and the app was then closed).
    let cfg2 = cfg.clone();
    let auth2 = Arc::clone(&auth_arc);
    let db2 = Arc::clone(&db_arc);
    thread::spawn(move || {
        println!("[lib] 🔄 Startup sync: flushing any leftover offline samples...");
        cache::sync_from_arc(&db2, &cfg2, &auth2);
    });

    Ok(())
}

/// invoke('get_inactivity_status')
#[tauri::command]
fn get_inactivity_status(state: tauri::State<'_, Mutex<AppState>>) -> bool {
    let s = state.lock().unwrap();
    let mouse = s.counts.mouse_count.swap(0, std::sync::atomic::Ordering::Relaxed);
    let keyboard = s.counts.keyboard_count.swap(0, std::sync::atomic::Ordering::Relaxed);
    mouse > 0 || keyboard > 0
}

/// invoke('focus_window', { alwaysOnTop?: bool })
#[tauri::command]
fn focus_window(app: tauri::AppHandle, always_on_top: Option<bool>) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        if let Some(on_top) = always_on_top {
            let _ = window.set_always_on_top(on_top);
        }
        let _ = window.set_focus();
        let _ = window.request_user_attention(Some(tauri::UserAttentionType::Critical));
    }
}

/// invoke('set_always_on_top', { alwaysOnTop: bool })
#[tauri::command]
fn set_always_on_top(app: tauri::AppHandle, always_on_top: bool) {
    use tauri::Manager;
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(always_on_top);
    }
}

/// invoke('show_idle_dialog')
#[tauri::command]
fn show_idle_dialog(app: tauri::AppHandle, limit: u32) {
    use tauri::Manager;
    use tauri_plugin_dialog::{DialogExt, MessageDialogKind};

    if let Some(window) = app.get_webview_window("main") {
        let window: tauri::WebviewWindow = window;
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.request_user_attention(Some(tauri::UserAttentionType::Critical));
    }
    
    let app_handle = app.clone();
    app.dialog()
        .message(format!("You have been inactive for {} minutes. Tracking is paused.\n\nPlease resume from the app when you are back.", limit))
        .title("Inactivity Detected")
        .kind(MessageDialogKind::Warning)
        .show(move |_| {
            let _ = app_handle.emit("idle-dialog-dismissed", ());
        });
}

/// invoke('start_idle_monitoring', { limit })
#[tauri::command]
fn start_idle_monitoring(state: tauri::State<'_, Mutex<AppState>>, limit: u32) {
    let s = state.lock().unwrap();
    *s.is_idle_monitoring.lock().unwrap() = true;
    *s.last_idle_limit.lock().unwrap() = limit;
    // Reset counts so we only detect new movement
    s.counts.mouse_count.store(0, std::sync::atomic::Ordering::Relaxed);
    s.counts.keyboard_count.store(0, std::sync::atomic::Ordering::Relaxed);
    s.counts.active_seconds.store(0, std::sync::atomic::Ordering::Relaxed);
}

/// invoke('stop_idle_monitoring')
#[tauri::command]
fn stop_idle_monitoring(state: tauri::State<'_, Mutex<AppState>>) {
    let s = state.lock().unwrap();
    *s.is_idle_monitoring.lock().unwrap() = false;
}

/// invoke('get_location')
#[tauri::command]
fn sync_now(state: tauri::State<'_, Mutex<AppState>>) -> Result<String, String> {
    let s = state.lock().unwrap();
    let cfg = SupabaseConfig {
        url: s.supabase_url.clone(),
        anon_key: s.supabase_anon_key.clone(),
    };
    cache::sync_from_arc(&s.db, &cfg, &s.auth_token);
    Ok("Sync triggered".to_string())
}

#[tauri::command]
fn get_location() -> Result<String, String> {
    // Try ipapi.co first
    if let Ok(resp) = ureq::get("https://ipapi.co/json/").timeout(std::time::Duration::from_secs(5)).call() {
        if let Ok(json) = resp.into_json::<serde_json::Value>() {
            if let (Some(city), Some(country)) = (json["city"].as_str(), json["country_name"].as_str()) {
                return Ok(format!("{}, {}", city, country));
            }
        }
    }
    
    // Fallback to ipwho.is
    if let Ok(resp) = ureq::get("https://ipwho.is/").timeout(std::time::Duration::from_secs(5)).call() {
        if let Ok(json) = resp.into_json::<serde_json::Value>() {
            if let (Some(city), Some(country)) = (json["city"].as_str(), json["country"].as_str()) {
                return Ok(format!("{}, {}", city, country));
            }
        }
    }

    Err("Could not detect location".to_string())
}

#[tauri::command]
fn set_close_behavior(_behavior: String) {
    // No-op: Behavior is now forced to 'quit'
    println!("[lib] ⚙️ Close behavior forced to 'quit'");
}

/// Update the organization plan at runtime without restarting tracking.
/// Called by the React frontend when it detects a plan change via Supabase Realtime.
/// invoke('update_plan', { plan: 'Premium' })
#[tauri::command]
fn update_plan(state: tauri::State<'_, Mutex<AppState>>, plan: String) -> Result<(), String> {
    let s = state.lock().map_err(|e| e.to_string())?;
    let mut current = s.plan_type.lock().map_err(|e| e.to_string())?;
    println!("[lib] 📋 Plan updated: {} → {}", *current, plan);
    *current = plan;
    Ok(())
}

// ─── App entry point ──────────────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = AppState::default();

    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .manage(Mutex::new(state))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init());

    #[cfg(not(feature = "app-store"))]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app.get_webview_window("main")
                .map(|w| {
                    let _ = w.unminimize();
                    let _ = w.show();
                    let _ = w.set_focus();
                });
        }))
        .setup(move |app: &mut tauri::App| {
            #[allow(unused_variables)]
            let app_handle = app.handle().clone();
            
            // --- System Tray ---
            let quit_i = tauri::menu::MenuItem::with_id(app, "quit", "Quit TrackOwl", true, None::<&str>)?;
            let show_i = tauri::menu::MenuItem::with_id(app, "show", "Show Window", true, None::<&str>)?;
            let menu = tauri::menu::Menu::with_items(app, &[&show_i, &quit_i])?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "quit" => {
                            let state_handle = app.state::<Mutex<AppState>>();
                            stop_and_sync_internal(&state_handle);
                            app.exit(0);
                        }
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            tauri::async_runtime::spawn(async move {
                #[cfg(not(feature = "app-store"))]
                updater::check_for_updates(app_handle).await;
            });

            // --- BACKGROUND IDLE WATCHER ---
            let app_handle_watcher = app.handle().clone();
            std::thread::spawn(move || {
                loop {
                    std::thread::sleep(std::time::Duration::from_millis(1000));
                    
                    let state = app_handle_watcher.state::<Mutex<AppState>>();
                    let (monitoring, _limit) = {
                        let s = state.lock().unwrap();
                        let monitoring = *s.is_idle_monitoring.lock().unwrap();
                        let limit = *s.last_idle_limit.lock().unwrap();
                        (monitoring, limit)
                    };

                    if monitoring {
                        let active = {
                            let s = state.lock().unwrap();
                            let mouse = s.counts.mouse_count.swap(0, std::sync::atomic::Ordering::Relaxed);
                            let keyboard = s.counts.keyboard_count.swap(0, std::sync::atomic::Ordering::Relaxed);
                            mouse > 0 || keyboard > 0
                        };

                        if active {
                            {
                                let s = state.lock().unwrap();
                                *s.is_idle_monitoring.lock().unwrap() = false;
                            }
                            if let Some(window) = app_handle_watcher.get_webview_window("main") {
                                let _ = window.unminimize();
                                let _ = window.show();
                                let _ = window.set_focus();
                                let _ = window.request_user_attention(Some(tauri::UserAttentionType::Critical));
                            }
                            let _ = app_handle_watcher.emit("user-returned-from-idle", ());
                        }
                    }
                }
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
            discard_idle_cache,
            show_notification_cmd,
            #[cfg(not(feature = "app-store"))]
            install_update,
            set_auth_token,
            get_inactivity_status,
            focus_window,
            set_always_on_top,
            show_idle_dialog,
            start_idle_monitoring,
            stop_idle_monitoring,
            get_location,
            set_close_behavior,
            sync_now,
            update_plan,
        ])
        .on_window_event(|window: &tauri::Window, event: &tauri::WindowEvent| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                use tauri_plugin_notification::NotificationExt;

                let state_handle = window.state::<Mutex<AppState>>();
                println!("[lib] 🛑 Closing requested (Forced Quit behavior)");

                // Check if a session was active BEFORE we clear it
                let had_active_session = {
                    let s = state_handle.lock().unwrap();
                    s.active_session_id.is_some()
                };

                api.prevent_close(); // Prevent immediate close so we can sync
                stop_and_sync_internal(&state_handle);

                // Fire OS notification if the user was mid-session
                if had_active_session {
                    let _ = window.app_handle()
                        .notification()
                        .builder()
                        .title("TrackOwl — Session Ended")
                        .body("Your tracking session was automatically saved and stopped when the app was closed.")
                        .show();
                }

                window.app_handle().exit(0); // Now exit
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running TrackOwl");
}
