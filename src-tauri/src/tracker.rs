// tracker.rs — Phase 3: Native activity tracking in Rust
// Replaces: electron/tracker.ts (uiohook-napi + active-win)
//
// Architecture:
//   • A background std::thread runs rdev::listen() to catch global mouse/keyboard events
//   • Counts are stored in a Mutex<TrackerCounts>
//   • On start_tracking, a tokio task fires every 60s, reads+resets counts, emits
//     a Tauri "tracking-sample" event to the frontend
//   • Screenshots are captured at random intervals within a 2-min window and
//     sent directly to the backend via HTTP (same as Electron)

use std::sync::{Arc, Mutex};
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use serde::{Deserialize, Serialize};

// ─── Shared counts (accessed from rdev listener thread) ───────────────────────
pub struct TrackerCounts {
    pub mouse_count: AtomicU32,
    pub keyboard_count: AtomicU32,
    pub active_seconds: AtomicU32,
    pub last_active_second: AtomicU64,
}

impl Default for TrackerCounts {
    fn default() -> Self {
        Self {
            mouse_count: AtomicU32::new(0),
            keyboard_count: AtomicU32::new(0),
            active_seconds: AtomicU32::new(0),
            last_active_second: AtomicU64::new(0),
        }
    }
}

// ─── Sample payload sent to React frontend ────────────────────────────────────
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ActivitySample {
    pub session_id: String,
    pub recorded_at: String,
    pub mouse_clicks: u32,
    pub key_presses: u32,
    pub app_name: String,
    pub window_title: String,
    pub domain: String,
    pub idle: bool,
    pub activity_percent: i32,
    /// Distinct seconds in this window that saw ANY input — keyboard, mouse
    /// click, mouse movement or scroll. Persisted raw so the definition of
    /// "activity" stays re-answerable later instead of being baked in here.
    pub active_seconds: u32,
    pub is_offline: bool,
}

// ─── Screenshot payload ───────────────────────────────────────────────────────
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ScreenshotPayload {
    pub session_id: String,
    pub timestamp: String,
    pub base64: String,
}

// ─── Global input hook — runs on a dedicated thread ─────────────────────────
static IS_LISTENER_SPAWNED: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

#[cfg(all(target_os = "macos", not(feature = "app-store")))]
pub fn check_macos_accessibility() -> bool {
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        fn AXIsProcessTrustedWithOptions(options: core_foundation::dictionary::CFDictionaryRef) -> bool;
        static kAXTrustedCheckOptionPrompt: core_foundation::string::CFStringRef;
    }
    
    let is_trusted = unsafe {
        use core_foundation::dictionary::CFDictionary;
        use core_foundation::string::CFString;
        use core_foundation::boolean::CFBoolean;
        use core_foundation::base::TCFType;

        let key = CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt);
        let val = CFBoolean::true_value();
        
        let dict = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), val.as_CFType())]);
        
        AXIsProcessTrustedWithOptions(dict.as_concrete_TypeRef())
    };
    
    println!(
        "[TRACKOWL_ACCESSIBILITY] trusted={} pid={} exe={:?}",
        is_trusted,
        std::process::id(),
        std::env::current_exe()
    );
    
    is_trusted
}

#[cfg(all(target_os = "macos", not(feature = "app-store")))]
pub fn open_macos_accessibility_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}

#[cfg(target_os = "macos")]
pub fn check_macos_screen_recording() -> bool {
    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGRequestScreenCaptureAccess() -> bool;
    }
    // CGRequestScreenCaptureAccess checks the permission actively. 
    // If not granted, it prompts the user and returns false.
    // If granted, it returns true immediately. This bypasses the TCC cache 
    // that CGPreflightScreenCaptureAccess suffers from.
    unsafe { CGRequestScreenCaptureAccess() }
}

/// Spawns rdev listener in a background thread.
/// All mouse/keyboard events are counted in `counts`.
pub fn spawn_input_listener(counts: Arc<TrackerCounts>) {
    println!("[tracker-diag] spawn_input_listener called.");
    if IS_LISTENER_SPAWNED.swap(true, Ordering::SeqCst) {
        println!("[tracker-diag] IS_LISTENER_SPAWNED was true, returning early.");
        return; // Already spawned!
    }

    // NOTE: On macOS (both MAS and non-MAS builds) we use CGEventSourceCounterForEventType
    // (HID system counters) which does NOT require Accessibility permission.
    // The AX permission gate that was previously here has been removed.
    // (Documented in Cargo.toml feature comment for the app-store flag.)

    #[cfg(not(target_os = "macos"))]
    thread::spawn(move || {
        if let Err(e) = rdev::listen(move |event: rdev::Event| {
            let mut is_active = false;
            match event.event_type {
                rdev::EventType::KeyPress(_) => {
                    counts.keyboard_count.fetch_add(1, Ordering::Relaxed);
                    is_active = true;
                }
                rdev::EventType::ButtonPress(_) => {
                    counts.mouse_count.fetch_add(1, Ordering::Relaxed);
                    is_active = true;
                }
                rdev::EventType::MouseMove { .. } | rdev::EventType::Wheel { .. } => {
                    is_active = true;
                }
                _ => {}
            }

            if is_active {
                let current_sec = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let last_sec = counts.last_active_second.load(Ordering::Relaxed);
                if last_sec != current_sec {
                    if counts.last_active_second.compare_exchange(
                        last_sec,
                        current_sec,
                        Ordering::Acquire,
                        Ordering::Relaxed
                    ).is_ok() {
                        counts.active_seconds.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }) {
            eprintln!("[tracker] rdev listen error: {:?}", e);
            IS_LISTENER_SPAWNED.store(false, Ordering::SeqCst);
        }
    });

    #[cfg(target_os = "macos")]
    thread::spawn(move || {
        #[link(name = "CoreGraphics", kind = "framework")]
        extern "C" {
            fn CGEventSourceCounterForEventType(stateID: i32, eventType: u32) -> u32;
        }
        
        const K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE: i32 = 1;
        const K_CG_EVENT_LEFT_MOUSE_DOWN: u32 = 1;
        const K_CG_EVENT_RIGHT_MOUSE_DOWN: u32 = 3;
        const K_CG_EVENT_OTHER_MOUSE_DOWN: u32 = 25;
        const K_CG_EVENT_KEY_DOWN: u32 = 10;
        const K_CG_EVENT_MOUSE_MOVED: u32 = 5;
        const K_CG_EVENT_SCROLL_WHEEL: u32 = 22;

        let mut last_mouse_clicks;
        let mut last_key_presses;
        let mut last_mouse_moves;
        let mut last_scrolls;

        // Initialize counters
        unsafe {
            last_mouse_clicks = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_LEFT_MOUSE_DOWN)
                .wrapping_add(CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_RIGHT_MOUSE_DOWN))
                .wrapping_add(CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_OTHER_MOUSE_DOWN));
            last_key_presses = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_KEY_DOWN);
            last_mouse_moves = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_MOUSE_MOVED);
            last_scrolls = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_SCROLL_WHEEL);
        }

        loop {
            thread::sleep(Duration::from_millis(100)); // Poll every 100ms
            
            let mut is_active = false;

            unsafe {
                let current_clicks = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_LEFT_MOUSE_DOWN)
                    .wrapping_add(CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_RIGHT_MOUSE_DOWN))
                    .wrapping_add(CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_OTHER_MOUSE_DOWN));
                let current_keys = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_KEY_DOWN);
                let current_moves = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_MOUSE_MOVED);
                let current_scrolls = CGEventSourceCounterForEventType(K_CG_EVENT_SOURCE_STATE_HID_SYSTEM_STATE, K_CG_EVENT_SCROLL_WHEEL);

                if current_clicks != last_mouse_clicks {
                    let diff = current_clicks.wrapping_sub(last_mouse_clicks);
                    counts.mouse_count.fetch_add(diff, Ordering::Relaxed);
                    last_mouse_clicks = current_clicks;
                    is_active = true;
                }
                
                if current_keys != last_key_presses {
                    let diff = current_keys.wrapping_sub(last_key_presses);
                    counts.keyboard_count.fetch_add(diff, Ordering::Relaxed);
                    last_key_presses = current_keys;
                    is_active = true;
                }

                if current_moves != last_mouse_moves {
                    last_mouse_moves = current_moves;
                    is_active = true;
                }

                if current_scrolls != last_scrolls {
                    last_scrolls = current_scrolls;
                    is_active = true;
                }
            }

            if is_active {
                let current_sec = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_secs();
                let last_sec = counts.last_active_second.load(Ordering::Relaxed);
                if last_sec != current_sec {
                    if counts.last_active_second.compare_exchange(
                        last_sec,
                        current_sec,
                        Ordering::Acquire,
                        Ordering::Relaxed
                    ).is_ok() {
                        counts.active_seconds.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
        }
    });
}

// ─── Active window detection (Cross-platform) ──────────────────────────────────
/// Returns (app_name, window_title) of the currently focused window.
pub fn get_active_window() -> (String, String) {
    if let Ok(active_window) = active_win_pos_rs::get_active_window() {
        (
            active_window.app_name.replace('\0', ""),
            active_window.title.replace('\0', "")
        )
    } else {
        ("Unknown".to_string(), "Unknown".to_string())
    }
}

// ─── Browser URL extraction (PowerShell UIAutomation) ────────────────────────
const BROWSER_NAMES: &[&str] = &[
    "chrome", "google chrome", "chromium", "firefox", "mozilla firefox",
    "msedge", "microsoft edge", "brave", "opera", "vivaldi", "arc",
];

pub fn get_browser_domain(app_name: &str, title: &str) -> String {
    let lower = app_name.to_lowercase();
    if !BROWSER_NAMES.iter().any(|b| lower.contains(b)) {
        return String::new();
    }

    // Try PowerShell UIAutomation (Windows only)
    #[cfg(target_os = "windows")]
    if let Some(url) = get_url_via_powershell() {
        return url;
    }

    // Fallback: parse domain from window title
    extract_domain_from_title(title)
}

#[cfg(target_os = "windows")]
fn get_url_via_powershell() -> Option<String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let ps_script = r#"
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $focused) { exit 1 }
$parent = $focused
for ($i = 0; $i -lt 8; $i++) {
  $pattern = $null
  try { $pattern = $parent.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern) } catch {}
  if ($pattern) {
    $val = ($pattern).Current.Value
    if ($val -match '^https?://') { Write-Output $val; exit 0 }
  }
  try { $parent = $parent.TreeWalker.RawViewWalker.GetParent($parent) } catch { break }
  if ($null -eq $parent) { break }
}
exit 1
"#;

    let output = std::process::Command::new("powershell")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps_script])
        .output()
        .ok()?;

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() { return None; }

    // Extract hostname by simple string parsing (no url crate needed)
    let hostname = if let Some(after_scheme) = raw.strip_prefix("https://").or_else(|| raw.strip_prefix("http://")) {
        after_scheme.split('/').next().unwrap_or(after_scheme)
                     .split('?').next().unwrap_or(after_scheme)
                     .split('#').next().unwrap_or(after_scheme)
    } else {
        raw.as_str()
    };

    Some(hostname.to_string())
}

fn extract_domain_from_title(title: &str) -> String {
    // Strip known browser suffixes
    let suffixes = [" - Google Chrome", " - Microsoft Edge", " - Mozilla Firefox", " — Firefox", " - Brave"];
    let mut t = title.to_string();
    for suffix in &suffixes {
        if t.ends_with(suffix) {
            t = t[..t.len() - suffix.len()].to_string();
            break;
        }
    }
    // Try to extract a domain
    let re_domain = regex_domain(&t);
    re_domain.unwrap_or_default()
}

fn regex_domain(s: &str) -> Option<String> {
    // Simple manual parse: look for word.word pattern
    for word in s.split_whitespace() {
        let w = word.trim_matches(|c: char| !c.is_alphanumeric() && c != '.' && c != '-');
        if w.matches('.').count() >= 1 {
            let parts: Vec<&str> = w.split('.').collect();
            if parts.len() >= 2 && parts.last().map(|p| p.len() >= 2).unwrap_or(false) {
                return Some(w.to_lowercase());
            }
        }
    }
    None
}

// ─── 60-second sample loop ────────────────────────────────────────────────────
/// Emits "tracking-sample" Tauri events every `interval_ms`.
/// Writes raw ActivitySamples to SQLite + Supabase for screenshot correlation.
/// Every 10 samples (10 minutes) also closes a BlockRecord and uploads to
/// block_records — the single source of truth for all time aggregations.
pub fn start_sample_loop(
    app: AppHandle,
    counts: Arc<TrackerCounts>,
    session_id: String,
    cfg: crate::SupabaseConfig,
    running: Arc<Mutex<bool>>,
    interval_ms: u64,
    db: Arc<Mutex<Option<rusqlite::Connection>>>,
    auth_token: Arc<Mutex<Option<String>>>,
    plan_type: String,
) {
    // Public wrapper keeps the existing call signature for lib.rs compatibility.
    // Defaults to UTC timezone / "never" discard — overridden by start_sample_loop_inner
    // when lib.rs has fetched the org timezone and idle policy.
    start_sample_loop_inner(app, counts, session_id, cfg, running, interval_ms,
        db, auth_token, plan_type, "UTC".to_string(), "never".to_string())
}

/// The real loop — accepts org_timezone and idle_policy.
/// Called by start_sample_loop (wrapper) and directly by lib.rs when org settings are known.
pub fn start_sample_loop_inner(
    app: AppHandle,
    counts: Arc<TrackerCounts>,
    session_id: String,
    cfg: crate::SupabaseConfig,
    running: Arc<Mutex<bool>>,
    interval_ms: u64,
    db: Arc<Mutex<Option<rusqlite::Connection>>>,
    auth_token: Arc<Mutex<Option<String>>>,
    plan_type: String,
    org_timezone: String,
    idle_policy: String,
) {
    thread::spawn(move || {
        let mut last_title: Option<String> = None;
        let mut last_domain: Option<String> = None;
        // Use 1-second tick polling so pause_tracking takes effect within 1 second
        let tick_ms: u64 = 1000;
        let ticks_per_sample = (interval_ms / tick_ms) as u32;
        let mut ticks_elapsed: u32 = 0;

        // Block accumulator — groups 10 × 60s samples into one 10-minute BlockRecord
        let mut accumulator = crate::block_accumulator::BlockAccumulator::new(
            org_timezone, idle_policy,
        );

        // Initialize local SQLite block_records cache table
        {
            let db_guard = db.lock().unwrap();
            if let Some(conn) = db_guard.as_ref() {
                if let Err(e) = crate::block_accumulator::init_block_cache(conn) {
                    eprintln!("[tracker] block cache init error: {}", e);
                }
            }
        }

        let mut last_tick_instant = std::time::Instant::now();
        loop {
            thread::sleep(Duration::from_millis(tick_ms));

            // Check running on every tick — pause takes effect within 1 second
            if !*running.lock().unwrap() { break; }

            let now_instant = std::time::Instant::now();
            let real_tick_elapsed = now_instant.duration_since(last_tick_instant).as_millis() as u64;
            last_tick_instant = now_instant;

            // System sleep / hibernation / power-loss gap detection
            // If the real wall-clock elapsed time between 1s ticks exceeded 15 seconds,
            // the operating system was suspended or put to sleep.
            if real_tick_elapsed > 15_000 {
                eprintln!("[tracker] ⚠️ System sleep/hibernation detected (gap: {}ms). Auto-terminating interrupted session.", real_tick_elapsed);
                
                // Flush accumulator before exiting to preserve active work prior to sleep
                if let Some(partial) = accumulator.flush_partial() {
                    flush_block_record(&partial, &db, &cfg, &auth_token);
                }

                *running.lock().unwrap() = false;
                let _ = app.emit("tracking-interrupted-sleep", ());
                break;
            }

            ticks_elapsed += 1;
            if ticks_elapsed < ticks_per_sample {
                continue;
            }
            ticks_elapsed = 0;

            let (mouse, keyboard, active_secs) = (
                counts.mouse_count.swap(0, Ordering::Relaxed),
                counts.keyboard_count.swap(0, Ordering::Relaxed),
                counts.active_seconds.swap(0, Ordering::Relaxed),
            );

            // Window title / app name: only available in non-MAS builds because
            // active-win-pos-rs uses Accessibility APIs (AXIsProcessTrusted) which
            // Apple disallows for non-accessibility purposes (Guideline 2.4.5).
            // In the App Store build, these fields are left empty; time, activity
            // percentage, and screenshots continue to function normally.
            #[cfg(not(feature = "app-store"))]
            let (app_name, window_title) = if plan_type == "Premium" || plan_type == "Trial" {
                get_active_window()
            } else {
                (String::new(), String::new())
            };
            #[cfg(feature = "app-store")]
            let (app_name, window_title) = (String::new(), String::new());
            
            let domain = if plan_type == "Premium" || plan_type == "Trial" {
                if last_title.as_ref() == Some(&window_title) {
                    last_domain.clone().unwrap_or_default()
                } else {
                    let d = get_browser_domain(&app_name, &window_title);
                    last_title = Some(window_title.clone());
                    last_domain = Some(d.clone());
                    d
                }
            } else {
                String::new()
            };

            // A minute is idle only when NOTHING happened in it.
            let idle = active_secs == 0;

            // Per-sample activity percent (over 60s window)
            let interval_secs = (interval_ms / 1000) as f32;
            let activity_percent =
                ((active_secs as f32 / interval_secs) * 100.0).min(100.0) as i32;

            let sample = ActivitySample {
                session_id: session_id.clone(),
                recorded_at: chrono::Utc::now().to_rfc3339(),
                mouse_clicks: mouse,
                key_presses: keyboard,
                app_name,
                window_title,
                domain,
                idle,
                activity_percent,
                active_seconds: active_secs,
                is_offline: false,
            };

            // Emit to React UI (live 60s tick — provisional display only)
            let _ = app.emit("tracking-sample", &sample);

            // ── 1. Write raw sample to activity_samples (for screenshot correlation) ──
            let mut db_exists = false;
            {
                let db_guard = db.lock().unwrap();
                if let Some(conn) = db_guard.as_ref() {
                    db_exists = true;
                    if let Err(e) = crate::cache::cache_sample(conn, &sample) {
                        eprintln!("[tracker] cache write error: {}", e);
                    }
                }
            }

            if db_exists {
                crate::cache::sync_from_arc(&db, &cfg, &auth_token);
            } else {
                let body = serde_json::json!([{
                    "session_id":      sample.session_id,
                    "recorded_at":     sample.recorded_at,
                    "mouse_clicks":    sample.mouse_clicks,
                    "key_presses":     sample.key_presses,
                    "app_name":        sample.app_name,
                    "window_title":    sample.window_title,
                    "domain":          sample.domain,
                    "idle":            sample.idle,
                    "activity_percent": sample.activity_percent,
                    "active_seconds":  sample.active_seconds,
                    "is_offline":      sample.is_offline,
                }]).to_string();
                let token = auth_token.lock().unwrap().clone();
                let _ = crate::supabase_post(&cfg, "activity_samples", &body, token.as_deref(), Some("resolution=ignore-duplicates"));
            }

            // ── 2. Feed sample into 10-minute block accumulator ───────────────
            if let Some(block) = accumulator.push(sample) {
                println!("[tracker] 📦 Block closed: {} active_secs={} activity={}% credited={}",
                    block.business_date, block.active_seconds, block.activity_percent, block.credited);
                flush_block_record(&block, &db, &cfg, &auth_token);
            }
        }

        // ── Loop exited — flush any partial block (< 10 samples) ─────────────
        if let Some(partial) = accumulator.flush_partial() {
            println!("[tracker] 📦 Partial block on stop: {} active_secs={} activity={}%",
                partial.business_date, partial.active_seconds, partial.activity_percent);
            flush_block_record(&partial, &db, &cfg, &auth_token);
        }
    });
}

/// Persist a completed/partial BlockRecord to local SQLite and sync to Supabase.
fn flush_block_record(
    block: &crate::block_accumulator::BlockRecord,
    db: &Arc<Mutex<Option<rusqlite::Connection>>>,
    cfg: &crate::SupabaseConfig,
    auth_token: &Arc<Mutex<Option<String>>>,
) {
    let db_guard = db.lock().unwrap();
    if let Some(conn) = db_guard.as_ref() {
        if let Err(e) = crate::block_accumulator::cache_block(conn, block) {
            eprintln!("[tracker] block cache error: {}", e);
        } else {
            let token = auth_token.lock().unwrap().clone().unwrap_or_default();
            crate::block_accumulator::sync_blocks(conn, cfg, &token);
        }
    } else {
        // No local DB — upload directly
        let body = serde_json::json!([{
            "session_id":       block.session_id,
            "block_start":      block.block_start,
            "block_end":        block.block_end,
            "active_seconds":   block.active_seconds,
            "activity_percent": block.activity_percent,
            "is_productive":    block.is_productive,
            "credited":         block.credited,
            "mouse_clicks":     block.mouse_clicks,
            "key_presses":      block.key_presses,
            "app_name":         block.app_name,
            "domain":           block.domain,
            "is_offline":       block.is_offline,
            "business_date":    block.business_date,
        }]).to_string();
        let token = auth_token.lock().unwrap().clone();
        let _ = crate::supabase_post(cfg, "block_records", &body, token.as_deref(), Some("resolution=ignore-duplicates"));
    }
}

// ─── Screenshot loop ───────────────────────────────────────────────────────────
// Rolling-window rate limiter:
//   • Max 3 screenshots per any 10-minute rolling window per session.
//   • Timestamps are persisted in SQLite — survives app restarts.
//   • Checks every 1–4 minutes (random); captures only if under the limit.
//   • 2 MANDATORY captures are always taken: on session START and on session STOP.
//     These count against the rolling window so the loop adjusts accordingly.
const SCREENSHOT_WINDOW_MS: i64 = 10 * 60 * 1000; // 10 minutes
const MAX_SCREENSHOTS_PER_WINDOW: usize = 3;
const SS_MIN_SLEEP_MS: u64 = 60_000;  // 1 minute  (minimum between checks)
const SS_MAX_SLEEP_MS: u64 = 240_000; // 4 minutes (maximum between checks)

/// Captures, uploads, and logs a single screenshot unconditionally.
/// Used for mandatory start/stop captures. Logs the timestamp to the
/// rolling-window DB so the loop accounts for it.
pub fn take_mandatory_screenshot(
    app: &AppHandle,
    session_id: &str,
    cfg: &crate::SupabaseConfig,
    auth_token: &Arc<Mutex<Option<String>>>,
    organization_id: Option<&str>,
    user_id: &str,
    label: &str, // e.g. "START" or "STOP"
    db_conn: Option<&rusqlite::Connection>,
) {
    println!("[tracker] 📸 Mandatory {} screenshot — capturing...", label);

    let Some(base64_data) = capture_screenshot() else {
        eprintln!("[tracker] ❌ Mandatory {} screenshot: capture failed.", label);
        return;
    };

    let captured_at  = chrono::Utc::now();
    let recorded_at  = captured_at.to_rfc3339();
    let captured_ms  = captured_at.timestamp_millis();
    let org_slug     = organization_id.unwrap_or("unknown");
    let filename     = format!("{}/{}/{}.jpg", org_slug, user_id, captured_ms);
    let storage_url  = format!("{}/storage/v1/object/screenshots/{}", cfg.url, filename);

    use base64::Engine;
    let Ok(image_bytes) = base64::engine::general_purpose::STANDARD.decode(&base64_data) else {
        eprintln!("[tracker] ❌ Mandatory {} screenshot: base64 decode failed.", label);
        return;
    };

    let s_token = auth_token.lock().unwrap().clone();
    let agent   = ureq::AgentBuilder::new()
        .timeout(std::time::Duration::from_secs(15))
        .build();
    let mut req = agent.post(&storage_url)
        .set("apikey", &cfg.anon_key)
        .set("Content-Type", "image/jpeg");
    if let Some(token) = &s_token {
        req = req.set("Authorization", &format!("Bearer {}", token));
    }

    match req.send_bytes(image_bytes.as_slice()) {
        Ok(resp) => {
            println!(
                "[tracker] ✅ Mandatory {} screenshot UPLOADED. Status: {} | Path: {}",
                label, resp.status(), filename
            );
            let _ = app.emit("screenshot-captured", {});

            // Log timestamp so the rolling window accounts for this capture
            if let Some(conn) = db_conn {
                let _ = crate::cache::log_screenshot_time(conn, captured_ms);
            }

            let body = serde_json::json!({
                "session_id": session_id,
                "recorded_at": recorded_at,
                "file_url": filename,
            }).to_string();
            let _ = crate::supabase_post(cfg, "screenshots", &body, s_token.as_deref(), None);
        }
        Err(e) => {
            eprintln!("[tracker] ❌ Mandatory {} screenshot UPLOAD FAILED: {}", label, e);
        }
    }
}

pub fn start_screenshot_loop(
    app: AppHandle,
    session_id: String,
    cfg: crate::SupabaseConfig,
    running: Arc<Mutex<bool>>,
    auth_token: Arc<Mutex<Option<String>>>,
    organization_id: Option<String>,
    user_id: String,
    plan_type: String,
) {
    if plan_type != "Premium" && plan_type != "Trial" {
        println!("[tracker] 🛡️ Plan is {}, skipping screenshot loop.", plan_type);
        return;
    }

    thread::spawn(move || {
        // Each screenshot thread owns a private DB connection.
        // This mirrors how start_sync_loop works and avoids mutex contention.
        let db_conn = crate::cache::init_db().ok();
        if db_conn.is_none() {
            eprintln!("[tracker] ⚠️ Screenshot loop: could not open SQLite DB — rate limiting disabled.");
        }

        // ── Mandatory START screenshot (always captured, counts vs. rolling window) ──
        take_mandatory_screenshot(
            &app,
            &session_id,
            &cfg,
            &auth_token,
            organization_id.as_deref(),
            &user_id,
            "START",
            db_conn.as_ref(),
        );

        loop {
            if !*running.lock().unwrap() { break; }

            // ── Random sleep before the next check (1–4 minutes) ──────────────
            let jitter = rand_ms(SS_MAX_SLEEP_MS - SS_MIN_SLEEP_MS, 7);
            let sleep_ms = SS_MIN_SLEEP_MS + jitter;
            thread::sleep(Duration::from_millis(sleep_ms));

            if !*running.lock().unwrap() { break; }

            // ── Rolling-window check ──────────────────────────────────────────
            use std::time::{SystemTime, UNIX_EPOCH};
            let now_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as i64;
            let window_start = now_ms - SCREENSHOT_WINDOW_MS;

            let count_in_window = db_conn.as_ref()
                .and_then(|conn| crate::cache::count_screenshots_since(conn, window_start).ok())
                .unwrap_or(0);

            if count_in_window >= MAX_SCREENSHOTS_PER_WINDOW {
                println!(
                    "[tracker] 🚫 Screenshot rate limit hit: {} in last 10 min (max {}). Skipping.",
                    count_in_window, MAX_SCREENSHOTS_PER_WINDOW
                );
                continue; // sleep again, re-check when window rolls forward
            }

            // ── Capture & upload ──────────────────────────────────────────────
            println!(
                "[tracker] 📸 Capturing screenshot ({}/{} in rolling window)...",
                count_in_window + 1, MAX_SCREENSHOTS_PER_WINDOW
            );

            if let Some(base64_data) = capture_screenshot() {
                let captured_at = chrono::Utc::now();
                let recorded_at = captured_at.to_rfc3339();
                let captured_ms = captured_at.timestamp_millis();

                let org_slug = organization_id.clone().unwrap_or_else(|| "unknown".to_string());
                let filename = format!("{}/{}/{}.jpg", org_slug, user_id, captured_ms);
                let storage_url = format!("{}/storage/v1/object/screenshots/{}", cfg.url, filename);

                use base64::Engine;
                if let Ok(image_bytes) = base64::engine::general_purpose::STANDARD.decode(&base64_data) {
                    let s_token = auth_token.lock().unwrap().clone();
                    let agent = ureq::AgentBuilder::new()
                        .timeout(std::time::Duration::from_secs(15))
                        .build();
                    let mut req = agent.post(&storage_url)
                        .set("apikey", &cfg.anon_key)
                        .set("Content-Type", "image/jpeg");
                    if let Some(token) = &s_token {
                        req = req.set("Authorization", &format!("Bearer {}", token));
                    }

                    match req.send_bytes(image_bytes.as_slice()) {
                        Ok(resp) => {
                            println!(
                                "[tracker] ✅ Screenshot UPLOADED. Status: {} | Path: {}",
                                resp.status(), filename
                            );
                            let _ = app.emit("screenshot-captured", {});

                            // Persist timestamp ONLY on successful upload
                            if let Some(conn) = db_conn.as_ref() {
                                if let Err(e) = crate::cache::log_screenshot_time(conn, captured_ms) {
                                    eprintln!("[tracker] ⚠️ Failed to log screenshot timestamp: {}", e);
                                }
                                // Prune stale entries (> 24 h) to keep DB lean
                                crate::cache::prune_screenshot_log(conn);
                            }

                            // Record metadata in screenshots table
                            let body = serde_json::json!({
                                "session_id": session_id,
                                "recorded_at": recorded_at,
                                "file_url": filename,
                            }).to_string();
                            let _ = crate::supabase_post(&cfg, "screenshots", &body, s_token.as_deref(), None);
                        }
                        Err(e) => {
                            eprintln!("[tracker] ❌ Screenshot UPLOAD FAILED for {}: {}", filename, e);
                            // Do NOT log timestamp — failed upload shouldn't count against the limit
                        }
                    }
                }
            }
        }
    });
}

fn rand_ms(max: u64, salt: u32) -> u64 {
    // Improved LCG-based "random" with a salt to prevent identical results
    // in rapid succession (since SystemTime might not tick fast enough).
    use std::time::{SystemTime, UNIX_EPOCH};
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    let mut seed = now.as_micros() as u64;
    
    // Mix in the salt and some bits from the address space/pid for entropy
    seed = seed.wrapping_add(salt as u64).wrapping_add(0x9E3779B97F4A7C15);
    
    // SplitMix64 or similar transformation for better bit distribution
    seed = (seed ^ (seed >> 30)).wrapping_mul(0xBF58476D1CE4E5B9);
    seed = (seed ^ (seed >> 27)).wrapping_mul(0x94D049BB133111EB);
    seed = seed ^ (seed >> 31);
    
    seed % max
}

#[cfg(target_os = "macos")]
fn capture_screenshot() -> Option<String> {
    use base64::{Engine, engine::general_purpose::STANDARD};
    use std::process::Command;
    use std::fs;
    use image::GenericImageView;

    let temp_dir = std::env::temp_dir();
    let temp_path = temp_dir.join(format!("trackowl_ss_{}.jpg", rand_ms(10000, 1)));
    let temp_path_str = temp_path.to_str().unwrap_or("/tmp/trackowl_ss_fallback.jpg");
    
    let output = Command::new("screencapture")
        .args(["-x", "-t", "jpg", temp_path_str])
        .output()
        .ok()?;
        
    if !output.status.success() {
        eprintln!("[tracker] screencapture failed");
        return None;
    }
    
    let bytes = fs::read(&temp_path).ok()?;
    let _ = fs::remove_file(&temp_path);
    
    if let Ok(image) = image::load_from_memory(&bytes) {
        let (orig_width, orig_height) = image.dimensions();
        let resized_image = if orig_width > 2000 {
            let new_width = 2000;
            let new_height = (orig_height as f32 * (2000.0 / orig_width as f32)) as u32;
            image::imageops::resize(&image, new_width, new_height, image::imageops::FilterType::Triangle)
        } else {
            image.to_rgba8()
        };

        let rgb_image = image::DynamicImage::ImageRgba8(resized_image).into_rgb8();
        let (width, height) = rgb_image.dimensions();
        let mut jpeg_bytes: Vec<u8> = Vec::new();
        let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(std::io::Cursor::new(&mut jpeg_bytes), 60);
        if encoder.encode(rgb_image.as_raw(), width, height, image::ColorType::Rgb8).is_ok() {
            println!("[tracker] 📸 Encoded Mac screencapture to JPEG: {} bytes", jpeg_bytes.len());
            return Some(STANDARD.encode(&jpeg_bytes));
        }
    }
    
    Some(STANDARD.encode(&bytes))
}

#[cfg(not(target_os = "macos"))]
fn capture_screenshot() -> Option<String> {
    use screenshots::Screen;
    use base64::{Engine, engine::general_purpose::STANDARD};
    use image::codecs::jpeg::JpegEncoder;

    let screens = Screen::all().ok()?;
    let screen = screens.into_iter().next()?;
    let image = screen.capture().ok()?;

    // Optimized downscaling: Max width 2000px (Balanced for 1080p and Retina)
    let (orig_width, orig_height) = image.dimensions();
    let resized_image = if orig_width > 2000 {
        let new_width = 2000;
        let new_height = (orig_height as f32 * (2000.0 / orig_width as f32)) as u32;
        image::imageops::resize(&image, new_width, new_height, image::imageops::FilterType::Triangle)
    } else {
        image
    };

    // CRITICAL FIX: Convert RGBA to RGB (removing alpha channel)
    // JPEG encoders often fail or produce invalid data if alpha is present.
    let rgb_image = image::DynamicImage::ImageRgba8(resized_image).into_rgb8();
    let (width, height) = rgb_image.dimensions();
    
    let mut jpeg_bytes: Vec<u8> = Vec::new();
    
    // Quality 60 is the "Goldilocks" zone for size vs text clarity
    // image 0.24 JpegEncoder::encode takes ([u8], width, height, ColorType)
    let mut encoder = JpegEncoder::new_with_quality(std::io::Cursor::new(&mut jpeg_bytes), 60);
    match encoder.encode(
        &rgb_image.as_raw(), 
        width, 
        height, 
        image::ColorType::Rgb8
    ) {
        Ok(_) => {
            println!("[tracker] 📸 Encoded screenshot to JPEG ({}x{} @ 60%): {} bytes", width, height, jpeg_bytes.len());
            Some(STANDARD.encode(&jpeg_bytes))
        }


        Err(e) => {
            eprintln!("[tracker] ❌ JPEG encoding FAILED: {}", e);
            None
        }
    }
}


