# Phase 3: Desktop -> Backend Link Design

Our goal is to modify the existing `h:\DigiReps\DigiReps Tracker` desktop app (Electron) to stop using Supabase directly and instead send its payload logic to the new `localhost:3001` Express API we built.

**Steps:**
1. **Update API Endpoint (`electron/api.ts`)**
   - Change `const SUPABASE_URL` to `const API_URL = process.env.VITE_API_URL || 'http://localhost:3001'`
   - Inside `syncTrackerData()`, instead of `supabase.from('...').insert()`, use `fetch()` or `axios` to POST the heartbeat payload to `/api/heartbeats`.

2. **Handle Screenshots:**
   - Currently, `screenshot.ts` captures base64. The Node.js Express API will need to accept this base64 and forward it to Supabase storage, or provide a pre-signed URL to the Electron app to upload it directly. To save on Node.js bandwidth, the pre-signed URL approach is preferred.

## The Sync Sequence
- `electron/tracker.ts`: Polling mouse/keyboard counts & active window
- `electron/api.ts`: Triggered via `setTimeout`, collects `getUnsyncedSamples()` from sqlite/cache
- `electron/api.ts`: `fetch.post(APIURL + '/api/heartbeats', pendingSamples)`
- Backend: Calculates Activity %, Saves to Supabase, returns `{success:true}`
- `electron/api.ts`: `markSamplesSynced()`

I will implement these frontend changes in the `DigiReps Tracker` now.
