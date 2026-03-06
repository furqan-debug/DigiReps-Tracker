import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

// Store in AppData so it persists between app updates
const dbPath = path.join(app.getPath('userData'), 'tracker_cache.json');

export interface ActivitySampleRow {
  id?: number;
  session_id: string;
  timestamp: string;
  mouse_count: number;
  keyboard_count: number;
  app_name: string;
  window_title: string;
  domain: string;
  idle_flag: boolean;
  type?: 'screenshot';
  file_url?: string;
  file_data?: string;
  synced: number; // 0 for false, 1 for true
}

let cache: ActivitySampleRow[] = [];
let nextId = 1;

function loadStorage() {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      cache = JSON.parse(data);
      if (cache.length > 0) {
        nextId = Math.max(...cache.map(c => c.id || 0)) + 1;
      }
    } catch (e) {
      console.error('Failed to parse cache JSON. Starting fresh.', e);
      cache = [];
    }
  }
}

function saveStorage() {
  fs.writeFileSync(dbPath, JSON.stringify(cache, null, 2), 'utf8');
}

export function initCache() {
  loadStorage();
}

export function cacheSample(sample: any) {
  const row: ActivitySampleRow = {
    id: nextId++,
    session_id: sample.session_id,
    timestamp: sample.timestamp,
    mouse_count: sample.mouse_count || 0,
    keyboard_count: sample.keyboard_count || 0,
    app_name: sample.app_name || '',
    window_title: sample.window_title || '',
    domain: sample.domain || '',
    idle_flag: sample.idle_flag ? true : false,
    type: sample.type || undefined,
    file_url: sample.file_url || '',
    file_data: sample.file_data || '',
    synced: 0
  };

  cache.push(row);
  saveStorage();
}

export function getUnsyncedSamples(): ActivitySampleRow[] {
  return cache.filter(row => row.synced === 0).slice(0, 50);
}

export function markSamplesSynced(ids: number[]) {
  if (ids.length === 0) return;

  let updated = false;
  cache = cache.map(row => {
    if (row.id && ids.includes(row.id)) {
      updated = true;
      return { ...row, synced: 1 };
    }
    return row;
  });

  // Optional: Automatically delete fully synced samples older than 7 days to keep file small
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  cache = cache.filter(row => {
    if (row.synced === 1 && new Date(row.timestamp) < sevenDaysAgo) return false;
    return true;
  });

  if (updated) {
    saveStorage();
  }
}
