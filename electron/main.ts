import { app, BrowserWindow, ipcMain, Notification } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initTracker, startTrackingSession, stopTrackingSession, teardownTracker, pauseTrackingSession, resumeTrackingSession } from './tracker';
import { initCache } from './cache';
import { initApi, teardownApi, uploadSample } from './api';

// Convert import.meta.url to __dirname for ES modules or CJS
// With vite-plugin-electron, this might be bundled as CJS or ESM.
// It's safer to use standard path utilities if bundled as CJS.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null = null;
let activeSessionId: string | null = null;  // track so we can end it
const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

function createWindow() {
    win = new BrowserWindow({
        width: 400,
        height: 600,
        minWidth: 350,
        minHeight: 500,
        webPreferences: {
            preload: path.join(__dirname, 'preload.mjs'),
            // Ensure webSecurity is on unless specifically disabled!
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    // Test active push message to Renderer-process
    win.webContents.on('did-finish-load', () => {
        win?.webContents.send('main-process-message', new Date().toLocaleString());
    });

    if (VITE_DEV_SERVER_URL) {
        win.loadURL(VITE_DEV_SERVER_URL);
    } else {
        win.loadFile(path.join(process.env.DIST || '', 'index.html'));
    }
}

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    initCache();
    initApi();
    initTracker();
});

app.on('will-quit', () => {
    teardownTracker();
    teardownApi();
});

// IPC: Start tracking — calls backend to create a session, then starts the tracker
ipcMain.handle('start-tracking', async (event, { projectId, userId }) => {
    console.log('Starting tracking for project:', projectId, 'user:', userId);

    const API_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

    let sessionId: string;
    try {
        const response = await fetch(`${API_URL}/api/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId || 'local-user', project_id: projectId })
        });

        if (response.ok) {
            const data = await response.json() as { session_id: string };
            sessionId = data.session_id;
            console.log(`✅ Session created: ${sessionId}`);
        } else {
            const errData = await response.json().catch(() => ({})) as { error?: string };
            const msg = errData.error || `Backend returned ${response.status}`;
            console.error('❌ Failed to create session:', msg);
            return { status: 'error', error: `Could not start session: ${msg}` };
        }
    } catch (err) {
        console.error('❌ Could not reach backend:', err);
        return { status: 'error', error: 'Cannot connect to the backend server. Please make sure it is running.' };
    }

    activeSessionId = sessionId;
    const API_URL_LOCAL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

    startTrackingSession(sessionId, (sample) => {
        // Send to React UI for visual verification
        win?.webContents.send('tracking-sample', sample);
        // Upload to backend/SQLite cache
        uploadSample(sample);
    }, async (screenshot) => {
        // Screenshots go directly to a dedicated endpoint (base64 is too large for heartbeat batch)
        win?.webContents.send('tracking-screenshot', screenshot);
        try {
            const res = await fetch(`${API_URL_LOCAL}/api/screenshot`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(screenshot),
            });
            if (!res.ok) console.error('Screenshot upload failed:', res.status);
            else console.log('📸 Screenshot uploaded to backend');
        } catch (err) {
            console.error('Screenshot upload error (will retry next session):', err);
        }
    }, 5000); // 5s interval for testing — use 60000 in production

    return { status: 'running', session_id: sessionId };
});

ipcMain.handle('stop-tracking', async () => {
    console.log('Stopping tracking');
    stopTrackingSession();

    // Tell backend to stamp ended_at on the session for accurate duration tracking
    if (activeSessionId) {
        const API_URL_LOCAL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';
        try {
            await fetch(`${API_URL_LOCAL}/api/sessions/${activeSessionId}/end`, { method: 'POST' });
            console.log(`🏁 Session ${activeSessionId} marked as ended in DB`);
        } catch (err) {
            console.warn('Could not end session in DB:', err);
        }
        activeSessionId = null;
    }

    return { status: 'stopped' };
});

ipcMain.handle('pause-tracking', async () => {
    console.log('Pausing tracking');
    pauseTrackingSession();
    return { status: 'paused' };
});

ipcMain.handle('resume-tracking', async () => {
    console.log('Resuming tracking');
    resumeTrackingSession();
    return { status: 'running' };
});

// IPC: Fire a native OS desktop notification
ipcMain.handle('show-notification', (_event, { title, body }: { title: string; body: string }) => {
    if (Notification.isSupported()) {
        const notif = new Notification({
            title,
            body,
            urgency: 'critical', // Windows doesn't use this much, but helps in some environments
            silent: false,      // Ensure system sound plays
        });
        notif.show();
    }
});
