import { uIOhook } from 'uiohook-napi';
import activeWindow from 'active-win';
import { captureScreenBase64 } from './screenshot';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

let isTracking = false;
let mouseCount = 0;
let keyboardCount = 0;
let sampleInterval: NodeJS.Timeout | null = null;
let screenshotTimeout: NodeJS.Timeout | null = null;
let currentSessionId: string | null = null;
let onSampleCallback: ((sample: any) => void) | null = null;
let onScreenshotCallback: ((screenshot: { session_id: string; timestamp: string; base64: string }) => void) | null = null;

// Screenshot window: 10 minutes, 3 shots per window
const SCREENSHOT_WINDOW_MS = 10 * 60 * 1000;  // 10 min
const SCREENSHOTS_PER_WINDOW = 3;

export function initTracker() {
    uIOhook.on('keydown', () => {
        if (isTracking) keyboardCount++;
    });

    uIOhook.on('mousedown', () => {
        if (isTracking) mouseCount++;
    });

    uIOhook.start();
}

export function startTrackingSession(
    sessionId: string,
    onSample: (sample: any) => void,
    onScreenshot: (screenshot: { session_id: string; timestamp: string; base64: string }) => void,
    intervalMs = 60000
) {
    if (isTracking) return;
    isTracking = true;
    currentSessionId = sessionId;
    onSampleCallback = onSample;
    onScreenshotCallback = onScreenshot;
    mouseCount = 0;
    keyboardCount = 0;

    // ── Activity samples ──────────────────────────────────────
    sampleInterval = setInterval(async () => {
        const activeInfo = await activeWindow();
        const appName = activeInfo?.owner.name || 'Unknown';
        const title = activeInfo?.title || 'Unknown';

        // Get browser URL — try OS accessibility first, fall back to title parsing
        const domain = await getBrowserUrl(appName, title);

        const idle = mouseCount === 0 && keyboardCount === 0;
        const sample = {
            session_id: currentSessionId,
            timestamp: new Date().toISOString(),
            mouse_count: mouseCount,
            keyboard_count: keyboardCount,
            app_name: appName,
            window_title: title,
            domain,
            idle_flag: idle,
        };

        mouseCount = 0;
        keyboardCount = 0;

        if (onSampleCallback) onSampleCallback(sample);
    }, intervalMs);

    // ── Screenshots — random interval between min/max ────────
    scheduleNextScreenshot();
}

/** Schedule exactly SCREENSHOTS_PER_WINDOW screenshots at random offsets
 *  within the next SCREENSHOT_WINDOW_MS window, then repeat.
 *
 *  Example (10-min window, 3 shots):
 *    offsets might be [1m23s, 4m51s, 8m07s]
 *    → fires at those random moments, then restarts the cycle.
 */
function scheduleNextScreenshot() {
    if (!isTracking) return;

    // Pick 3 unique random offsets within [0, WINDOW) and sort them
    const offsets: number[] = [];
    while (offsets.length < SCREENSHOTS_PER_WINDOW) {
        const t = Math.floor(Math.random() * SCREENSHOT_WINDOW_MS);
        if (!offsets.includes(t)) offsets.push(t);
    }
    offsets.sort((a, b) => a - b);

    // Chain shots sequentially, then wait out the remaining window time
    fireChain(offsets, 0, 0);
}

function fireChain(offsets: number[], idx: number, prevOffset: number) {
    if (!isTracking) return;
    if (idx >= offsets.length) {
        scheduleNextScreenshot();
        return;
    }
    const delay = offsets[idx]! - prevOffset;   // relative delay from previous shot
    screenshotTimeout = setTimeout(async () => {
        if (!isTracking || !currentSessionId) return;
        try {
            const base64 = await captureScreenBase64();
            if (base64 && onScreenshotCallback) {
                onScreenshotCallback({
                    session_id: currentSessionId,
                    timestamp: new Date().toISOString(),
                    base64,
                });
            }
        } catch (err) {
            console.error('Screenshot error:', err);
        }
        const isLast = idx === offsets.length - 1;
        if (isLast) {
            // Wait out the rest of the window, then start a fresh cycle
            const remainingMs = SCREENSHOT_WINDOW_MS - offsets[idx]!;
            screenshotTimeout = setTimeout(() => scheduleNextScreenshot(), Math.max(remainingMs, 0));
        } else {
            fireChain(offsets, idx + 1, offsets[idx]!);
        }
    }, delay);
}



export function stopTrackingSession() {
    if (!isTracking) return;
    isTracking = false;
    currentSessionId = null;
    onSampleCallback = null;
    onScreenshotCallback = null;
    if (sampleInterval) { clearInterval(sampleInterval); sampleInterval = null; }
    if (screenshotTimeout) { clearTimeout(screenshotTimeout); screenshotTimeout = null; }
}

export function teardownTracker() {
    uIOhook.stop();
}

// ─── Browser URL Extraction ────────────────────────────────────────────────────

const BROWSER_PROCESS_NAMES = new Set([
    'chrome', 'google chrome', 'chromium',
    'firefox', 'mozilla firefox',
    'msedge', 'microsoft edge',
    'safari', 'opera', 'brave browser', 'vivaldi', 'arc',
]);

// PowerShell script: reads the URL bar from Chrome/Edge/Firefox via UI Automation
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

// Suffixes browsers append to page titles
const BROWSER_TITLE_SUFFIXES = [
    / [-–—|] Google Chrome$/i, / [-–—|] Chromium$/i, / [-–—|] Microsoft Edge$/i,
    / [-–—|] Mozilla Firefox$/i, / [-–—|] Firefox$/i, / [-–—|] Safari$/i,
    / [-–—|] Opera$/i, / [-–—|] Brave$/i, / [-–—|] Vivaldi$/i, / [-–—|] Arc$/i,
];

const DOMAIN_REGEX = /(?:https?:\/\/)?([a-z0-9][a-z0-9\-]*(?:\.[a-z0-9\-]+)+)(?:[:/]|$)/i;
const LOCALHOST_REGEX = /localhost(?::[0-9]+)?/i;

async function getBrowserUrl(appName: string, title: string): Promise<string> {
    const lowerApp = appName.toLowerCase();
    const isBrowser = [...BROWSER_PROCESS_NAMES].some(b => lowerApp.includes(b));
    if (!isBrowser) return '';

    // Try PowerShell UIAutomation first (Windows only, most accurate)
    if (process.platform === 'win32') {
        try {
            const { stdout } = await execFileAsync('powershell', [
                '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', PS_GET_BROWSER_URL
            ], { timeout: 2000 });
            const url = stdout.trim();
            if (url) {
                try { return new URL(url).hostname; } catch { return url; }
            }
        } catch {
            // fall through to title parsing
        }
    }

    // Fallback: parse domain from window title
    let pageTitle = title;
    for (const suffix of BROWSER_TITLE_SUFFIXES) {
        pageTitle = pageTitle.replace(suffix, '').trim();
    }
    const localMatch = LOCALHOST_REGEX.exec(pageTitle);
    if (localMatch) return localMatch[0]!;

    const domainMatch = DOMAIN_REGEX.exec(pageTitle);
    if (domainMatch?.[1]) {
        const candidate = domainMatch[1];
        if (candidate.length >= 4 && /\.[a-z]{2,}$/i.test(candidate)) {
            return candidate.toLowerCase();
        }
    }
    return '';
}

export { getBrowserUrl };
