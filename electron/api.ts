import { cacheSample, getUnsyncedSamples, markSamplesSynced } from './cache';

// In a real application, these should be supplied securely to the Electron environment
// via secure IPC or dynamically fetched from a config. 
// For now, they can be configured via environment variables.
const API_URL = process.env.VITE_API_BASE_URL || 'http://localhost:3001';

let syncInterval: NodeJS.Timeout | null = null;
let currentFreelancerToken: string | null = null;

export function initApi(freelancerToken?: string) {
    if (freelancerToken) {
        currentFreelancerToken = freelancerToken;
    }

    // Start the background sync loop (every 30 seconds for test; maybe 3 mins in prod)
    syncInterval = setInterval(syncTrackerData, 30000);
}

export function teardownApi() {
    if (syncInterval) clearInterval(syncInterval);
}

export async function uploadSample(sample: any) {
    // Always cache first for resilience
    cacheSample(sample);
    // Attempt immediate sync to keep UI/DB fresh
    await syncTrackerData();
}

/**
 * Background loop that pulls from SQLite cache and pushes to our Node.js Backend API
 */
export async function syncTrackerData() {
    const pendingSamples = getUnsyncedSamples();
    if (pendingSamples.length === 0) return;

    try {
        const payload = pendingSamples.map(s => ({
            session_id: s.session_id,
            timestamp: s.timestamp,
            mouse_count: s.mouse_count,
            keyboard_count: s.keyboard_count,
            app_name: s.app_name,
            window_title: s.window_title,
            domain: s.domain || '',
            idle_flag: Number(s.idle_flag) === 1,
            // We pass the screenshot base64 directly to our API for now
            file_url: s.file_url
        }));

        const response = await fetch(`${API_URL}/api/heartbeats`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(currentFreelancerToken ? { 'Authorization': `Bearer ${currentFreelancerToken}` } : {})
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        console.log(`✅ Successfully synced ${pendingSamples.length} samples to backend API.`, data);

        // If successful, mark them synced in the local SQLite DB
        const ids = pendingSamples.map(s => s.id as number);
        markSamplesSynced(ids);
    } catch (error) {
        console.error('Failed to sync tracking data (will retry next loop):', error);
    }
}
