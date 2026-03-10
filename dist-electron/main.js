import { desktopCapturer as W, app as d, BrowserWindow as C, ipcMain as O } from "electron";
import p from "node:path";
import { fileURLToPath as V } from "node:url";
import { uIOhook as y } from "uiohook-napi";
import F from "active-win";
import { execFile as j } from "node:child_process";
import { promisify as M } from "node:util";
import k from "node:fs";
async function z() {
  try {
    const e = await W.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 }
    });
    return e && e.length > 0 ? e[0].thumbnail.toDataURL() : null;
  } catch (e) {
    return console.error("Failed to capture screen:", e), null;
  }
}
const G = M(j);
let l = !1, m = 0, h = 0, g = null, w = null, S = null, $ = null, I = null;
const P = 600 * 1e3, J = 3;
function q() {
  y.on("keydown", () => {
    l && h++;
  }), y.on("mousedown", () => {
    l && m++;
  }), y.start();
}
function H(e, t, o, r = 6e4) {
  l || (l = !0, S = e, $ = t, I = o, m = 0, h = 0, g = setInterval(async () => {
    const a = await F(), n = a?.owner.name || "Unknown", s = a?.title || "Unknown", i = await ne(n, s), f = m === 0 && h === 0, N = {
      session_id: S,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      mouse_count: m,
      keyboard_count: h,
      app_name: n,
      window_title: s,
      domain: i,
      idle_flag: f
    };
    m = 0, h = 0, $ && $(N);
  }, r), T());
}
function T() {
  if (!l) return;
  const e = [];
  for (; e.length < J; ) {
    const t = Math.floor(Math.random() * P);
    e.includes(t) || e.push(t);
  }
  e.sort((t, o) => t - o), L(e, 0, 0);
}
function L(e, t, o) {
  if (!l) return;
  if (t >= e.length) {
    T();
    return;
  }
  const r = e[t] - o;
  w = setTimeout(async () => {
    if (!l || !S) return;
    try {
      const n = await z();
      n && I && I({
        session_id: S,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        base64: n
      });
    } catch (n) {
      console.error("Screenshot error:", n);
    }
    if (t === e.length - 1) {
      const n = P - e[t];
      w = setTimeout(() => T(), Math.max(n, 0));
    } else
      L(e, t + 1, e[t]);
  }, r);
}
function X() {
  l && (l = !1, S = null, $ = null, I = null, g && (clearInterval(g), g = null), w && (clearTimeout(w), w = null));
}
function Z() {
  y.stop();
}
const K = /* @__PURE__ */ new Set([
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
]), Q = `
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
`.trim(), Y = [
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
], ee = /(?:https?:\/\/)?([a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)+)(?:[:/]|$)/i, te = /localhost(?::[0-9]+)?/i;
async function ne(e, t) {
  const o = e.toLowerCase();
  if (![...K].some((i) => o.includes(i))) return "";
  if (process.platform === "win32")
    try {
      const { stdout: i } = await G("powershell", [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        Q
      ], { timeout: 2e3 }), f = i.trim();
      if (f)
        try {
          return new URL(f).hostname;
        } catch {
          return f;
        }
    } catch {
    }
  let a = t;
  for (const i of Y)
    a = a.replace(i, "").trim();
  const n = te.exec(a);
  if (n) return n[0];
  const s = ee.exec(a);
  if (s?.[1]) {
    const i = s[1];
    if (i.length >= 4 && /\.[a-z]{2,}$/i.test(i))
      return i.toLowerCase();
  }
  return "";
}
const E = p.join(d.getPath("userData"), "tracker_cache.json");
let c = [], D = 1;
function oe() {
  if (k.existsSync(E))
    try {
      const e = k.readFileSync(E, "utf8");
      c = JSON.parse(e), c.length > 0 && (D = Math.max(...c.map((t) => t.id || 0)) + 1);
    } catch (e) {
      console.error("Failed to parse cache JSON. Starting fresh.", e), c = [];
    }
}
function U() {
  k.writeFileSync(E, JSON.stringify(c, null, 2), "utf8");
}
function ae() {
  oe();
}
function ie(e) {
  const t = {
    id: D++,
    session_id: e.session_id,
    timestamp: e.timestamp,
    mouse_count: e.mouse_count || 0,
    keyboard_count: e.keyboard_count || 0,
    app_name: e.app_name || "",
    window_title: e.window_title || "",
    domain: e.domain || "",
    idle_flag: !!e.idle_flag,
    type: e.type || void 0,
    file_url: e.file_url || "",
    file_data: e.file_data || "",
    synced: 0
  };
  c.push(t), U();
}
function re() {
  return c.filter((e) => e.synced === 0).slice(0, 50);
}
function se(e) {
  if (e.length === 0) return;
  let t = !1;
  c = c.map((r) => r.id && e.includes(r.id) ? (t = !0, { ...r, synced: 1 }) : r);
  const o = /* @__PURE__ */ new Date();
  o.setDate(o.getDate() - 7), c = c.filter((r) => !(r.synced === 1 && new Date(r.timestamp) < o)), t && U();
}
const ce = process.env.VITE_API_BASE_URL || "http://localhost:3001";
let A = null, v = null;
function le(e) {
  A = setInterval(x, 3e4);
}
function ue() {
  A && clearInterval(A);
}
async function de(e) {
  ie(e), await x();
}
async function x() {
  const e = re();
  if (e.length !== 0)
    try {
      const t = e.map((n) => ({
        session_id: n.session_id,
        timestamp: n.timestamp,
        mouse_count: n.mouse_count,
        keyboard_count: n.keyboard_count,
        app_name: n.app_name,
        window_title: n.window_title,
        domain: n.domain || "",
        idle_flag: Number(n.idle_flag) === 1,
        // We pass the screenshot base64 directly to our API for now
        file_url: n.file_url
      })), o = await fetch(`${ce}/api/heartbeats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...v ? { Authorization: `Bearer ${v}` } : {}
        },
        body: JSON.stringify(t)
      });
      if (!o.ok)
        throw new Error(`API Error: ${o.status} ${o.statusText}`);
      const r = await o.json();
      console.log(`✅ Successfully synced ${e.length} samples to backend API.`, r);
      const a = e.map((n) => n.id);
      se(a);
    } catch (t) {
      console.error("Failed to sync tracking data (will retry next loop):", t);
    }
}
const B = p.dirname(V(import.meta.url));
process.env.DIST = p.join(B, "../dist");
process.env.VITE_PUBLIC = d.isPackaged ? process.env.DIST : p.join(process.env.DIST, "../public");
let u = null, _ = null;
const R = process.env.VITE_DEV_SERVER_URL;
function b() {
  u = new C({
    width: 800,
    height: 600,
    webPreferences: {
      preload: p.join(B, "preload.mjs"),
      // Ensure webSecurity is on unless specifically disabled!
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), u.webContents.on("did-finish-load", () => {
    u?.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), R ? u.loadURL(R) : u.loadFile(p.join(process.env.DIST || "", "index.html"));
}
d.on("window-all-closed", () => {
  process.platform !== "darwin" && d.quit();
});
d.whenReady().then(() => {
  b(), d.on("activate", () => {
    C.getAllWindows().length === 0 && b();
  }), ae(), le(), q();
});
d.on("will-quit", () => {
  Z(), ue();
});
O.handle("start-tracking", async (e, { projectId: t, userId: o }) => {
  console.log("Starting tracking for project:", t, "user:", o);
  const r = process.env.VITE_API_BASE_URL || "http://localhost:3001";
  let a;
  try {
    const s = await fetch(`${r}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: o || "local-user", project_id: t })
    });
    s.ok ? (a = (await s.json()).session_id, console.log(`✅ Session created: ${a}`)) : (console.warn("⚠️  Backend unavailable, using local session ID"), a = "local-" + Date.now());
  } catch (s) {
    console.warn("⚠️  Could not reach backend, using local session ID:", s), a = "local-" + Date.now();
  }
  _ = a;
  const n = process.env.VITE_API_BASE_URL || "http://localhost:3001";
  return H(a, (s) => {
    u?.webContents.send("tracking-sample", s), de(s);
  }, async (s) => {
    u?.webContents.send("tracking-screenshot", s);
    try {
      const i = await fetch(`${n}/api/screenshot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s)
      });
      i.ok ? console.log("📸 Screenshot uploaded to backend") : console.error("Screenshot upload failed:", i.status);
    } catch (i) {
      console.error("Screenshot upload error (will retry next session):", i);
    }
  }, 5e3), { status: "running", session_id: a };
});
O.handle("stop-tracking", async () => {
  if (console.log("Stopping tracking"), X(), _) {
    const e = process.env.VITE_API_BASE_URL || "http://localhost:3001";
    try {
      await fetch(`${e}/api/sessions/${_}/end`, { method: "POST" }), console.log(`🏁 Session ${_} marked as ended in DB`);
    } catch (t) {
      console.warn("Could not end session in DB:", t);
    }
    _ = null;
  }
  return { status: "stopped" };
});
