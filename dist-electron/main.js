import { desktopCapturer, app, BrowserWindow, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { uIOhook } from "uiohook-napi";
import activeWindow from "active-win";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs";
async function captureScreenBase64() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    if (sources && sources.length > 0) {
      const image = sources[0].thumbnail;
      return image.toDataURL();
    }
    return null;
  } catch (err) {
    console.error("Failed to capture screen:", err);
    return null;
  }
}
const execFileAsync = promisify(execFile);
let isTracking = false;
let mouseCount = 0;
let keyboardCount = 0;
let sampleInterval = null;
let screenshotTimeout = null;
let currentSessionId = null;
let onSampleCallback = null;
let onScreenshotCallback = null;
const SCREENSHOT_WINDOW_MS = 2 * 60 * 1e3;
const SCREENSHOTS_PER_WINDOW = 2;
function initTracker() {
  uIOhook.on("keydown", () => {
    if (isTracking) keyboardCount++;
  });
  uIOhook.on("mousedown", () => {
    if (isTracking) mouseCount++;
  });
  uIOhook.start();
}
function startTrackingSession(sessionId, onSample, onScreenshot, intervalMs = 6e4) {
  if (isTracking) return;
  isTracking = true;
  currentSessionId = sessionId;
  onSampleCallback = onSample;
  onScreenshotCallback = onScreenshot;
  mouseCount = 0;
  keyboardCount = 0;
  sampleInterval = setInterval(async () => {
    const activeInfo = await activeWindow();
    const appName = activeInfo?.owner.name || "Unknown";
    const title = activeInfo?.title || "Unknown";
    const domain = await getBrowserUrl(appName, title);
    const idle = mouseCount === 0 && keyboardCount === 0;
    const sample = {
      session_id: currentSessionId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      mouse_count: mouseCount,
      keyboard_count: keyboardCount,
      app_name: appName,
      window_title: title,
      domain,
      idle_flag: idle
    };
    mouseCount = 0;
    keyboardCount = 0;
    if (onSampleCallback) onSampleCallback(sample);
  }, intervalMs);
  scheduleNextScreenshot();
}
function scheduleNextScreenshot() {
  if (!isTracking) return;
  const offsets = [];
  while (offsets.length < SCREENSHOTS_PER_WINDOW) {
    const t = Math.floor(Math.random() * SCREENSHOT_WINDOW_MS);
    if (!offsets.includes(t)) offsets.push(t);
  }
  offsets.sort((a, b) => a - b);
  fireChain(offsets, 0, 0);
}
function fireChain(offsets, idx, prevOffset) {
  if (!isTracking) return;
  if (idx >= offsets.length) {
    scheduleNextScreenshot();
    return;
  }
  const delay = offsets[idx] - prevOffset;
  screenshotTimeout = setTimeout(async () => {
    if (!isTracking || !currentSessionId) return;
    try {
      const base64 = await captureScreenBase64();
      if (base64 && onScreenshotCallback) {
        onScreenshotCallback({
          session_id: currentSessionId,
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          base64
        });
      }
    } catch (err) {
      console.error("Screenshot error:", err);
    }
    const isLast = idx === offsets.length - 1;
    if (isLast) {
      const remainingMs = SCREENSHOT_WINDOW_MS - offsets[idx];
      screenshotTimeout = setTimeout(() => scheduleNextScreenshot(), Math.max(remainingMs, 0));
    } else {
      fireChain(offsets, idx + 1, offsets[idx]);
    }
  }, delay);
}
function stopTrackingSession() {
  if (!isTracking) return;
  isTracking = false;
  currentSessionId = null;
  onSampleCallback = null;
  onScreenshotCallback = null;
  if (sampleInterval) {
    clearInterval(sampleInterval);
    sampleInterval = null;
  }
  if (screenshotTimeout) {
    clearTimeout(screenshotTimeout);
    screenshotTimeout = null;
  }
}
function teardownTracker() {
  uIOhook.stop();
}
const BROWSER_PROCESS_NAMES = /* @__PURE__ */ new Set([
  "chrome",
  "google chrome",
  "chromium",
  "firefox",
  "mozilla firefox",
  "msedge",
  "microsoft edge",
  "safari",
  "opera",
  "brave browser",
  "vivaldi",
  "arc"
]);
const PS_GET_BROWSER_URL = `
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$app = [System.Windows.Automation.AutomationElement]::RootElement
$focused = [System.Windows.Automation.AutomationElement]::FocusedElement
if ($null -eq $focused) { exit 1 }
$parent = $focused
for ($i = 0; $i -lt 8; $i++) {
  $pattern = $null
  try { $pattern = $parent.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern) } catch {}
  if ($pattern) {
    $val = ($pattern).Current.Value
    if ($val -match '^https?://') { Write-Output $val; exit 0 }
    if ($val -match '^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}') { Write-Output ('https://' + $val); exit 0 }
  }
  try { $parent = $parent.TreeWalker.RawViewWalker.GetParent($parent) } catch { break }
  if ($null -eq $parent) { break }
}
exit 1
`.trim();
const BROWSER_TITLE_SUFFIXES = [
  / [-–—|] Google Chrome$/i,
  / [-–—|] Chromium$/i,
  / [-–—|] Microsoft Edge$/i,
  / [-–—|] Mozilla Firefox$/i,
  / [-–—|] Firefox$/i,
  / [-–—|] Safari$/i,
  / [-–—|] Opera$/i,
  / [-–—|] Brave$/i,
  / [-–—|] Vivaldi$/i,
  / [-–—|] Arc$/i
];
const DOMAIN_REGEX = /(?:https?:\/\/)?([a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)+)(?:[:/]|$)/i;
const LOCALHOST_REGEX = /localhost(?::[0-9]+)?/i;
async function getBrowserUrl(appName, title) {
  const lowerApp = appName.toLowerCase();
  const isBrowser = [...BROWSER_PROCESS_NAMES].some((b) => lowerApp.includes(b));
  if (!isBrowser) return "";
  if (process.platform === "win32") {
    try {
      const { stdout } = await execFileAsync("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        PS_GET_BROWSER_URL
      ], { timeout: 2e3 });
      const url = stdout.trim();
      if (url) {
        try {
          return new URL(url).hostname;
        } catch {
          return url;
        }
      }
    } catch {
    }
  }
  let pageTitle = title;
  for (const suffix of BROWSER_TITLE_SUFFIXES) {
    pageTitle = pageTitle.replace(suffix, "").trim();
  }
  const localMatch = LOCALHOST_REGEX.exec(pageTitle);
  if (localMatch) return localMatch[0];
  const domainMatch = DOMAIN_REGEX.exec(pageTitle);
  if (domainMatch?.[1]) {
    const candidate = domainMatch[1];
    if (candidate.length >= 4 && /\.[a-z]{2,}$/i.test(candidate)) {
      return candidate.toLowerCase();
    }
  }
  return "";
}
const dbPath = path.join(app.getPath("userData"), "tracker_cache.json");
let cache = [];
let nextId = 1;
function loadStorage() {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, "utf8");
      cache = JSON.parse(data);
      if (cache.length > 0) {
        nextId = Math.max(...cache.map((c) => c.id || 0)) + 1;
      }
    } catch (e) {
      console.error("Failed to parse cache JSON. Starting fresh.", e);
      cache = [];
    }
  }
}
function saveStorage() {
  fs.writeFileSync(dbPath, JSON.stringify(cache, null, 2), "utf8");
}
function initCache() {
  loadStorage();
}
function cacheSample(sample) {
  const row = {
    id: nextId++,
    session_id: sample.session_id,
    timestamp: sample.timestamp,
    mouse_count: sample.mouse_count || 0,
    keyboard_count: sample.keyboard_count || 0,
    app_name: sample.app_name || "",
    window_title: sample.window_title || "",
    domain: sample.domain || "",
    idle_flag: sample.idle_flag ? true : false,
    type: sample.type || void 0,
    file_url: sample.file_url || "",
    file_data: sample.file_data || "",
    synced: 0
  };
  cache.push(row);
  saveStorage();
}
function getUnsyncedSamples() {
  return cache.filter((row) => row.synced === 0).slice(0, 50);
}
function markSamplesSynced(ids) {
  if (ids.length === 0) return;
  let updated = false;
  cache = cache.map((row) => {
    if (row.id && ids.includes(row.id)) {
      updated = true;
      return { ...row, synced: 1 };
    }
    return row;
  });
  const sevenDaysAgo = /* @__PURE__ */ new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  cache = cache.filter((row) => {
    if (row.synced === 1 && new Date(row.timestamp) < sevenDaysAgo) return false;
    return true;
  });
  if (updated) {
    saveStorage();
  }
}
const API_URL = process.env.VITE_API_BASE_URL || "http://localhost:3001";
let syncInterval = null;
let currentFreelancerToken = null;
function initApi(freelancerToken) {
  syncInterval = setInterval(syncTrackerData, 3e4);
}
function teardownApi() {
  if (syncInterval) clearInterval(syncInterval);
}
async function uploadSample(sample) {
  cacheSample(sample);
  await syncTrackerData();
}
async function syncTrackerData() {
  const pendingSamples = getUnsyncedSamples();
  if (pendingSamples.length === 0) return;
  try {
    const payload = pendingSamples.map((s) => ({
      session_id: s.session_id,
      timestamp: s.timestamp,
      mouse_count: s.mouse_count,
      keyboard_count: s.keyboard_count,
      app_name: s.app_name,
      window_title: s.window_title,
      domain: s.domain || "",
      idle_flag: Number(s.idle_flag) === 1,
      // We pass the screenshot base64 directly to our API for now
      file_url: s.file_url
    }));
    const response = await fetch(`${API_URL}/api/heartbeats`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...currentFreelancerToken ? { "Authorization": `Bearer ${currentFreelancerToken}` } : {}
      },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log(`✅ Successfully synced ${pendingSamples.length} samples to backend API.`, data);
    const ids = pendingSamples.map((s) => s.id);
    markSamplesSynced(ids);
  } catch (error) {
    console.error("Failed to sync tracking data (will retry next loop):", error);
  }
}
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.DIST = path.join(__dirname$1, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, "../public");
let win = null;
let activeSessionId = null;
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
function createWindow() {
  win = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 350,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname$1, "preload.mjs"),
      // Ensure webSecurity is on unless specifically disabled!
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(process.env.DIST || "", "index.html"));
  }
}
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  initCache();
  initApi();
  initTracker();
});
app.on("will-quit", () => {
  teardownTracker();
  teardownApi();
});
ipcMain.handle("start-tracking", async (event, { projectId, userId }) => {
  console.log("Starting tracking for project:", projectId, "user:", userId);
  const API_URL2 = process.env.VITE_API_BASE_URL || "http://localhost:3001";
  let sessionId;
  try {
    const response = await fetch(`${API_URL2}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId || "local-user", project_id: projectId })
    });
    if (response.ok) {
      const data = await response.json();
      sessionId = data.session_id;
      console.log(`✅ Session created: ${sessionId}`);
    } else {
      console.warn("⚠️  Backend unavailable, using local session ID");
      sessionId = "local-" + Date.now();
    }
  } catch (err) {
    console.warn("⚠️  Could not reach backend, using local session ID:", err);
    sessionId = "local-" + Date.now();
  }
  activeSessionId = sessionId;
  const API_URL_LOCAL = process.env.VITE_API_BASE_URL || "http://localhost:3001";
  startTrackingSession(sessionId, (sample) => {
    win?.webContents.send("tracking-sample", sample);
    uploadSample(sample);
  }, async (screenshot) => {
    win?.webContents.send("tracking-screenshot", screenshot);
    try {
      const res = await fetch(`${API_URL_LOCAL}/api/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(screenshot)
      });
      if (!res.ok) console.error("Screenshot upload failed:", res.status);
      else console.log("📸 Screenshot uploaded to backend");
    } catch (err) {
      console.error("Screenshot upload error (will retry next session):", err);
    }
  }, 5e3);
  return { status: "running", session_id: sessionId };
});
ipcMain.handle("stop-tracking", async () => {
  console.log("Stopping tracking");
  stopTrackingSession();
  if (activeSessionId) {
    const API_URL_LOCAL = process.env.VITE_API_BASE_URL || "http://localhost:3001";
    try {
      await fetch(`${API_URL_LOCAL}/api/sessions/${activeSessionId}/end`, { method: "POST" });
      console.log(`🏁 Session ${activeSessionId} marked as ended in DB`);
    } catch (err) {
      console.warn("Could not end session in DB:", err);
    }
    activeSessionId = null;
  }
  return { status: "stopped" };
});
