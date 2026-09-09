/**
 * tauri-ipc.ts
 * 
 * Drop-in replacement for Electron's window.trackerAPI.
 * When running inside Tauri, uses invoke() to call Rust commands.
 * When running in a plain browser (dev/demo), falls back to demo mode.
 */

// Tauri v2: invoke is accessed via @tauri-apps/api/core
type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

function getInvoke(): InvokeFn | null {
  // Tauri v2 exposes __TAURI__ on the window
  if (typeof window !== 'undefined' && (window as any).__TAURI__) {
    return (window as any).__TAURI__.core.invoke as InvokeFn;
  }
  return null;
}

export function isTauri(): boolean {
  return getInvoke() !== null;
}

export const trackerAPI = {
  /** Start a new tracking session — returns { status, session_id?, error? } */
  startTracking: async (projectId: string, userId: string, token?: string) => {
    const invoke = getInvoke();
    if (!invoke) return { status: 'running', session_id: 'demo-' + Date.now() };
    return invoke('start_tracking', { projectId, userId, token: token ?? '' });
  },

  /** Update Rust-side token for background sync calls */
  setAuthToken: async (token: string, supabaseUrl?: string, supabaseAnonKey?: string) => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('set_auth_token', { 
      token, 
      supabaseUrl: supabaseUrl || '', 
      supabaseAnonKey: supabaseAnonKey || '' 
    });
  },

  /** Stop the current tracking session */
  stopTracking: async () => {
    const invoke = getInvoke();
    if (!invoke) return { status: 'stopped' };
    return invoke('stop_tracking');
  },

  /** Pause the current tracking session */
  pauseTracking: async () => {
    const invoke = getInvoke();
    if (!invoke) return { status: 'paused' };
    return invoke('pause_tracking');
  },

  /** Resume the paused tracking session */
  resumeTracking: async () => {
    const invoke = getInvoke();
    if (!invoke) return { status: 'running' };
    return invoke('resume_tracking');
  },

  /** Show a native desktop notification */
  showNotification: async (title: string, body?: string) => {
    const invoke = getInvoke();
    if (!invoke) return;
    if (body === undefined) {
      return invoke('show_notification_cmd', { title: 'TrackOwl', body: title });
    }
    return invoke('show_notification_cmd', { title, body });
  },

  /** Phase 3 — stub for now; Phase 3 native hooks will emit events from Rust */
  onTrackingSample: (cb: (data: unknown) => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('tracking-sample', (ev: any) => {
        cb(ev.payload);
      });
    }
  },
  
  onScreenshotCaptured: (cb: () => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('screenshot-captured', () => {
        cb();
      });
    }
  },

  onUpdateProgress: (cb: (pct: number) => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('update-progress', (ev: any) => {
        cb(ev.payload);
      });
    }
  },

  onUpdateAvailable: (cb: (info: { available: boolean, version: string | null, notes: string | null }) => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('update-available', (ev: any) => {
        cb(ev.payload);
      });
    }
  },

  onIdleDialogDismissed: (cb: () => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('idle-dialog-dismissed', () => {
        cb();
      });
    }
  },

  onUserReturnedFromIdle: (cb: () => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('user-returned-from-idle', () => {
        cb();
      });
    }
  },

  onTrackingInterruptedSleep: (cb: () => void) => {
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      return (window as any).__TAURI__.event.listen('tracking-interrupted-sleep', () => {
        cb();
      });
    }
  },

  /** Install the pending auto-update (downloads + restarts app) */
  installUpdate: async () => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('install_update');
  },

  /** Get current inactivity status — returns true if active */
  getInactivityStatus: async (): Promise<boolean> => {
    const invoke = getInvoke();
    if (!invoke) return false;
    return invoke('get_inactivity_status') as Promise<boolean>;
  },

  /** Focus window and bring to front (optionally set always on top) */
  focusWindow: async (alwaysOnTop?: boolean): Promise<void> => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('focus_window', { alwaysOnTop }) as Promise<void>;
  },

  /** Set window always on top */
  setAlwaysOnTop: async (alwaysOnTop: boolean): Promise<void> => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('set_always_on_top', { alwaysOnTop }) as Promise<void>;
  },

  /** Show native idle dialog and focus app */
  showIdleDialog: async (limit: number): Promise<void> => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('show_idle_dialog', { limit }) as Promise<void>;
  },

  /** Start background idle monitoring in Rust */
  startIdleMonitoring: async (limit: number): Promise<void> => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('start_idle_monitoring', { limit }) as Promise<void>;
  },

  /** Stop background idle monitoring in Rust */
  stopIdleMonitoring: async (): Promise<void> => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('stop_idle_monitoring') as Promise<void>;
  },

  /** Get user location via Rust (bypasses UI CSP) */
  getLocation: async (): Promise<string> => {
    const invoke = getInvoke();
    if (!invoke) return '';
    try {
      return await invoke('get_location') as string;
    } catch (e) {
      return '';
    }
  },

  /** Set close behavior: 'quit' (stop+exit) or 'minimize' (hide window) */
  setCloseBehavior: async (behavior: 'quit' | 'minimize') => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('set_close_behavior', { behavior });
  },

  /** Manually trigger sync of cached data to server */
  syncNow: async () => {
    const invoke = getInvoke();
    if (!invoke) return;
    return invoke('sync_now');
  },

  /**
   * Purge idle samples from the local SQLite cache for a session after a given ISO timestamp.
   * Must be called alongside the Supabase delete in discardIdleTime so that
   * stop_tracking's cache sync doesn't re-upload idle samples that were discarded.
   */
  discardIdleCache: async (sessionId: string, afterIso: string): Promise<void> => {
    const invoke = getInvoke();
    if (!invoke) return;
    try {
      await invoke('discard_idle_cache', { sessionId, afterIso });
    } catch (e) {
      console.warn('[trackerAPI] discardIdleCache failed (non-fatal):', e);
    }
  },
};
