import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Mail, ArrowRight, Square, Play,
  ChevronRight, LogOut, CheckCircle2,
  ShieldAlert, Eye, EyeOff, MapPin, MonitorPlay, MousePointerClick,
  ClipboardList, Calendar, Circle, ChevronDown, ChevronUp, Clock,
  User as UserIcon, Save, RefreshCcw,
   LifeBuoy, MessageSquare, Send, ArrowLeft,
   Bell, ShieldCheck, Smartphone, Trash2
} from 'lucide-react';
import { trackerAPI } from './tauri-ipc';
import { UpdaterOverlay } from './components/UpdaterOverlay';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import './App.css';

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || 'https://lgmggbnaoyoapxqsfgzv.supabase.co') as string;
const SUPABASE_ANON_KEY = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxnbWdnYm5hb3lvYXB4cXNmZ3p2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NTMxNDIsImV4cCI6MjA4ODEyOTE0Mn0.GkzsADYd-kpJYTgY9EZGwgy5kvN6nyYmfVoLUHRJQI4') as string;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('⚠️ Supabase URL or Anon Key is missing from environment variables.');
}

const supabaseInstance: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function getSupabase() {
  return supabaseInstance;
}

type Screen = 'login' | 'projects' | 'consent' | 'tracker' | 'settings' | 'support';

interface NotificationSettings {
  tracking_alerts: boolean;
  screenshot_alerts: boolean;
  tracking_reminders: boolean;
  reminder_interval?: number;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  weekly_limit?: number;
  daily_limit?: number;
  idle_limit?: number;
  idle_enabled?: boolean;
  keep_idle_mode?: 'prompt' | 'always' | 'never';
  tracking_enabled?: boolean;
  avatar_url?: string;
  phone?: string;
  work_phone?: string;
  personal_phone?: string;
  organization_id?: string;
  timezone?: string;
  keep_idle?: boolean;
  custom_fields?: {
    notification_settings?: NotificationSettings;
    close_behavior?: 'quit' | 'minimize';
  };
  plan_type?: string;
  organization_settings?: {
    autoStopOnIdle?: boolean;
    idleAutoStopMinutes?: number;
    /** IANA zone defining the payroll day boundary, e.g. 'America/Los_Angeles'. */
    orgTimezone?: string;
  };
}

async function syncTimezone(sb: any, memberId: string, memberTz: string | null | undefined) {
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!memberTz && localTz) {
      // Write once on first detection to populate Tier B (Activity Timeline) for fresh users.
      // We do NOT overwrite this on subsequent logins to protect traveling users from historical corruption.
      await sb.from('members').update({ timezone: localTz }).eq('id', memberId);
      console.log(`Initialized timezone to ${localTz}`);
      return localTz;
    }
    return memberTz || localTz;
  } catch (e) {
    console.error('Failed to sync timezone', e);
    return memberTz;
  }
}

export function orgLocalToUtc(dateStr: string, timeOfDay: 'start' | 'end', tz: string): Date {
  const [y, mo, d] = dateStr.split('-').map(Number);
  const getOrgDate = (utcMs: number) =>
    new Date(utcMs).toLocaleDateString('en-CA', { timeZone: tz });

  const lo0 = Date.UTC(y, mo - 1, d - 1, 0, 0, 0);
  const hi0 = Date.UTC(y, mo - 1, d + 2, 0, 0, 0);

  if (timeOfDay === 'start') {
    let lo = lo0, hi = hi0;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (getOrgDate(mid) >= dateStr) hi = mid;
      else lo = mid + 1;
    }
    return new Date(lo);
  } else {
    let lo = lo0, hi = hi0;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (getOrgDate(mid) <= dateStr) lo = mid;
      else hi = mid - 1;
    }
    return new Date(lo);
  }
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
  stats?: {
    todaySeconds: number;
    weeklySeconds: number;
    weeklyIdleSeconds?: number;
    activityPercent: number;
    keptIdleSeconds?: number;
  };
}

interface Todo {
  id: string;
  title: string;
  description?: string;
  status: 'Todo' | 'In Progress' | 'Done';
  due_date?: string;
  project_id?: string;
  assignee_id?: string;
  projectName?: string;
  projectColor?: string;
}

// ── Signed Image Component ──────────────────────────────────────────────────
function SignedImage({ path, bucket, className, alt = "" }: { path: string; bucket: string; className?: string; alt?: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!path) return;
    if (path.startsWith('http') && !path.includes('.supabase.co/storage/v1/object/')) {
      setUrl(path);
      return;
    }

    // Extract path from Supabase storage URL if needed
    let finalPath = path;
    if (path.includes('.supabase.co/storage/v1/object/')) {
      const parts = path.split('/avatars/');
      if (parts.length > 1) finalPath = parts[1];
    }

    let isMounted = true;
    const fetchUrl = async () => {
      try {
        const sb = await getSupabase();
        const { data, error } = await sb.storage.from(bucket).createSignedUrl(finalPath, 3600);
        if (error) throw error;
        if (isMounted) setUrl(data.signedUrl);
      } catch (err) {
        console.error('Error fetching signed URL:', err);
      }
    };

    fetchUrl();
    return () => { isMounted = false; };
  }, [path, bucket]);

  if (!url) return <div className={className} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>...</div>;
  return <img src={url} alt={alt} className={className} />;
}

const TOKEN_KEY = 'digireps_token';
const USER_KEY = 'digireps_user';
const CONSENT_KEY = 'digireps_consent_v1';

function loadSession(): { token: string } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) return { token };
  } catch { }
  return null;
}
function saveSession(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY); // Clean up legacy key
}
function hasConsented(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}
function saveConsent() {
  localStorage.setItem(CONSENT_KEY, 'true');
}

function formatTime(seconds: number): string {
  if (Math.abs(seconds) < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(Math.abs(seconds) / 3600);
  const m = Math.floor((Math.abs(seconds) % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ── Clock & Local Context ──────────────────────────────────────────────────
function tzToCity(tz: string): string {
  // Extract city from IANA timezone, e.g. "America/Los_Angeles" -> "Los Angeles"
  // or "Asia/Karachi" -> "Karachi"
  const parts = tz.split('/');
  const city = parts[parts.length - 1].replace(/_/g, ' ');
  return city;
}

function LocalClock({ orgTimezone }: { orgTimezone?: string }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const tz = orgTimezone || 'UTC';
  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: tz });
  const dateStr = now.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
  const cityStr = orgTimezone ? tzToCity(orgTimezone) : '';

  return (
    <div className="local-context" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '0.875rem', margin: '0 0.875rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: '#fff', fontWeight: 700, fontSize: '0.875rem' }}>
        <span>{timeStr}</span>
        <span style={{ fontSize: '0.6875rem', opacity: 0.6, fontWeight: 400 }}>{dateStr}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.625rem', color: 'rgba(255,255,255,0.7)', marginTop: '0.125rem', whiteSpace: 'nowrap' }}>
        <Clock size={10} style={{ opacity: 0.8 }} />
        <span>Company Time{cityStr ? ` — ${cityStr}` : ''}</span>
      </div>
    </div>
  );
}

// ── App Footer (Auto-sync & Location) ──────────────────────────────────────────
function AppFooter({ lastSyncTime, isSyncing, onSync, isOnline }: {
  lastSyncTime: Date | null,
  isSyncing: boolean,
  onSync: () => void,
  isOnline: boolean
}) {
  const [version, setVersion] = useState<string>('...');
  const [loc, setLoc] = useState<string | null>(null);

  useEffect(() => {
    // 1. Get Version (Injected at build time via Vite to ensure it always loads instantly)
    setVersion((import.meta.env as any).VITE_APP_VERSION || '1.3.4');

    // 2. Get Location
    const fetchLoc = async () => {
      const locStr = await trackerAPI.getLocation();
      if (locStr) setLoc(locStr);
    };

    fetchLoc();
  }, []);

  const syncTimeStr = lastSyncTime
    ? lastSyncTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : '';

  return (
    <footer className="app-footer">
      <div className="footer-left">
        <div className={`footer-sync-wrap ${!isOnline ? 'is-offline' : ''}`}>
          <button
            className={`footer-sync-btn ${isSyncing ? 'syncing' : ''} ${!isOnline ? 'disconnected' : ''}`}
            onClick={onSync}
            disabled={isSyncing}
            title={isOnline ? "Force refresh data from server" : "Offline - Click to try reconnecting"}
          >
            <RefreshCcw size={14} className={isSyncing ? 'animate-spin' : ''} />
          </button>
          <div className="footer-sync-text">
            <span className={`sync-status-indicator ${!isOnline ? 'offline' : ''}`}></span>
            {!isOnline ? 'Offline - Waiting for connection' : (lastSyncTime ? `Synced at ${syncTimeStr}` : 'Syncing...')}
          </div>
        </div>
      </div>

      <div className="footer-right">
        <div className="footer-meta-item">
          <Smartphone size={12} className="meta-icon" />
          <span className="footer-version">v{version}</span>
        </div>
        {loc && (
          <div className="footer-meta-item">
            <MapPin size={12} className="meta-icon" />
            <span className="footer-location">{loc}</span>
          </div>
        )}
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Settings
// ─────────────────────────────────────────────────────────────────────────────
function SettingsScreen({ user, onSave, onBack, onLogout, onDeleteAccount }: {
  user: User;
  onSave: (updated: Partial<User>) => Promise<void>;
  onBack: () => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
}) {
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone || '');
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '');
  const [notifyTracking, setNotifyTracking] = useState(user.custom_fields?.notification_settings?.tracking_alerts ?? true);
  const [notifyScreenshots, setNotifyScreenshots] = useState(user.custom_fields?.notification_settings?.screenshot_alerts ?? true);
  const [notifyReminders, setNotifyReminders] = useState(user.custom_fields?.notification_settings?.tracking_reminders ?? true);
  const [closeBehavior] = useState<'quit' | 'minimize'>('quit');
  const [isSaving, setIsSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orgName, setOrgName] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDeleteAccount() {
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await onDeleteAccount();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account. Please try again.');
      setDeleteLoading(false);
    }
  }

  useEffect(() => {
    // Sync to Rust on mount
    trackerAPI.setCloseBehavior(closeBehavior);
  }, []);

  // Fetch organization name on mount
  useEffect(() => {
    if (!user.organization_id) return;
    getSupabase().then(async (sb: any) => {
      const { data } = await sb
        .from('organizations')
        .select('name')
        .eq('id', user.organization_id)
        .maybeSingle();
      if (data?.name) setOrgName(data.name);
    });
  }, [user.organization_id]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const sb = await getSupabase();
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${user.organization_id}/${user.id}/${fileName}`;

      const { error: uploadError } = await sb.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      setAvatarUrl(filePath);
    } catch (err: any) {
      console.error('Upload failed:', err.message);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setIsSaving(true);
    const updatedCustomFields = {
      ...(user.custom_fields || {}),
      notification_settings: {
        ...(user.custom_fields?.notification_settings || {}),
        tracking_alerts: notifyTracking,
        screenshot_alerts: notifyScreenshots,
        tracking_reminders: notifyReminders
      }
    };
    await onSave({
      full_name: fullName,
      phone,
      work_phone: phone,
      personal_phone: phone,
      avatar_url: avatarUrl,
      custom_fields: {
        ...updatedCustomFields,
        close_behavior: 'quit'
      }
    });
    trackerAPI.setCloseBehavior(closeBehavior);
    setIsSaving(false);
  }

  return (
    <div className="settings-screen">
      <header className="settings-header">
        <button onClick={onBack} className="settings-back-btn">
          <ArrowLeft size={20} />
        </button>
        <div className="settings-header-titles">
          <h2 className="heading-2">Settings</h2>
          <p className="text-muted">Personalize your experience</p>
        </div>
      </header>

      <div className="settings-content">
        {/* Profile Card */}
        <div className="settings-card profile-card">
          <div className="avatar-section">
            <div className="avatar-preview-container">
              {avatarUrl ? (
                <SignedImage path={avatarUrl} bucket="avatars" className="avatar-preview-large" />
              ) : (
                <div className="avatar-placeholder-large">
                  <UserIcon size={32} />
                </div>
              )}
              <button className="btn-avatar-edit" onClick={() => fileInputRef.current?.click()} title="Change Avatar">
                {uploading ? '...' : (
                  <img
                    src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'/%3E%3Cpolyline points='17 8 12 3 7 8'/%3E%3Cline x1='12' y1='3' x2='12' y2='15'/%3E%3C/svg%3E"
                    alt="Upload"
                    style={{ width: '16px', height: '16px', display: 'block', margin: 'auto' }}
                  />
                )}
              </button>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" style={{ display: 'none' }} />
            </div>
            <div className="profile-identity">
              <h3 className="profile-name">{fullName || 'Your Name'}</h3>
              <p className="profile-email">{user.email}</p>
              {orgName && (
                <p className="profile-org">{orgName}</p>
              )}
            </div>
          </div>
        </div>

        {/* Form Sections */}
        <div className="settings-form-container">
          <div className="settings-section">
            <div className="section-header">
              <UserIcon size={16} className="section-icon" />
              <h3 className="section-title">Personal Information</h3>
            </div>

            <div className="settings-group">
              <div className="field-group">
                <label className="field-label">Full Name</label>
                <div className="field-input-wrap">
                  <UserIcon size={14} className="field-icon" />
                  <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className="field-input" placeholder="John Doe" />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Phone Number</label>
                <div className="field-input-wrap">
                  <Smartphone size={14} className="field-icon" />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="field-input" placeholder="+1 (555) 000-0000" />
                </div>
              </div>

              <div className="field-group">
                <label className="field-label">Email Address</label>
                <div className="field-input-wrap disabled">
                  <Mail size={14} className="field-icon" />
                  <input type="email" value={user.email} disabled className="field-input" />
                  <div className="verified-badge">
                    <ShieldCheck size={10} />
                    <span>VERIFIED</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <div className="section-header">
              <Bell size={16} className="section-icon" />
              <h3 className="section-title">Notifications</h3>
            </div>

            <div className="settings-group">
              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Tracking Alerts</span>
                  <span className="toggle-desc">Notify when tracking starts/stops</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={notifyTracking} onChange={e => setNotifyTracking(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>

              {(user.plan_type === 'Premium' || user.plan_type === 'Trial') && (
                <div className="toggle-row">
                  <div className="toggle-info">
                    <span className="toggle-label">Screenshot Alerts</span>
                    <span className="toggle-desc">Notify on every screen capture</span>
                  </div>
                  <label className="switch">
                    <input type="checkbox" checked={notifyScreenshots} onChange={e => setNotifyScreenshots(e.target.checked)} />
                    <span className="slider round"></span>
                  </label>
                </div>
              )}

              <div className="toggle-row">
                <div className="toggle-info">
                  <span className="toggle-label">Tracking Reminders</span>
                  <span className="toggle-desc">Nudge if I'm not tracking time</span>
                </div>
                <label className="switch">
                  <input type="checkbox" checked={notifyReminders} onChange={e => setNotifyReminders(e.target.checked)} />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-footer">
            <button onClick={save} disabled={isSaving || uploading} className="btn btn-primary btn-save">
              <Save size={18} />
              <span>{isSaving ? 'Saving Changes...' : 'Save Changes'}</span>
            </button>
            <button onClick={() => { onBack(); onLogout(); }} className="btn-logout-settings">
              <LogOut size={16} />
              <span>Log Out</span>
            </button>
            <button
              onClick={() => { setShowDeleteConfirm(true); setDeleteError(null); }}
              className="btn-delete-account"
              style={{ marginTop: '0.5rem', background: 'transparent', border: '1px solid var(--error, #ef4444)', color: 'var(--error, #ef4444)', borderRadius: 8, padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}
            >
              <Trash2 size={14} />
              <span>Delete My Account</span>
            </button>
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ background: 'var(--card-bg)', borderRadius: 16, padding: '1.75rem', maxWidth: 360, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.4)', border: '1px solid var(--border-light)' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(239,68,68,0.1)', borderRadius: '50%', width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <Trash2 size={22} style={{ color: '#ef4444' }} />
              </div>
              <h3 style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.5rem' }}>Delete Account?</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                This will permanently delete your account and all associated tracked time, screenshots, and activity data. <strong>This cannot be undone.</strong>
              </p>
            </div>
            {deleteError && (
              <p style={{ color: '#ef4444', fontSize: '0.75rem', textAlign: 'center', marginBottom: '0.75rem' }}>{deleteError}</p>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleteLoading}
                style={{ flex: 1, padding: '0.625rem', borderRadius: 8, border: '1px solid var(--border-light)', background: 'transparent', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteLoading}
                style={{ flex: 1, padding: '0.625rem', borderRadius: 8, border: 'none', background: '#ef4444', color: '#fff', fontWeight: 700, fontSize: '0.875rem', cursor: deleteLoading ? 'not-allowed' : 'pointer', opacity: deleteLoading ? 0.7 : 1 }}
              >
                {deleteLoading ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SupportScreen({ user, onBack }: { user: User; onBack: () => void }) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSending(true);
    setError(null);
    try {
      const sb = await getSupabase();
      const { error: submitError } = await sb.from('support_tickets').insert({
        user_id: user.id,
        organization_id: user.organization_id,
        subject,
        message,
      });
      if (submitError) throw submitError;
      setSent(true);
    } catch (err: any) {
      setError('Unable to send message. Please try again later or contact support directly.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="support-screen">
      <header className="settings-header">
        <button onClick={onBack} className="settings-back-btn">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="heading-2">Support & Help</h2>
          <p className="text-muted" style={{ fontSize: '0.6875rem', marginTop: '0.125rem' }}>How can we help you today?</p>
        </div>
      </header>

      <div className="settings-content" style={{ padding: '1.5rem' }}>
        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="support-success"
              style={{ textAlign: 'center', padding: '2rem 1rem' }}
            >
              <div className="success-icon-wrap" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'center' }}>
                <div style={{ background: 'var(--success-bg)', color: 'var(--success)', padding: '1rem', borderRadius: '50%' }}>
                  <CheckCircle2 size={48} />
                </div>
              </div>
              <h3 className="heading-3">Message Sent!</h3>
              <p className="text-muted" style={{ marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Thank you for reaching out. Our support team will get back to you at <strong>{user.email}</strong> as soon as possible.
              </p>
              <button onClick={onBack} className="btn btn-primary" style={{ width: '100%' }}>
                Back to Dashboard
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="form"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="support-options" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem' }}>
                <div className="support-option-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-light)',
                  padding: '1rem',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <LifeBuoy size={20} style={{ color: 'var(--accent)', marginBottom: '0.5rem' }} />
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Guides</h4>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Help documentation</p>
                </div>
                <div className="support-option-card" style={{
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border-light)',
                  padding: '1rem',
                  borderRadius: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}>
                  <MessageSquare size={20} style={{ color: 'var(--success)', marginBottom: '0.5rem' }} />
                  <h4 style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Chat</h4>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>Talk to an agent</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="support-form">
                <div className="field-group">
                  <label className="field-label">Subject</label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="field-input"
                    placeholder="Briefly describe your issue"
                  />
                </div>
                <div className="field-group">
                  <label className="field-label">Message</label>
                  <textarea
                    required
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    className="field-input"
                    style={{ minHeight: '120px', paddingTop: '0.75rem', resize: 'none' }}
                    placeholder="Tell us more about what's happening..."
                  />
                </div>

                {error && (
                  <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
                    <ShieldAlert size={14} /><span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={sending} className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                  {sending ? 'Sending...' : 'Send Message'}
                  {!sending && <Send size={16} style={{ marginLeft: '0.5rem' }} />}
                </button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [liveElapsed, setLiveElapsed] = useState<number>(0);
  const sessionElapsedRef = useRef<number>(0);

  useEffect(() => {
    let int: any;
    if (isTracking && !isPaused) {
      int = setInterval(() => setLiveElapsed(e => e + 1), 1000);
    }
    return () => clearInterval(int);
  }, [isTracking, isPaused]);
  const [sessionId, _setSessionId] = useState<string | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const setSessionId = (id: string | null) => {
    sessionIdRef.current = id;
    _setSessionId(id);
  };
  const [rememberMe, setRememberMe] = useState(true);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  useEffect(() => {
    if (isOnline && (trackingError?.includes('offline') || trackingError?.includes('Network error'))) {
      setTrackingError(null);
    }
  }, [isOnline, trackingError]);
  const [todos, setTodos] = useState<Todo[]>([]);
  const idleMinutesRef = useRef(0);
  const isHandlingIdleRef = useRef(false); // guard against double-fire on listener re-subscription

  // ─── Block-aligned idle tracking ────────────────────────────────────────────
  // Idle is evaluated per fixed 10-minute clock block (09:00–09:10, 09:10–09:20…),
  // not as a rolling countdown from the last active minute. A block that closes
  // with at least one active minute is kept whole; a block that closes completely
  // blank is what triggers idle. So activity at 09:07 protects the entire
  // 09:00–09:10 block, and the clock only starts again at 09:10.
  const BLOCK_MS = 10 * 60 * 1000;
  const currentBlockIdRef = useRef<number | null>(null);   // block we're filling
  const blockHadActivityRef = useRef(false);               // ...and whether it has seen input
  const blankBlockCountRef = useRef(0);                    // consecutive fully-blank blocks
  const lastActiveBlockEndRef = useRef<number | null>(null); // epoch ms; discard/resume point
  // Idle closes the session outright rather than pausing it, so resuming has to
  // open a fresh one. A session then never contains a hole — the time it spans
  // always equals the time it is credited.
  const idleClosedSessionRef = useRef(false);
  const pendingIdleDiscardRef = useRef<Promise<void> | null>(null); // tracks in-flight idle discard
  // Tracks continuous zero-activity minutes for the org-level absolute auto-terminate cutoff.
  // This counter is independent of keep_idle_mode — it increments on EVERY 0% sample regardless
  // of whether the user is set to "Always Keep" idle. Resets to 0 on any active sample.
  const absoluteIdleRef = useRef(0);
  const isAutoTerminatingRef = useRef(false); // guard against duplicate auto-terminate calls
  const isFetchingStatsRef = useRef(false); // persistent concurrency guard for stats fetching
  // After a limit-triggered stop, holds the minimum todaySeconds to display so the DB lag
  // cannot push the display below the snapped limit value. Expires after 30s.
  const limitFloorRef = useRef<{ projectId: string; minTodaySecs: number; expiresAt: number } | null>(null);
  const [idlePaused, setIdlePaused] = useState(false);
  const [liveIdleSeconds, setLiveIdleSeconds] = useState(0); // live idle tracking for current session
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<any>(null);
  const [updateVersion, setUpdateVersion] = useState<string | null>(null);
  const [updateInstalling, setUpdateInstalling] = useState(false);
  const [updateProgress, setUpdateProgress] = useState(0);
  const memberSubscriptionRef = useRef<any>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(() => {
    const stored = localStorage.getItem('lastSyncTime');
    return stored ? new Date(stored) : null;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [orgTimezone, setOrgTimezone] = useState<string>('UTC');
  // Last successfully resolved org timezone. Held in a ref (not state) so
  // fetchDashboardStats can read it without a stale-closure problem, and kept
  // null until genuinely known so "unresolved" is distinguishable from "UTC".
  const orgTimezoneRef = useRef<string | null>(null);
  // Org-local date string ('YYYY-MM-DD') that the on-screen totals belong to,
  // used to detect the payroll day rolling over while the app stays open.
  const orgDayRef = useRef<string | null>(null);

  const handleManualSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await trackerAPI.syncNow();
      if (user) await fetchDashboardStats(user.id, projects);
      setIsOnline(true);
      const now = new Date();
      setLastSyncTime(now);
      localStorage.setItem('lastSyncTime', now.toISOString());
    } catch (e: any) {
      console.error('[App] Sync failed:', e);
      const errMsg = e.toString();
      if (errMsg.includes('transport error') || errMsg.includes('Dns Failed')) {
        setIsOnline(false);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Keep a ref of notification settings for listeners/intervals to avoid stale closures
  const settingsRef = useRef(user?.custom_fields?.notification_settings);
  useEffect(() => {
    settingsRef.current = user?.custom_fields?.notification_settings;
  }, [user?.custom_fields?.notification_settings]);

  useEffect(() => {
    trackerAPI.setCloseBehavior('quit');
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (isTracking) {
        // Use the non-async version or fire and forget if necessary, 
        // but for Tauri/Browser we want to attempt closure.
        trackerAPI.stopTracking();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isTracking]);

  async function fetchDashboardStats(userId: string, currentProjects: Project[]) {
    if (isFetchingStatsRef.current) return;
    isFetchingStatsRef.current = true;
    try {
      const sb = await getSupabase();

      // Resolve the org timezone — it defines the payroll day boundary.
      // This must NEVER silently fall back to a guess: bucketing the day in the
      // wrong timezone attributes yesterday evening's tracked time to today, and
      // because the resolved value is baked into todaySeconds (a stored number,
      // not a render-time lookup) a single bad read stays wrong for the whole
      // session. One query now returns both the org id and its settings, using
      // the same embedded join the login/restore paths already rely on.
      // Uses the userId parameter, not the stale closure `user`.
      const { data: memberData, error: memberErr } = await sb
        .from('members')
        .select('organization_id, organizations(settings)')
        .eq('id', userId)
        .maybeSingle();

      if (memberErr) console.error('[stats] member/org lookup failed:', memberErr);

      const orgObj = Array.isArray(memberData?.organizations) ? memberData?.organizations[0] : memberData?.organizations;
      const orgTimezone =
        (orgObj as any)?.settings?.orgTimezone
        || orgTimezoneRef.current
        || user?.organization_settings?.orgTimezone;

      // With no known boundary we cannot compute "today" at all. Leave the totals
      // already on screen untouched and retry on the next refresh — a stale number
      // is recoverable, a confidently wrong payroll number is not.
      if (!orgTimezone) {
        console.error('[stats] org timezone unresolved — skipping stats computation');
        return;
      }

      orgTimezoneRef.current = orgTimezone;
      setOrgTimezone(orgTimezone);

      const now = new Date();
      const todayInOrg = now.toLocaleDateString('en-CA', { timeZone: orgTimezone });

      // Start of current week in orgTimezone (Monday)
      const [y, mo, d] = todayInOrg.split('-').map(Number);
      const baseMidnight = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0));
      const dayOfWeek = parseInt(baseMidnight.toLocaleDateString('en-US', { timeZone: orgTimezone, weekday: 'short' }) === 'Sun' ? '7' :
          ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(baseMidnight.toLocaleDateString('en-US', { timeZone: orgTimezone, weekday: 'short' })).toString());
      const daysToLastMon = dayOfWeek - 1; // days since Monday
      
      // Calculate Monday's date string in orgTimezone
      const monD = new Date(Date.UTC(y, mo - 1, d - daysToLastMon, 12, 0, 0));
      const monDateStr = monD.toLocaleDateString('en-CA', { timeZone: orgTimezone });
      
      // Exact integer binary search for Monday's midnight in orgTimezone
      const weekStartUtc = orgLocalToUtc(monDateStr, 'start', orgTimezone);
      const weekStartIso = weekStartUtc.toISOString();

      const todayStr = todayInOrg;

      // 1. Fetch user's sessions for this week
      const { data: sessionData, error: sessionErr } = await sb
        .from('sessions')
        .select('id, project_id, started_at, ended_at')
        .eq('user_id', userId)
        .gte('started_at', weekStartIso);

      if (sessionErr) throw sessionErr;

      const sessionMap = new Map<string, string>();
      const sessionIds: string[] = [];
      for (const s of (sessionData || [])) {
        sessionMap.set(s.id, s.project_id);
        sessionIds.push(s.id);
      }

      // Fetch ALL samples for this week (Paginated to bypass 1000 row limit)
      let allSamples: any[] = [];
      const PAGE_SIZE = 1000;
      let hasMore = true;
      let page = 0;

      if (sessionIds.length > 0) {
        // chunk sessionIds if too large, but usually fine for a single week
        while (hasMore && page < 50) { // Safety limit 50k
          const { data: _samples, error: _sampleError } = await sb
            .from('activity_samples')
            .select(`
              recorded_at,
              idle,
              activity_percent,
              session_id
            `)
            .in('session_id', sessionIds)
            .gte('recorded_at', weekStartIso)
            .order('recorded_at', { ascending: true })
            .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

          if (_sampleError) throw _sampleError;

          if (_samples && _samples.length > 0) {
            allSamples.push(..._samples.map((s: any) => ({
              ...s,
              sessions: { project_id: sessionMap.get(s.session_id) }
            })));
          }

          if (!_samples || _samples.length < PAGE_SIZE) {
            hasMore = false;
          }
          page++;
        }
      }

      const samples = allSamples;

      const statsMap: Record<string, any> = {};
      currentProjects.forEach(p => {
        statsMap[p.id] = { todaySeconds: 0, weeklySeconds: 0, weeklyIdleSeconds: 0, totalActivity: 0, sampleCount: 0, keptIdleSeconds: 0 };
      });

      const minuteMap = new Map<string, any>();
      (samples || []).forEach(s => {
        const minute = s.recorded_at ? s.recorded_at.substring(0, 16) : '';
        if (!minute) return;
        const key = `${s.session_id}_${minute}`;
        const existing = minuteMap.get(key);
        if (!existing) {
          minuteMap.set(key, s);
        } else {
          // If either duplicate sample for the minute was marked idle=true, preserve idle=true
          const isIdle = existing.idle === true || s.idle === true;
          const activity = isIdle ? 0 : Math.max(existing.activity_percent ?? 0, s.activity_percent ?? 0);
          minuteMap.set(key, {
            ...existing,
            ...s,
            idle: isIdle,
            activity_percent: activity,
          });
        }
      });
      const dedupedSamples = Array.from(minuteMap.values());

      // Use the user's idle_limit (default to 10)
      const idleLimit = user?.idle_limit ?? 10;

      // Formatter to bucket samples by orgTimezone day
      const fmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: orgTimezone,
        year: 'numeric', month: '2-digit', day: '2-digit'
      });

      // Group samples by project to calculate threshold-aware stats
      const samplesByProject = new Map<string, any[]>();
      dedupedSamples.forEach(s => {
        const pid = s.sessions?.project_id;
        if (!pid || !statsMap[pid]) return;
        if (!samplesByProject.has(pid)) samplesByProject.set(pid, []);
        samplesByProject.get(pid)!.push(s);
      });

      samplesByProject.forEach((projectSamples, pid) => {
        const sorted = projectSamples.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

        let currentBlock: any[] = [];
        const countedAsIdle = new Set<string>(); // minutes (recorded_at strings)

        for (let i = 0; i < sorted.length; i++) {
          const s = sorted[i];
          const prev = i > 0 ? sorted[i - 1] : null;

          const gapMs = prev ? (new Date(s.recorded_at).getTime() - new Date(prev.recorded_at).getTime()) : 0;
          const isContiguous = prev && gapMs <= 125000;

          if (s.idle && isContiguous) {
            currentBlock.push(s);
          } else if (s.idle && !prev) {
            currentBlock = [s];
          } else if (s.idle && !isContiguous) {
            // End of a non-contiguous idle block
            if (currentBlock.length >= idleLimit) {
              currentBlock.forEach(b => countedAsIdle.add(b.recorded_at));
            }
            currentBlock = [s];
          } else {
            // Non-idle sample encountered
            if (currentBlock.length >= idleLimit) {
              currentBlock.forEach(b => countedAsIdle.add(b.recorded_at));
            }
            currentBlock = [];
          }
        }
        // Final block check
        if (currentBlock.length >= idleLimit) {
          currentBlock.forEach(b => countedAsIdle.add(b.recorded_at));
        }

        sorted.forEach(samp => {
          const dateStr = fmt.format(new Date(samp.recorded_at));
          const isIdle = countedAsIdle.has(samp.recorded_at);

          // Every sample represents 1 minute (60s) of tracked time
          statsMap[pid].weeklySeconds += 60;
          if (isIdle) {
            statsMap[pid].weeklyIdleSeconds += 60;
          }
          if (dateStr === todayStr) {
            statsMap[pid].todaySeconds += 60;
            if (isIdle) {
              statsMap[pid].keptIdleSeconds += 60;
            }
          }

          statsMap[pid].totalActivity += (samp.activity_percent ?? 0);
          statsMap[pid].sampleCount++;
        });
      });

      // Apply limit floor: after a limit-triggered stop, DB may lag 1-2 min.
      // Floor todaySeconds to the snapped value so the UI never drops below it.
      const floor = limitFloorRef.current;
      const floorActive = floor !== null && Date.now() < floor.expiresAt;
      if (floor !== null && !floorActive) limitFloorRef.current = null; // expire

      const updatedProjects = currentProjects.map(p => {
        const stat = statsMap[p.id];
        if (!stat) return { ...p, stats: { todaySeconds: 0, weeklySeconds: 0, weeklyIdleSeconds: 0, activityPercent: 0, keptIdleSeconds: 0 } };
        const todaySeconds = (floorActive && floor!.projectId === p.id)
          ? Math.max(stat.todaySeconds, floor!.minTodaySecs)
          : stat.todaySeconds;
        return {
          ...p,
          stats: {
            todaySeconds,
            weeklySeconds: stat.weeklySeconds,
            weeklyIdleSeconds: stat.weeklyIdleSeconds,
            keptIdleSeconds: stat.keptIdleSeconds,
            activityPercent: stat.sampleCount > 0
              ? Math.round(stat.totalActivity / stat.sampleCount)
              : 0
          }
        };
      });
      setProjects(updatedProjects);
      setIsOnline(true);

      setLastSyncTime(now);
      localStorage.setItem('lastSyncTime', now.toISOString());
    } catch (err: any) {
      console.error('fetchStats error:', err);
      const errMsg = err.toString();
      if (errMsg.includes('transport error') || errMsg.includes('Dns Failed')) {
        setIsOnline(false);
      }
    } finally {
      isFetchingStatsRef.current = false;
    }
  }

  useEffect(() => {
    const tauri = (window as any).__TAURI__;
    if (tauri?.event) {
      tauri.event.listen('update-available', (ev: any) => {
        setUpdateVersion(ev.payload?.version || 'new version');
      });
      tauri.event.listen('update-progress', (ev: any) => {
        if (ev.payload === 100) setUpdateInstalling(false);
      });
    }

    const saved = loadSession();
    if (!saved) return;

    getSupabase().then(async (sb: any) => {
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { clearSession(); return; }

      let { data: member } = await sb.from('members')
        .select('*, organizations(plan_type, settings)')
        .eq('auth_user_id', session.user.id)
        .single();

      if (!member && session.user.email) {
        const { data: byEmail } = await sb.from('members')
          .select('*, organizations(plan_type, settings)')
          .eq('email', session.user.email)
          .single();
        if (byEmail && !byEmail.auth_user_id) {
          await sb.from('members').update({ auth_user_id: session.user.id }).eq('id', byEmail.id);
          member = { ...byEmail, auth_user_id: session.user.id };
        }
      }

      if (member) {
        const tz = await syncTimezone(sb, member.id, member.timezone);
        const userObj: User = {
          id: member.id,
          email: member.email,
          full_name: member.full_name,
          role: member.role,
          weekly_limit: member.weekly_limit,
          daily_limit: member.daily_limit,
          idle_limit: member.idle_limit,
          idle_enabled: member.idle_enabled,
          keep_idle_mode: member.keep_idle_mode,
          tracking_enabled: member.tracking_enabled,
          avatar_url: member.avatar_url,
          organization_id: member.organization_id,
          timezone: tz || undefined,
          keep_idle: member.keep_idle,
          phone: member.phone,
          custom_fields: member.custom_fields || {},
          plan_type: member.organizations?.plan_type || 'Basic',
          organization_settings: member.organizations?.settings || {}
        };
        console.log('USER LOADED (Session)');
        // Seed the payroll day boundary from settings already fetched with the
        // member row, so the first stats computation never has to guess it.
        const restoredTz = member.organizations?.settings?.orgTimezone;
        if (restoredTz) {
          orgTimezoneRef.current = restoredTz;
          setOrgTimezone(restoredTz);
        }
        setUser(userObj);
        const { data: projs } = await sb.from('projects')
          .select('*, project_members!inner(member_id)')
          .eq('project_members.member_id', userObj.id);
        const projectsList = projs || [];
        setProjects(projectsList);
        setScreen('projects');
        fetchAndSubscribeTodos(userObj.id);
        fetchDashboardStats(userObj.id, projectsList);
      } else {
        clearSession();
      }
    });
  }, []); // Run once on mount

  // ── Realtime: Listen for org plan changes ────────────────────────────────────
  // When the admin portal upgrades or downgrades the plan, update React state
  // and push the new plan to the Rust backend via the update_plan IPC command.
  useEffect(() => {
    if (!user?.organization_id) return;

    let channel: any = null;

    getSupabase().then((sb: any) => {
      channel = sb.channel(`org-plan-${user.organization_id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'organizations',
            filter: `id=eq.${user.organization_id}`
          },
          async (payload: any) => {
            const newPlanType: string = payload.new?.plan_type || 'Basic';
            const prevPlanType = user?.plan_type || 'Basic';

            if (newPlanType === prevPlanType) return;

            console.log(`[App] 🔄 Org plan changed: ${prevPlanType} → ${newPlanType}`);

            // 1. Update React state so UI reflects new plan immediately
            setUser(prev => prev ? { ...prev, plan_type: newPlanType } : prev);

            // 2. Push to Rust backend so next tracking session respects new plan
            const tauri = (window as any).__TAURI__;
            if (tauri?.core?.invoke) {
              try {
                await tauri.core.invoke('update_plan', { plan: newPlanType });
                console.log('[App] ✅ Rust backend plan updated to', newPlanType);
              } catch (e) {
                console.error('[App] Failed to update Rust plan:', e);
              }
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) {
        getSupabase().then((sb: any) => sb.removeChannel(channel));
      }
    };
  }, [user?.organization_id]); // Re-subscribe when org changes (e.g. after login)

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const visibilityHandler = () => {
      if (document.visibilityState === 'visible') {
        getSupabase().then(async (sb: any) => {
          const { data: { session } } = await sb.auth.getSession();
          if (session?.access_token) {
            trackerAPI.setAuthToken(session.access_token, SUPABASE_URL, SUPABASE_ANON_KEY);
            return;
          }
          const refreshed = await sb.auth.refreshSession();
          const refreshedToken = refreshed?.data?.session?.access_token;
          if (refreshedToken) {
            trackerAPI.setAuthToken(refreshedToken, SUPABASE_URL, SUPABASE_ANON_KEY);
          }
        });
      }
    };

    getSupabase().then(async (sb: any) => {
      const pushLatestToken = async () => {
        const { data: { session } } = await sb.auth.getSession();
        if (session?.access_token) {
          trackerAPI.setAuthToken(session.access_token, SUPABASE_URL, SUPABASE_ANON_KEY);
          return;
        }
        const refreshed = await sb.auth.refreshSession();
        const refreshedToken = refreshed?.data?.session?.access_token;
        if (refreshedToken) {
          trackerAPI.setAuthToken(refreshedToken, SUPABASE_URL, SUPABASE_ANON_KEY);
        }
      };

      await pushLatestToken();

      const { data: { subscription } } = sb.auth.onAuthStateChange((_event: string, nextSession: any) => {
        const token = nextSession?.access_token;
        if (token) {
          trackerAPI.setAuthToken(token, SUPABASE_URL, SUPABASE_ANON_KEY);
        }
      });

      // Keep Rust token fresh even if auth-state events are missed in long-running desktop sessions.
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          pushLatestToken();
        }
      }, 5 * 60_000); // Every 5 minutes instead of 1, only when visible
      document.addEventListener('visibilitychange', visibilityHandler);

      cleanup = () => subscription?.unsubscribe();
    });

    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', visibilityHandler);
      cleanup?.();
    };
  }, []);

  const discardIdleTime = (
    minutes: number,
    shouldResume: boolean = true,
    sid?: string,
    cutoffIso?: string,
  ): Promise<void> => {
    const promise = (async () => {
      const activeSessionId = sid || sessionIdRef.current || sessionId;
      console.log('[App] discardIdleTime called:', { minutes, shouldResume, activeSessionId, cutoffIso, userId: user?.id });
      if (!user || !activeSessionId) {
        console.warn('[App] discardIdleTime ABORTED: Missing user or activeSessionId', { user: !!user, activeSessionId });
        return;
      }
      const sb = await getSupabase();

      // 1. Delete idle samples from Supabase (via RPC + direct delete) AND the local SQLite cache.
      //    Block-aligned callers pass an explicit cutoff — the end of the last block
      //    that had activity — so a partially-worked block is never clipped. Callers
      //    without one fall back to a rolling window, with a 15s buffer for clock skew.
      const startTime = cutoffIso
        ?? new Date(Date.now() - ((minutes * 60 + 15) * 1000)).toISOString();
      console.log('[App] Executing idle sample discard from cutoff:', startTime, 'for session:', activeSessionId);

      await Promise.all([
        Promise.resolve(sb.rpc('rpc_discard_idle_samples', {
          p_session_id: activeSessionId,
          p_start_time: startTime,
        })).then((res: any) => console.log('[App] rpc_discard_idle_samples response:', res))
          .catch((err: any) => console.error('[App] rpc_discard_idle_samples error:', err)),
        sb.from('activity_samples')
          .delete()
          .eq('session_id', activeSessionId)
          .gte('recorded_at', startTime),
        trackerAPI.discardIdleCache(activeSessionId, startTime),
      ]);

      // 2. Adjust local timer — subtract the discarded idle time from display
      const discardedSecs = cutoffIso
        ? Math.max(0, Math.round((Date.now() - Date.parse(cutoffIso)) / 1000))
        : minutes * 60;
      sessionElapsedRef.current = Math.max(0, sessionElapsedRef.current - discardedSecs);
      setLiveElapsed((prev: number) => Math.max(0, prev - discardedSecs));
      // Reset live idle display to 0 — idle time is fully discarded, not carried forward
      setLiveIdleSeconds(0);

      if (shouldResume) {
        resumeFromIdle();
      }
    })();

    // Store so handleStop can await completion before syncing
    pendingIdleDiscardRef.current = promise;
    return promise;
  };

  // Mark samples from the cutoff onward as idle=true in DB (when idle is confirmed).
  // Block-aligned callers pass the end of the last active block as cutoffIso.
  const markSamplesAsIdle = async (minutes: number, sid?: string, cutoffIso?: string) => {
    const activeSessionId = sid || sessionIdRef.current || sessionId;
    if (!activeSessionId) return;
    const sb = await getSupabase();
    const startTime = cutoffIso
      ?? new Date(Date.now() - ((minutes * 60 + 15) * 1000)).toISOString();
    await sb.from('activity_samples')
      .update({ idle: true, activity_percent: 0 })
      .eq('session_id', activeSessionId)
      .gte('recorded_at', startTime);
  };

  const reassignIdleTime = async (minutes: number, newProjectId: string, sid?: string) => {
    const activeSessionId = sid || sessionIdRef.current || sessionId;
    if (!user || !activeSessionId) return;
    const sb = await getSupabase();

    const startTime = new Date(Date.now() - ((minutes * 60 + 15) * 1000)).toISOString();

    // Find or create a session for the target project using the atomic RPC
    const { data: rpcData, error: rpcError } = await sb.rpc('rpc_start_session', {
      p_user_id: user.id,
      p_project_id: newProjectId,
      p_organization_id: user.organization_id,
      p_ip_address: null // We don't necessarily have the IP here, or we could fetch it
    });

    if (rpcError) {
      console.error('Failed to reassign session via RPC:', rpcError);
      return;
    }

    const targetSessionId = rpcData.id;

    if (targetSessionId) {
      await sb.from('activity_samples')
        .update({ session_id: targetSessionId })
        .eq('session_id', activeSessionId)
        .gte('recorded_at', startTime);
    }

    // 2. Adjust local state
    trackerAPI.setAlwaysOnTop?.(false);
    setIdlePaused(false);
    await handleResume();
    if (user) fetchDashboardStats(user.id, projects);
  };

  // Attach to window for the child components to call easily
  // Manual "Discard idle" from the away popup. Rolls back to the end of the last
  // block that had activity, so a block the user partly worked is never clipped.
  const discardIdleFromLastBlock = (shouldResume: boolean = true): Promise<void> => {
    const cutoffMs = lastActiveBlockEndRef.current;
    if (cutoffMs == null) return discardIdleTime(user?.idle_limit || 10, shouldResume);
    const mins = Math.max(0, Math.round((Date.now() - cutoffMs) / 60000));
    return discardIdleTime(mins, shouldResume, undefined, new Date(cutoffMs).toISOString());
  };

  (window as any).discardIdleTime = discardIdleFromLastBlock;
  (window as any).reassignIdleTime = reassignIdleTime;

  useEffect(() => {
    if (!isTracking || (user && user.idle_enabled === false)) return;

    let unlisten: (() => void) | null = null;

    const setupListener = async () => {
      unlisten = await trackerAPI.onTrackingSample((sample: any) => {
        // Skip if we're already handling idle (guard against double-fire during listener re-subscription)
        if (isHandlingIdleRef.current) return;
        // Skip samples that arrive while already paused — don't double count
        if (isPaused) return;

        // Count as idle if Rust idle flag is true, activity_percent is 0, or clicks+keys are 0
        // Idle means the minute saw NO input at all. Mouse movement and scrolling
        // count as activity, so we must not fall back to clicks/keypresses here —
        // doing so would re-introduce the exact force-zero the tracker just dropped.
        // `idle` and `activity_percent === 0` are equivalent (both derive from
        // active_seconds); both are checked purely as belt-and-braces.
        const isIdleSample = sample.idle === true || (sample.activity_percent ?? 100) === 0;

        // Which fixed 10-minute clock block does this minute belong to?
        const sampleMs = Date.parse(sample.recorded_at) || Date.now();
        const blockId = Math.floor(sampleMs / BLOCK_MS);

        if (currentBlockIdRef.current === null) {
          currentBlockIdRef.current = blockId;
          blockHadActivityRef.current = false;
        }

        let closedBlankBlock = false;

        if (blockId !== currentBlockIdRef.current) {
          // The previous block has closed — judge it now, as a whole.
          if (blockHadActivityRef.current) {
            // Kept in full. This is the point we roll back to if idle follows.
            blankBlockCountRef.current = 0;
            lastActiveBlockEndRef.current = (currentBlockIdRef.current + 1) * BLOCK_MS;
          } else {
            blankBlockCountRef.current += 1;
            closedBlankBlock = true;
          }
          // Blocks with no samples at all (laptop asleep, app closed) are skipped
          // entirely rather than counted as blank — they were never worked, so
          // there is nothing to discard and nobody should be prompted about them.
          currentBlockIdRef.current = blockId;
          blockHadActivityRef.current = false;
        }

        if (!isIdleSample) blockHadActivityRef.current = true;

        // Idle fires only when a whole block has closed with nothing in it.
        const limit = user?.idle_limit || 10;
        const blocksRequired = Math.max(1, Math.round(limit / 10));
        if (!closedBlankBlock || blankBlockCountRef.current < blocksRequired) return;

        const mode = user?.keep_idle_mode || 'prompt';

        // 'always' = keep idle time silently — no popup, no deduction, no DB marking
        if (mode === 'always') {
          blankBlockCountRef.current = 0;
          return;
        }

        // Everything from the end of the last active block onwards is idle.
        // Falling back to the block start keeps the cutoff block-aligned even
        // when a session has not yet had a single active block.
        const cutoffMs = lastActiveBlockEndRef.current
          ?? (currentBlockIdRef.current - blankBlockCountRef.current) * BLOCK_MS;
        const cutoffIso = new Date(cutoffMs).toISOString();
        const idleSecs = Math.max(0, Math.round((Date.now() - cutoffMs) / 1000));
        const idleMins = Math.round(idleSecs / 60);

        setLiveIdleSeconds(idleSecs);

        // Set guard BEFORE async operations
        isHandlingIdleRef.current = true;

        // Retroactively mark those samples idle=true in DB so dashboard is accurate
        markSamplesAsIdle(idleMins, sample.session_id, cutoffIso);

        // Pop window to front immediately so user is aware of inactivity
        trackerAPI.focusWindow?.(true);
        trackerAPI.showNotification(
          `You have been inactive for ${idleMins} minutes. Tracking is paused.`
        );

        blankBlockCountRef.current = 0;

        if (mode === 'never') {
          setIdlePaused(true);
          // Discard the idle block first, then close the session at the boundary.
          discardIdleTime(idleMins, false, sample.session_id, cutoffIso)
            .then(() => closeSessionForIdle(cutoffIso, sample.session_id))
            .finally(() => { isHandlingIdleRef.current = false; });
          (trackerAPI as any).startIdleMonitoring(limit);
          return;
        }

        // Default: 'prompt'
        setIdlePaused(true);
        closeSessionForIdle(cutoffIso, sample.session_id)
          .finally(() => { isHandlingIdleRef.current = false; });
        (trackerAPI as any).startIdleMonitoring(limit);
      });
    };

    setupListener();

    console.log('Tracking listener active:', { isPaused, idlePaused });

    return () => {
      if (unlisten) unlisten();
    };
  }, [isTracking, isPaused, user?.idle_limit, user?.keep_idle_mode]); // Re-subscribe when tracking state or limits/modes change

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      unlisten = await trackerAPI.onIdleDialogDismissed(() => {
        if (user?.keep_idle_mode === 'never' && isTracking && isPaused) {
          (trackerAPI as any).stopIdleMonitoring();
          handleResume();
        }
      });
    };
    setup();
    return () => { unlisten?.(); };
  }, [user?.keep_idle_mode, isTracking, isPaused]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    // Auto-refresh — but only when visible and every 5m instead of 1m.
    // Also runs on the tracker screen: previously this was gated to 'projects'
    // only, so while a user was tracking nothing ever recomputed their totals
    // and a stale or mis-bucketed figure persisted for the whole session.
    if (user && (screen === 'projects' || screen === 'tracker')) {
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchDashboardStats(user.id, projects);
        }
      }, 5 * 60_000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [user?.id, screen, projects]);

  // ─── Payroll day rollover ────────────────────────────────────────────────────
  // The live counter (sessionElapsedRef) is seeded once at session start and only
  // reset on stop, and todaySeconds is only recomputed when stats are refetched.
  // Neither was tied to the org day, so a session running across org midnight
  // carried yesterday's total forward into today. Watch the org-local date and
  // reconcile both when it flips.
  useEffect(() => {
    if (!user) return;

    const checkRollover = () => {
      const tz = orgTimezoneRef.current;
      if (!tz) return; // boundary unknown — do not guess

      const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });

      if (orgDayRef.current === null) {
        orgDayRef.current = today;
        return;
      }
      if (orgDayRef.current === today) return;

      orgDayRef.current = today;

      // Clamp the live counter to the time elapsed since the new org midnight.
      // Math.min keeps this safe for a session that started after midnight (its
      // elapsed value is already correct and must not be inflated).
      const midnightMs = orgLocalToUtc(today, 'start', tz).getTime();
      const secsSinceMidnight = Math.max(0, Math.floor((Date.now() - midnightMs) / 1000));
      sessionElapsedRef.current = Math.min(sessionElapsedRef.current, secsSinceMidnight);
      setLiveElapsed(prev => Math.min(prev, secsSinceMidnight));

      // A stale day floor would re-inflate the freshly reset total.
      limitFloorRef.current = null;

      fetchDashboardStats(user.id, projects);
    };

    checkRollover();
    const interval = setInterval(checkRollover, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projects]);

  // ─── Org-Level Absolute Auto-Terminate Session (bypasses keep_idle_mode) ──────
  // This effect listens to every tracking sample and maintains an independent
  // continuous-zero-activity counter (absoluteIdleRef). Unlike the personal idle popup
  // logic, this fires even for members set to "Always Keep Idle" mode.
  // It resets on every active sample and triggers a forced session stop when the org
  // limit is reached. Works offline — no server call needed to detect inactivity.
  useEffect(() => {
    if (!isTracking || !user) return;

    const autoStopEnabled = user.organization_settings?.autoStopOnIdle ?? false;
    const autoStopLimitMins = user.organization_settings?.idleAutoStopMinutes ?? 60;

    if (!autoStopEnabled) {
      // If org disabled it, ensure counter is clean
      absoluteIdleRef.current = 0;
      isAutoTerminatingRef.current = false;
      return;
    }

    // Reset the counter each time tracking starts (effect re-runs when isTracking changes)
    absoluteIdleRef.current = 0;
    isAutoTerminatingRef.current = false;

    let unlisten: (() => void) | null = null;

    const setupAbsoluteIdleListener = async () => {
      unlisten = await trackerAPI.onTrackingSample(async (sample: any) => {
        // Guard: don't trigger twice
        if (isAutoTerminatingRef.current) return;

        // Same rule as the idle popup: any input counts, including mouse
        // movement and scrolling. Checking clicks/keypresses here would
        // auto-terminate someone who is actively reading.
        const hasActivity = sample.idle === false;

        if (hasActivity) {
          // User was active — reset the absolute idle counter
          if (absoluteIdleRef.current > 0) {
            console.log(`[abs-autostop] Activity detected — resetting absolute idle counter (was ${absoluteIdleRef.current} min)`);
          }
          absoluteIdleRef.current = 0;
        } else {
          // Zero activity this minute — increment absolute idle counter
          absoluteIdleRef.current += 1;
          console.log(`[abs-autostop] Continuous inactivity: ${absoluteIdleRef.current}/${autoStopLimitMins} min`);

          if (absoluteIdleRef.current >= autoStopLimitMins) {
            // Org limit reached — force-stop the session regardless of keep_idle_mode
            isAutoTerminatingRef.current = true;
            const minsElapsed = absoluteIdleRef.current;
            absoluteIdleRef.current = 0;

            console.log(`[abs-autostop] Org limit reached (${minsElapsed} min). Force-stopping session...`);

            // Discard the trailing idle block before stopping so payroll is not inflated.
            // We pass the accumulated idle minutes so the correct number of samples get purged.
            discardIdleTime(minsElapsed, false, sample.session_id);

            await handleStop();

            trackerAPI.showNotification(
              'Session Auto-Stopped',
              `Your tracking session was ended automatically after ${minsElapsed} minutes of continuous inactivity.`
            );
          }
        }
      });
    };

    setupAbsoluteIdleListener();

    return () => {
      if (unlisten) unlisten();
      // Do NOT reset absoluteIdleRef here — it must persist across re-renders
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTracking, user?.id, user?.organization_settings?.autoStopOnIdle, user?.organization_settings?.idleAutoStopMinutes]);

  // Standalone effect to sync location once per session
  useEffect(() => {
    if (!user?.id) return;
    const syncLocation = async () => {
      try {
        const sb = await getSupabase();
        let locString = '';

        try {
          const r = await fetch('https://ipwho.is/');
          if (r.ok) {
            const d = await r.json();
            if (d.success && d.city && d.country) {
              locString = `${d.city}, ${d.country}`;
            }
          }
        } catch (_) {
          // Fallback provider if ipwho.is is unreachable
          try {
            const r2 = await fetch('https://ipapi.co/json/');
            if (r2.ok) {
              const d2 = await r2.json();
              if (d2.city && d2.country_name) {
                locString = `${d2.city}, ${d2.country_name}`;
              }
            }
          } catch (_) {}
        }

        if (locString) {
          await sb.from('members').update({ location: locString }).eq('id', user.id);
          console.log('[App] Location synced:', locString);
        }
      } catch (e) {
        console.warn('[App] Location sync skipped:', e);
      }
    };
    syncLocation();
  }, [user?.id]);

  async function fetchAndSubscribeTodos(userId: string) {
    const sb = await getSupabase();
    const { data } = await sb
      .from('todos')
      .select('id, title, description, status, due_date, project_id, assignee_id, projects(name, color)')
      .eq('assignee_id', userId)
      .neq('status', 'Done')
      .order('created_at', { ascending: false });

    if (data) {
      setTodos(data.map((t: any) => ({
        ...t,
        projectName: t.projects?.name,
        projectColor: t.projects?.color,
      })));
    }
    if (realtimeRef.current) sb.removeChannel(realtimeRef.current);
    realtimeRef.current = sb
      .channel('my-todos-' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'todos', filter: `assignee_id=eq.${userId}` },
        async (payload: any) => {
          const t = payload.new;
          const { data: proj } = await sb.from('projects').select('name, color').eq('id', t.project_id).single();
          const enriched: Todo = { ...t, projectName: proj?.name, projectColor: proj?.color };
          setTodos(prev => [enriched, ...prev]);
          trackerAPI.showNotification('📋 New Task Assigned', t.title + (proj?.name ? ` — ${proj.name}` : ''));
        }
      )
      .subscribe();
  }

  // Real-time Member Profile Subscription (Enforce tracking_enabled)
  useEffect(() => {
    if (!user?.id) return;

    let sub: any = null;
    getSupabase().then((sb: any) => {
      sub = sb
        .channel(`member-${user.id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'members', filter: `id=eq.${user.id}` },
          (payload: any) => {
            const updated = payload.new;
            console.log('Member profile updated (real-time)');

            // Update local state
            setUser(prev => prev ? { ...prev, ...updated } : null);

            // Enforce tracking_enabled
            if (updated.tracking_enabled === false && isTracking) {
              handleStop();
              trackerAPI.showNotification('Tracking Disabled', 'Your tracking permission has been removed by an administrator.');
              setTrackingError('Your tracking permission has been removed by an administrator.');
            } else if (updated.tracking_enabled === true) {
              setTrackingError(null);
            }
          }
        )
        .subscribe();
      memberSubscriptionRef.current = sub;
    });

    return () => {
      if (sub) {
        getSupabase().then((sb: any) => sb.removeChannel(sub));
      }
    };
  }, [user?.id, isTracking]); // Re-subscribe if user ID changes; check isTracking for enforcement

  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => {
        sessionElapsedRef.current += 1;
        
        // Limit check inside interval to avoid React re-renders
        if (user && activeProject) {
          // sessionElapsedRef is pre-seeded with activeProject.todaySeconds at session start,
          // so we only need to add OTHER projects' totals to avoid double-counting.
          const otherProjectsToday = projects
            .filter(p => p.id !== activeProject.id)
            .reduce((s, p) => s + (p.stats?.todaySeconds || 0), 0);
          const currentToday = otherProjectsToday + sessionElapsedRef.current;

          const otherProjectsWeek = projects
            .filter(p => p.id !== activeProject.id)
            .reduce((s, p) => s + (p.stats?.weeklySeconds || 0), 0);
          // For weekly: sessionElapsedRef is seeded with todaySeconds (not weeklySeconds),
          // so we need to add the active project's weekly total minus today to get full week.
          const activeProjectWeeklyPrior = (activeProject.stats?.weeklySeconds || 0) - (activeProject.stats?.todaySeconds || 0);
          const currentWeek = otherProjectsWeek + activeProjectWeeklyPrior + sessionElapsedRef.current;

          const weeklyLimitSecs = (user.weekly_limit || 40) * 3600;
          const dailyLimitSecs = (user.daily_limit || 8) * 3600;

          if (currentToday >= dailyLimitSecs || currentWeek >= weeklyLimitSecs) {
            // Snap the display to the exact limit value before stopping
            const snappedElapsed = currentToday >= dailyLimitSecs
              ? dailyLimitSecs - otherProjectsToday
              : weeklyLimitSecs - otherProjectsWeek;
            sessionElapsedRef.current = snappedElapsed;
            setLiveElapsed(snappedElapsed);
            if (timerRef.current) clearInterval(timerRef.current); // stop ticking immediately

            // Floor the DB refresh for this project so it can't show less than the limit.
            // Expires after 30s (well past the 3s-delayed fetchDashboardStats call).
            if (activeProject) {
              limitFloorRef.current = {
                projectId: activeProject.id,
                minTodaySecs: snappedElapsed,
                expiresAt: Date.now() + 30_000
              };
            }

            trackerAPI.showNotification('Tracking Limit Reached', 'Your session has been automatically stopped because you reached your daily or weekly time limit.');
            handleStop();
            setTrackingError('Session stopped due to reaching tracking limit.');
          }
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, isPaused, user, projects, activeProject]);





  async function handleLogin(email: string, password: string): Promise<string | null> {
    try {
      const sb = await getSupabase();
      const { data: authData, error: authError } = await sb.auth.signInWithPassword({ email, password });
      if (authError || !authData.user) {
        console.error('[Login] Auth failed:', authError?.message);
        return authError?.message || 'Login failed';
      }

      console.log('[Login] Session established');

      // Ensure the client's internal headers are fully updated
      await sb.auth.setSession({ 
        access_token: authData.session.access_token, 
        refresh_token: authData.session.refresh_token 
      });

      console.log('[Login] Fetching member profile for user:', authData.user.id);
      let { data: member, error: memberError } = await sb
        .from('members').select('*, organizations(plan_type, settings)').eq('auth_user_id', authData.user.id).single();

      // Retry once to handle supabase-js session propagation race conditions
      if (memberError || !member) {
        console.log('[Login] First attempt failed, retrying in 500ms...');
        await new Promise(r => setTimeout(r, 500));
        const retryResult = await sb.from('members').select('*, organizations(plan_type, settings)').eq('auth_user_id', authData.user.id).single();
        member = retryResult.data;
        memberError = retryResult.error;
      }

      // Fallback: lookup by email if auth_user_id is not yet linked
      if ((memberError || !member) && authData.user.email) {
        console.log('[Login] Profile not found by ID, attempting fallback');
        const { data: byEmail } = await sb.from('members').select('*, organizations(plan_type, settings)').eq('email', authData.user.email).single();
        if (byEmail && !byEmail.auth_user_id) {
          console.log('[Login] Found unlinked profile by email, linking now...');
          const { error: updateError } = await sb.from('members').update({ auth_user_id: authData.user.id }).eq('id', byEmail.id);
          if (!updateError) {
            member = { ...byEmail, auth_user_id: authData.user.id };
            memberError = null;
          }
        }
      }

      if (memberError || !member) {
        console.error('[Login] Profile verification failed:', memberError?.message || 'No member record');
        return 'Member profile not found. Please contact your administrator to ensure your account is properly linked.';
      }

      if (member.role === 'Client') {
        console.error('[Login] Client role is not allowed to use the tracker app');
        await sb.auth.signOut();
        return 'Clients are restricted to the Admin Portal and cannot use the tracker application.';
      }

      const tz = await syncTimezone(sb, member.id, member.timezone);
      const userObj: User = {
        id: member.id,
        email: member.email,
        full_name: member.full_name,
        role: member.role,
        weekly_limit: member.weekly_limit,
        daily_limit: member.daily_limit,
        idle_limit: member.idle_limit,
        idle_enabled: member.idle_enabled,
        keep_idle_mode: member.keep_idle_mode,
        tracking_enabled: member.tracking_enabled,
        avatar_url: member.avatar_url,
        organization_id: member.organization_id,
        timezone: tz || undefined,
        keep_idle: member.keep_idle,
        phone: member.phone,
        custom_fields: member.custom_fields || {},
        plan_type: member.organizations?.plan_type || 'Basic',
        organization_settings: member.organizations?.settings || {}
      };
      // Seed the payroll day boundary from settings already fetched with the
      // member row, so the first stats computation never has to guess it.
      const loginTz = member.organizations?.settings?.orgTimezone;
      if (loginTz) {
        orgTimezoneRef.current = loginTz;
        setOrgTimezone(loginTz);
      }

      const { data: projectsData } = await sb.from('projects')
        .select('*, project_members!inner(member_id)')
        .eq('project_members.member_id', userObj.id);
      const token = authData.session.access_token;
      trackerAPI.setAuthToken(token, SUPABASE_URL, SUPABASE_ANON_KEY);

      if (rememberMe) saveSession(token);
      setUser(userObj);
      const projectList = projectsData || [];
      setProjects(projectList);
      setScreen('projects');
      fetchAndSubscribeTodos(userObj.id);
      fetchDashboardStats(userObj.id, projectList);
      return null;
    } catch (err: any) {
      return err.message || 'Login encountered an unexpected error.';
    }
  }

  function handleSelectProject(project: Project) {
    setActiveProject(project);
    if (hasConsented()) {
      startTracking(project);
    } else {
      setScreen('consent');
    }
  }

  function handleConsentAccepted() {
    saveConsent();
    if (activeProject) startTracking(activeProject);
  }

  function handleConsentDeclined() {
    setActiveProject(null);
    setScreen('projects');
  }

  async function startTracking(project: Project) {
    // Seed the timer with the authoritative todaySeconds calculated by fetchDashboardStats
    const currentProj = projects.find(p => p.id === project.id) || project;
    const todaySecs = currentProj.stats?.todaySeconds ?? project.stats?.todaySeconds ?? 0;

    sessionElapsedRef.current = todaySecs;
    setLiveElapsed(todaySecs);

    setLiveIdleSeconds(0); // reset live idle counter for new session
    idleMinutesRef.current = 0; // reset inactivity counter for new session
    currentBlockIdRef.current = null;      // start block tracking fresh
    blockHadActivityRef.current = false;
    blankBlockCountRef.current = 0;
    lastActiveBlockEndRef.current = null;
    idleClosedSessionRef.current = false;
    isHandlingIdleRef.current = false; // reset idle handler guard for new session
    setIsPaused(false);
    setTrackingError(null);
    setIsTracking(true);
    setScreen('tracker');

    try {
      if (!isOnline) {
        setTrackingError('You are currently offline. Please check your internet connection to start tracking.');
        setIsTracking(false);
        setActiveProject(null);
        setScreen('projects');
        return;
      }
      const sb = await getSupabase();

      if (user?.tracking_enabled === false) {
        console.log('TRACKING BLOCKED: tracking_enabled is false');
        setTrackingError('Tracking has been disabled for your account by an administrator.');
        setIsTracking(false);
        setActiveProject(null);
        setScreen('projects');
        return;
      }

      // Enforcement: Daily & Weekly Limits (still based on productive tracked time to match billing limits)
      const totalToday = projects.reduce((s, p) => s + (p.stats?.todaySeconds || 0), 0);
      const totalWeek = projects.reduce((s, p) => s + (p.stats?.weeklySeconds || 0), 0);
      const dailyLimitSecs = (user?.daily_limit || 8) * 3600;
      const weeklyLimitSecs = (user?.weekly_limit || 40) * 3600;

      if (totalToday >= dailyLimitSecs) {
        setTrackingError(`Daily limit (${user?.daily_limit || 8}h) reached. Please contact your manager.`);
        setIsTracking(false);
        setActiveProject(null);
        setScreen('projects');
        return;
      }
      if (totalWeek >= weeklyLimitSecs) {
        setTrackingError(`Weekly limit (${user?.weekly_limit || 40}h) reached. Please contact your manager.`);
        setIsTracking(false);
        setActiveProject(null);
        setScreen('projects');
        return;
      }

      console.log('TRACKING ALLOWED: tracking_enabled is', user?.tracking_enabled);

      const { data: { session } } = await sb.auth.getSession();
      const token = session?.access_token;

      const res: any = await trackerAPI.startTracking(project.id, user?.id ?? '', token);
      if (res?.status === 'error') {
        let rawErr = res.error || '';
        
        // Sanitize raw backend JSON errors if they somehow bubble up
        if (typeof rawErr === 'string' && rawErr.includes('{')) {
          try {
            const jsonPart = rawErr.substring(rawErr.indexOf('{'));
            const parsed = JSON.parse(jsonPart);
            if (parsed.message) rawErr = parsed.message;
          } catch (e) {
            // keep rawErr as is
          }
        }

        if (rawErr.includes('transport error') || rawErr.includes('Dns Failed')) {
          setTrackingError('Network error: Unable to reach the server. Please check your internet connection.');
          setIsOnline(false);
        } else {
          setTrackingError(rawErr && rawErr.length < 100 && !rawErr.includes('violates') ? rawErr : 'Unable to start tracking. Please try again or contact support.');
        }
        setIsTracking(false);
        setActiveProject(null);
        setScreen('projects');
        return;
      }
      setIsTracking(true);
      setSessionId(res?.session_id ?? null);
      // setScreen('tracker'); // already set at start for responsiveness

      // Notification Alert
      if (settingsRef.current?.tracking_alerts !== false) {
        trackerAPI.showNotification('Tracking Started', `Now tracking for ${project.name}`);
      }
    } catch (err: any) {
      let errMsg = err.toString();

      if (typeof errMsg === 'string' && errMsg.includes('{')) {
        try {
          const jsonPart = errMsg.substring(errMsg.indexOf('{'));
          const parsed = JSON.parse(jsonPart);
          if (parsed.message) errMsg = parsed.message;
        } catch (e) {
          // keep errMsg as is
        }
      }

      if (errMsg.includes('transport error') || errMsg.includes('Dns Failed')) {
        setTrackingError('Network error: Unable to reach the server. Please check your internet connection.');
        setIsOnline(false);
      } else {
        setTrackingError(errMsg && errMsg.length < 100 && !errMsg.includes('violates') ? errMsg : 'Unable to start tracking due to a system error. Please try again or contact support.');
      }
      setIsTracking(false);
      setActiveProject(null);
      setScreen('projects');
    }
  }

  async function handleStop() {
    const activeSessionId = sessionIdRef.current || sessionId;
    console.log('[App] handleStop called. SessionId:', activeSessionId, 'idleMinutes:', idleMinutesRef.current);

    // If an idle discard is in-flight (user clicked Stop while discard was pending),
    // wait for it to finish before syncing — otherwise stop_tracking re-uploads the samples.
    if (pendingIdleDiscardRef.current) {
      console.log('[App] Awaiting pending idle discard before stop...');
      try { await pendingIdleDiscardRef.current; } catch (_) {}
      pendingIdleDiscardRef.current = null;
    }

    if (user?.keep_idle_mode === 'never' && activeSessionId) {
      // If mode is 'never', ensure ALL idle=true samples for this session are purged before stopping
      console.log('[App] Purging all idle samples on session stop for mode "never"...');
      try {
        const sb = await getSupabase();
        await Promise.all([
          sb.from('activity_samples')
            .delete()
            .eq('session_id', activeSessionId)
            .eq('idle', true),
          trackerAPI.discardIdleCache(activeSessionId, new Date(0).toISOString()),
        ]);
      } catch (err) {
        console.error('[App] Error purging idle samples on stop:', err);
      }
    }

    try {
      const res: any = await trackerAPI.stopTracking();
      console.log('[App] stopTracking response:', res);
    } catch (err) {
      console.error('[App] stopTracking FAILED:', err);
    }

    // Reset idle overlay state first — this unblocks the UI immediately
    trackerAPI.setAlwaysOnTop?.(false);
    setIdlePaused(false);
    setLiveIdleSeconds(0);
    setIsTracking(false);
    setIsPaused(false);
    setSessionId(null);
    setActiveProject(null);
    sessionElapsedRef.current = 0;
    setLiveElapsed(0);
    idleMinutesRef.current = 0;
    isHandlingIdleRef.current = false;
    pendingIdleDiscardRef.current = null;
    absoluteIdleRef.current = 0;
    isAutoTerminatingRef.current = false;
    currentBlockIdRef.current = null;
    blockHadActivityRef.current = false;
    blankBlockCountRef.current = 0;
    lastActiveBlockEndRef.current = null;
    idleClosedSessionRef.current = false;
    setScreen('projects');

    // Notification Alert
    if (settingsRef.current?.tracking_alerts !== false) {
      trackerAPI.showNotification('Tracking Stopped', 'Your session has ended.');
    }

    // Refresh from DB after a short delay to give the backend time to flush
    // the last activity samples before we re-read. Without this delay,
    // the re-read can return stale data (e.g. 1h 58m instead of 2h 0m).
    if (user) setTimeout(() => fetchDashboardStats(user.id, projects), 3000);
  }

  async function handlePause() {
    setIsPaused(true);
    await trackerAPI.pauseTracking();
  }

  // Idle ends the session instead of pausing it. The session is closed at the end
  // of the last block that was actually worked, so its span matches what it earns.
  const closeSessionForIdle = async (cutoffIso: string, sid?: string) => {
    const activeSessionId = sid || sessionIdRef.current || sessionId;
    try {
      await trackerAPI.stopTracking();
    } catch (err) {
      console.error('[App] stopTracking failed while closing for idle:', err);
    }
    if (activeSessionId) {
      try {
        const sb = await getSupabase();
        await sb.from('sessions').update({ ended_at: cutoffIso }).eq('id', activeSessionId);
        console.log('[App] Session closed for idle at block boundary:', cutoffIso, activeSessionId);
      } catch (err) {
        console.error('[App] Failed to set ended_at to block boundary:', err);
      }
    }
    idleClosedSessionRef.current = true;
    setIsPaused(true);
    setSessionId(null);
    sessionIdRef.current = null;
  };

  // Leaving the away popup. If idle closed the session, open a fresh one for the
  // same project rather than resuming the dead one.
  const resumeFromIdle = () => {
    trackerAPI.setAlwaysOnTop?.(false);
    setIdlePaused(false);
    (trackerAPI as any).stopIdleMonitoring();
    if (idleClosedSessionRef.current) {
      idleClosedSessionRef.current = false;
      if (activeProject) {
        startTracking(activeProject);
        return;
      }
    }
    handleResume();
  };

  async function handleResume() {
    // Start block tracking fresh. Without this the block that was open when we
    // paused stays "current" and empty, so the first sample after resuming would
    // close it as blank and immediately re-trigger the away popup.
    currentBlockIdRef.current = null;
    blockHadActivityRef.current = false;
    blankBlockCountRef.current = 0;
    lastActiveBlockEndRef.current = null;
    idleClosedSessionRef.current = false;
    setIsPaused(false);
    await trackerAPI.resumeTracking();
  }

  async function handleLogout() {
    await handleStop();
    clearSession();
    setUser(null);
    setProjects([]);
    setTodos([]);
    if (realtimeRef.current) {
      const ch = realtimeRef.current;
      realtimeRef.current = null;
      getSupabase().then((sb: any) => sb.removeChannel(ch));
    }
    setScreen('login');
  }

  async function handleDeleteAccount() {
    const sb = await getSupabase();
    const { data: { session } } = await sb.auth.getSession();
    if (!session) throw new Error('No active session. Please log in again.');

    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiBase}/api/auth/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete account');

    // Clear all local state and log out
    await handleStop();
    clearSession();
    setUser(null);
    setProjects([]);
    setTodos([]);
    if (realtimeRef.current) {
      const ch = realtimeRef.current;
      realtimeRef.current = null;
      sb.removeChannel(ch);
    }
    await sb.auth.signOut();
    setScreen('login');
  }

  const handleTodoDone = useCallback(async (todoId: string) => {
    setTodos(prev => prev.filter(t => t.id !== todoId));
    const sb = await getSupabase();
    await sb.from('todos').update({ status: 'Done' }).eq('id', todoId);
  }, []);

  async function handleUpdateProfile(updated: Partial<User>) {
    if (!user) return;
    try {
      const sb = await getSupabase();
      const { error } = await sb.from('members').update(updated).eq('id', user.id);
      if (error) throw error;

      const newUser = { ...user, ...updated };
      setUser(newUser);
      localStorage.setItem(USER_KEY, JSON.stringify(newUser));
      setScreen('projects');
    } catch (err: any) {
      alert('Unable to update profile. Please try again or contact support.');
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Effects: Notifications
  // ─────────────────────────────────────────────────────────────────────────────

  // 1. Screenshot captured listener
  useEffect(() => {
    let unlisten: any = null;
    let isMounted = true;

    const setup = async () => {
      const u = await (trackerAPI as any).onScreenshotCaptured(() => {
        if (settingsRef.current?.screenshot_alerts !== false) {
          trackerAPI.showNotification('📸 Screenshot Captured', 'Your screen activity has been recorded.');
        }
      });
      if (!isMounted && u) {
        u(); // Clean up if unmounted before setup finished
      } else {
        unlisten = u;
      }
    };
    setup();
    // Listen for update progress
    const unlistenProgress = trackerAPI.onUpdateProgress((p: number) => setUpdateProgress(p));
    
    // Listen for update available
    const unlistenAvailable = trackerAPI.onUpdateAvailable((info: any) => {
      if (info.available && info.version) {
        setUpdateVersion(info.version);
        setUpdateInstalling(true);
        trackerAPI.installUpdate().catch((e) => {
          console.error('Auto update failed:', e);
          setUpdateInstalling(false);
        });
      }
    });

    return () => {
      isMounted = false;
      if (unlisten) unlisten();
      if (unlistenProgress) unlistenProgress.then((fn: any) => fn && fn());
      if (unlistenAvailable) unlistenAvailable.then((fn: any) => fn && fn());
    };
  }, []); // Only run once on mount

  // 2. Tracking Reminder
  useEffect(() => {
    // Check ref immediately for interval creation
    if (!user || isTracking || settingsRef.current?.tracking_reminders === false) return;

    const intervalMin = settingsRef.current?.reminder_interval || 30;
    const intervalMs = intervalMin * 60_000;

    const interval = setInterval(() => {
      // Re-verify ref inside interval
      if (!isTracking && settingsRef.current?.tracking_reminders !== false) {
        trackerAPI.showNotification('⏰ Time to Track?', "You haven't started tracking time yet. Don't forget to clock in!");
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [isTracking, user?.id, user?.custom_fields?.notification_settings?.tracking_reminders, user?.custom_fields?.notification_settings?.reminder_interval]);

  const pageVariants = {
    initial: { opacity: 0, y: 8 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -8 }
  };
  const pageTransition: any = { type: 'tween', ease: 'easeInOut', duration: 0.2 };

  return (
    <div className="app-container">
      {/* Auto-update banner */}
      {updateVersion && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: '#001338', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', padding: '24px',
          textAlign: 'center', userSelect: 'none'
        }}>
          <div style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '32px' }}>
            <img 
              src="/header-white.svg" 
              style={{ height: '64px', objectFit: 'contain', filter: 'drop-shadow(0 0 20px rgba(250, 204, 21, 0.6))' }}
              className="animate-pulse"
              alt="TrackOwl" 
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#fff', letterSpacing: '-0.025em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', margin: 0 }}>
                <RefreshCcw className="animate-spin" style={{ width: '28px', height: '28px', color: '#facc15' }} />
                Updating TrackOwl
              </h2>
              <p style={{ fontSize: '14px', fontWeight: '500', color: '#cbd5e1', margin: 0 }}>
                Installing Version {updateVersion} — Please do not close the application.
              </p>
            </div>

            {!updateInstalling ? (
              <div style={{ width: '100%', padding: '16px', background: 'rgba(127,29,29,0.4)', border: '1px solid rgba(239,68,68,0.2)', color: '#fca5a5', fontSize: '14px', borderRadius: '12px', fontWeight: '500' }}>
                <p style={{ fontWeight: '700', margin: '0 0 4px 0' }}>Update Failed</p>
                <button
                  onClick={async () => {
                    setUpdateInstalling(true);
                    try {
                      await trackerAPI.installUpdate();
                    } catch (e) {
                      console.error('Update retry failed:', e);
                      setUpdateInstalling(false);
                    }
                  }}
                  style={{ marginTop: '16px', padding: '10px 24px', background: '#dc2626', color: '#fff', border: 'none', fontSize: '12px', fontWeight: '700', borderRadius: '8px', cursor: 'pointer' }}
                >
                  Retry Update
                </button>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: '700', color: '#94a3b8', padding: '0 4px' }}>
                  <span>{updateProgress === 100 ? 'Installing...' : 'Downloading assets...'}</span>
                  <span style={{ color: '#facc15', fontFamily: 'monospace' }}>{updateProgress}%</span>
                </div>
                
                <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', height: '12px', borderRadius: '9999px', overflow: 'hidden', padding: '2px' }}>
                  <div 
                    style={{ 
                      height: '100%', borderRadius: '9999px', transition: 'all 300ms ease',
                      width: `${updateProgress}%`,
                      background: 'linear-gradient(90deg, #facc15 0%, #eab308 100%)',
                      boxShadow: '0 0 10px rgba(250, 204, 21, 0.4)'
                    }}
                  />
                </div>

                {updateProgress === 100 && (
                  <p className="animate-bounce" style={{ fontSize: '12px', color: '#94a3b8', fontWeight: '600', marginTop: '16px', margin: 0 }}>
                    Finalizing installation and restarting...
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait">
        {screen === 'login' && (
          <motion.div key="login" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ display: 'flex', flex: 1, minHeight: 0 }}>
            <LoginScreen onLogin={handleLogin} rememberMe={rememberMe} setRememberMe={setRememberMe} />
          </motion.div>
        )}
        {screen === 'projects' && (
          <motion.div key="projects" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <ProjectsScreen user={user!} projects={projects} onSelect={handleSelectProject} onLogout={handleLogout} onSettings={() => setScreen('settings')} trackingError={trackingError} setTrackingError={setTrackingError} todos={todos} onTodoDone={handleTodoDone} activeProjectId={activeProject?.id} isTracking={isTracking} localElapsed={liveElapsed} orgTimezone={orgTimezone} />
          </motion.div>
        )}
        {screen === 'consent' && (
          <motion.div key="consent" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ display: 'flex', flex: 1, flexDirection: 'column' }}>
            <ConsentScreen user={user!} project={activeProject!} onAccept={handleConsentAccepted} onDecline={handleConsentDeclined} />
          </motion.div>
        )}
        {screen === 'tracker' && (
          <motion.div key="tracker" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <TrackerScreen
              user={user!}
              project={activeProject!}
              sessionId={sessionId}
              idlePaused={idlePaused}
              onResumeFromIdle={resumeFromIdle}
              liveIdleSeconds={liveIdleSeconds}
              onStop={handleStop}
              onSettings={() => setScreen('settings')}
              todos={todos}
              onTodoDone={handleTodoDone}
              localElapsed={liveElapsed}
              orgTimezone={orgTimezone}
              isPaused={isPaused}
              onPauseResume={isPaused ? handleResume : handlePause}
            />
          </motion.div>
        )}
        {screen === 'settings' && user && (
          <motion.div key="settings" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <SettingsScreen user={user} onSave={handleUpdateProfile} onBack={() => setScreen('projects')} onLogout={handleLogout} onDeleteAccount={handleDeleteAccount} />
          </motion.div>
        )}
        {screen === 'support' && user && (
          <motion.div key="support" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0 }}>
            <SupportScreen user={user} onBack={() => setScreen('projects')} />
          </motion.div>
        )}
      </AnimatePresence>
      <AppFooter
        lastSyncTime={lastSyncTime}
        isSyncing={isSyncing}
        onSync={handleManualSync}
        isOnline={isOnline}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Login
// ─────────────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, rememberMe, setRememberMe }: {
  onLogin: (email: string, password: string) => Promise<string | null>;
  rememberMe: boolean;
  setRememberMe: (v: boolean) => void;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);
  const [forgotSent, setForgotSent] = useState(false);

  async function submitForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotError(null);
    setForgotLoading(true);
    try {
      const sb = await getSupabase();
      const adminPortalUrl = import.meta.env.VITE_ADMIN_PORTAL_URL || 'http://localhost:5174';
      const { error } = await sb.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${adminPortalUrl}/update-password`,
      });
      if (error) throw new Error(error.message);
      setForgotSent(true);
    } catch (err: any) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await onLogin(email.trim(), password);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <div className="login-screen">
      <motion.div
        className="login-card"
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05, duration: 0.3 }}
      >
        <div className="brand-header">
          <div className="brand-logo">
            <img src="/logo.png" style={{ width: 64, height: 64, objectFit: 'contain' }} alt="TrackOwl" />
          </div>
          <div className="brand-header-text">
            <h1 className="heading-1">{forgotMode ? 'Reset Password' : 'Welcome back'}</h1>
            <p className="text-muted">{forgotMode ? 'Enter your email for a reset link' : 'Sign in to TrackOwl'}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {forgotMode ? (
            <motion.div key="forgot" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }}>
              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '1.25rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '2rem' }}>📧</div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9375rem' }}>Check your email</p>
                  <p className="text-muted" style={{ maxWidth: 280 }}>
                    A reset link was sent to <strong>{forgotEmail}</strong>. Open it to set a new password.
                  </p>
                  <button className="btn btn-secondary" style={{ width: '100%', marginTop: '0.25rem' }}
                    onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(''); }}>
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={submitForgot} className="login-form">
                  <div className="field-group">
                    <label className="field-label">Your Email</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                      <input type="email" required autoFocus value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                        placeholder="you@company.com" className="field-input" style={{ paddingLeft: '2.25rem' }} />
                    </div>
                  </div>
                  {forgotError && <div className="alert alert-warning"><ShieldAlert size={14} /><span>{forgotError}</span></div>}
                  <button type="submit" disabled={forgotLoading || !forgotEmail.trim()} className="btn btn-primary" style={{ width: '100%' }}>
                    {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                    {!forgotLoading && <ArrowRight size={16} />}
                  </button>
                  <button type="button" className="btn btn-ghost" style={{ width: '100%', fontSize: '0.8125rem' }}
                    onClick={() => { setForgotMode(false); setForgotError(null); }}>
                    ← Back to Sign In
                  </button>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.form key="login" onSubmit={submit} className="login-form"
              initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }} transition={{ duration: 0.2 }}>
              <div className="field-group">
                <label className="field-label">Email</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
                  <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com" className="field-input" style={{ paddingLeft: '2.25rem' }} />
                </div>
              </div>

              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="field-label">Password</label>
                  <button type="button" onClick={() => { setForgotMode(true); setForgotEmail(email); setForgotError(null); }}
                    style={{ fontSize: '0.75rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={15} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input"
                    style={{ paddingLeft: '2.25rem', paddingRight: '2.25rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center',
                      padding: '2px'
                    }}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                  className="alert alert-warning" style={{ overflow: 'hidden' }}>
                  <ShieldAlert size={14} /><span>{error}</span>
                </motion.div>
              )}

              <label className="checkbox-wrap">
                <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
                <span>Keep me signed in</span>
              </label>

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%' }}>
                {loading ? 'Signing in…' : 'Sign In'}
                {!loading && <ArrowRight size={16} />}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Topbar
// ─────────────────────────────────────────────────────────────────────────────
function Topbar({ user, onLogout, onSettings, todoBadge, disabled, orgTimezone }: { user?: User; onLogout?: () => void; onSettings?: () => void; todoBadge?: number; disabled?: boolean; orgTimezone?: string }) {
  const initials = user?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  return (
    <header className="app-topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">
          <img src="/header-white.svg" style={{ height: 24, width: 'auto', objectFit: 'contain' }} alt="TrackOwl" />
        </div>
      </div>
      {user && <LocalClock orgTimezone={orgTimezone} />}
      {user && onLogout && (
        <div className={`topbar-actions ${disabled ? 'disabled-actions' : ''}`}>
          {todoBadge != null && todoBadge > 0 && (
            <div style={{ position: 'relative', display: 'inline-flex' }} title={`${todoBadge} open task${todoBadge > 1 ? 's' : ''}`}>
              <ClipboardList size={18} style={{ color: '#fff' }} />
              <span style={{
                position: 'absolute', top: '-5px', right: '-7px',
                background: '#ef4444', color: '#fff', borderRadius: '999px',
                fontSize: '9px', fontWeight: 700, minWidth: '13px', height: '13px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px', lineHeight: 1,
              }}>{todoBadge > 9 ? '9+' : todoBadge}</span>
            </div>
          )}
          <div className="user-avatar" onClick={disabled ? undefined : onSettings} style={{ cursor: (onSettings && !disabled) ? 'pointer' : 'default', overflow: 'hidden' }}>
            <div className="user-avatar-wrap">
              {user.avatar_url ? (
                <SignedImage path={user.avatar_url} bucket="avatars" className="user-avatar-img" />
              ) : initials}
            </div>
          </div>
          <button onClick={disabled ? undefined : onLogout} className="btn btn-ghost" title={disabled ? "Stop timer to sign out" : "Sign out"} style={{ padding: '0.3rem', color: '#fff' }} disabled={disabled}>
            <LogOut size={16} />
          </button>
        </div>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My Tasks Panel
// ─────────────────────────────────────────────────────────────────────────────
function MyTasksPanel({ todos, onDone, disabled }: { todos: Todo[]; onDone: (id: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(true);
  if (todos.length === 0) return null;
  return (
    <div className={`tasks-panel ${disabled ? 'disabled-actions' : ''}`}>
      <button onClick={() => setOpen(o => !o)} className={`tasks-panel-header ${open ? 'open' : ''}`}>
        <span className="tasks-panel-title">
          <ClipboardList size={12} />
          My Tasks
          <span className="tasks-badge">{todos.length > 9 ? '9+' : todos.length}</span>
        </span>
        {open ? <ChevronDown size={13} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronUp size={13} style={{ color: 'var(--text-tertiary)' }} />}
      </button>

      {open && (
        <div className="tasks-list">
          {todos.map(todo => (
            <div key={todo.id} className="task-item">
              <button className="task-check-btn" onClick={() => onDone(todo.id)} title="Mark as done">
                <Circle size={14} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.25rem' }}>
                  <span className="task-title">{todo.title}</span>
                  {todo.projectName && (
                    <span className="task-project-tag" style={{
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                    }}>{todo.projectName}</span>
                  )}
                </div>
                {todo.due_date && (
                  <div className="task-meta">
                    <Calendar size={10} />
                    {new Date(todo.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Projects
// ─────────────────────────────────────────────────────────────────────────────
function ProjectsScreen({ user, projects, onSelect, onLogout, onSettings, trackingError, setTrackingError, todos, onTodoDone, activeProjectId, isTracking, localElapsed, orgTimezone }: {
  user: User;
  projects: Project[];
  onSelect: (p: Project) => void;
  onLogout: () => void;
  onSettings: () => void;
  trackingError?: string | null;
  setTrackingError: (err: string | null) => void;
  todos: Todo[];
  onTodoDone: (id: string) => void;
  activeProjectId?: string | null;
  isTracking?: boolean;
  localElapsed?: number;
  orgTimezone?: string;
}) {
  const getProjectToday = (p: Project) => {
    if (isTracking && activeProjectId && p.id === activeProjectId) {
      return localElapsed || 0;
    }
    return p.stats?.todaySeconds || 0;
  };

  const getProjectWeekly = (p: Project) => {
    const baseWeekly = p.stats?.weeklySeconds || 0;
    if (isTracking && activeProjectId && p.id === activeProjectId) {
      const otherDaysWeekly = Math.max(0, baseWeekly - (p.stats?.todaySeconds || 0));
      return otherDaysWeekly + (localElapsed || 0);
    }
    return baseWeekly;
  };

  const displayTotalToday = projects.reduce((s, p) => s + getProjectToday(p), 0);
  const displayTotalWeek = projects.reduce((s, p) => s + getProjectWeekly(p), 0);
  
  // Total tracked = all samples × 60s (including idle below limit)
  const totalToday = projects.reduce((s, p) => s + (p.stats?.todaySeconds || 0), 0);
  const totalWeek = projects.reduce((s, p) => s + (p.stats?.weeklySeconds || 0), 0);
  const tracked = projects.filter(p => (p.stats?.weeklySeconds || 0) > 0);
  const avgActivity = tracked.length > 0
    ? Math.round(tracked.reduce((s, p) => s + (p.stats?.activityPercent || 0), 0) / tracked.length)
    : 0;

  const weeklyLimitSecs = (user.weekly_limit || 40) * 3600;
  const dailyLimitSecs = (user.daily_limit || 8) * 3600;

  const isWeeklyLimitReached = totalWeek >= weeklyLimitSecs;
  const isDailyLimitReached = totalToday >= dailyLimitSecs;

  const todayProgressPct = Math.min(100, Math.round((displayTotalToday / (dailyLimitSecs || 1)) * 100));

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 },
  };

  return (
    <div className="projects-layout">
      <Topbar user={user} onLogout={onLogout} onSettings={onSettings} todoBadge={todos.length} orgTimezone={orgTimezone} />

      <div className="projects-scroll">
        {/* Stats Container (Hero + Secondary Strip) */}
        <div className="stats-container">
          <div className="stats-hero-card">
            <div className="stats-hero-header">
              <span className="stats-hero-pill">Today</span>
              {isTracking ? (
                <div className="stats-live-badge">
                  <span className="live-pulse-dot" />
                  <span>Live</span>
                </div>
              ) : (
                <span className="stats-hero-target-pill">
                  {todayProgressPct}% of {user.daily_limit || 8}h goal
                </span>
              )}
            </div>

            <div className="stats-hero-body">
              <div className="stats-hero-value">{formatTime(displayTotalToday)}</div>
              {isTracking && (
                <span className="stats-hero-target-pill">
                  {todayProgressPct}% of {user.daily_limit || 8}h goal
                </span>
              )}
            </div>

            <div className="stats-progress-track" title={`${todayProgressPct}% of daily limit`}>
              <div
                className="stats-progress-fill"
                style={{ width: `${Math.max(displayTotalToday > 0 ? 3 : 0, todayProgressPct)}%` }}
              />
            </div>
          </div>

          <div className="stats-secondary-grid">
            <div className="stats-secondary-card">
              <div className="stats-secondary-lbl">This Week</div>
              <div className="stats-secondary-val">{formatTime(displayTotalWeek)}</div>
            </div>
            <div className="stats-secondary-card">
              <div className="stats-secondary-lbl">Avg Activity</div>
              <div className="stats-secondary-val">{avgActivity}%</div>
            </div>
          </div>
        </div>

        {trackingError && (
          <div className="alert alert-warning" style={{ marginBottom: '0.75rem' }}>
            <ShieldAlert size={14} /><span>{trackingError}</span>
          </div>
        )}

        {user.tracking_enabled === false && (
          <div className="alert alert-warning" style={{ marginBottom: '1.5rem', background: 'rgba(252, 211, 77, 0.1)', borderColor: 'rgba(252, 211, 77, 0.3)' }}>
            <Lock size={14} style={{ color: 'var(--warning-text)' }} />
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Tracking is currently disabled for your account.</span>
          </div>
        )}

        <div className="section-header">
          <span className="section-title">Projects</span>
          <span className="section-count-badge">{projects.length} available</span>
        </div>

        {projects.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon"><CheckCircle2 size={24} /></div>
            <h3 className="heading-3">All caught up!</h3>
            <p className="text-muted" style={{ maxWidth: 260 }}>No active projects assigned. Contact your manager if this seems wrong.</p>
          </div>
        ) : (
          <motion.div className="project-list" variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } }} initial="hidden" animate="show">
            {projects.map(p => {
              const projectToday = getProjectToday(p);
              const projectWeekly = getProjectWeekly(p);
              const projColor = p.color || '#D4AF37';

              return (
                <motion.div key={p.id} variants={itemVariants}>
                  <div
                    className="project-card"
                    onClick={() => {
                      if (user.tracking_enabled === false) return;
                      if (isWeeklyLimitReached) {
                        setTrackingError(`Weekly limit (${user.weekly_limit}h) reached. Please contact your manager.`);
                        return;
                      }
                      if (isDailyLimitReached) {
                        setTrackingError(`Daily limit (${user.daily_limit}h) reached. Please contact your manager.`);
                        return;
                      }
                      onSelect(p);
                    }}
                    style={{ '--project-color': projColor } as any}
                  >
                    <div className="project-card-accent" />

                    <div className="project-card-body">
                      <div className="project-card-title">{p.name}</div>
                      {p.description && <div className="project-card-desc">{p.description}</div>}
                      {p.stats && (
                        <div className="project-card-meta">
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{formatTime(projectWeekly)}</strong> this week
                          </span>
                          <span style={{ fontSize: '0.75rem', color: p.stats.activityPercent < 50 ? 'var(--danger)' : 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                            <strong style={{ fontWeight: 600 }}>{p.stats.activityPercent}%</strong> activity
                          </span>
                        </div>
                      )}
                    </div>

                    {p.stats && (
                      <div className="project-card-stats">
                        <div className="project-card-time">{formatTime(projectToday)}</div>
                        <div className="project-card-time-label">Today</div>
                      </div>
                    )}

                    <div className="project-card-footer">
                      <ChevronRight size={16} className="project-arrow" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}

        {/* Lightweight Summary Breakdown (Fills vertical balance when project count is small) */}
        {projects.length > 0 && projects.length < 4 && displayTotalWeek > 0 && (
          <div className="breakdown-card">
            <div className="breakdown-header">
              <span className="breakdown-title">This Week's Breakdown</span>
              <span className="breakdown-metric">
                {formatTime(displayTotalWeek)} {user.weekly_limit ? `/ ${user.weekly_limit}h goal` : ''}
              </span>
            </div>

            <div className="breakdown-progress-track">
              {projects
                .filter(p => getProjectWeekly(p) > 0)
                .map(p => {
                  const sec = getProjectWeekly(p);
                  const pct = Math.max(2, (sec / (displayTotalWeek || 1)) * 100);
                  return (
                    <div
                      key={p.id}
                      className="breakdown-progress-segment"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: p.color || '#D4AF37',
                      }}
                      title={`${p.name}: ${formatTime(sec)}`}
                    />
                  );
                })}
            </div>

            <div className="breakdown-legend">
              {projects
                .filter(p => getProjectWeekly(p) > 0)
                .map(p => (
                  <div key={p.id} className="breakdown-legend-item">
                    <span
                      className="breakdown-legend-dot"
                      style={{ backgroundColor: p.color || '#D4AF37' }}
                    />
                    <span>{p.name}</span>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      ({formatTime(getProjectWeekly(p))})
                    </strong>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      <MyTasksPanel todos={todos} onDone={onTodoDone} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Consent
// ─────────────────────────────────────────────────────────────────────────────
function ConsentScreen({ user, project, onAccept, onDecline }: {
  user: User;
  project: Project;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="projects-layout">
      <Topbar />
      <div className="consent-scroll">
        <motion.div className="consent-card"
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}>

          <div className="consent-header">
            <div className="consent-icon">
              <ShieldAlert size={22} />
            </div>
            <h2 className="heading-2">Tracking Permissions</h2>
            <p className="text-muted" style={{ marginTop: '0.375rem' }}>
              About to track <strong style={{ color: 'var(--text-primary)' }}>{project.name}</strong>. Here's what's collected.
            </p>
          </div>

          <div className="consent-body">
            {(user.plan_type === 'Premium' || user.plan_type === 'Trial') && (
              <ConsentItem icon={<Eye size={16} />} title="Screenshots" desc="Up to 3 random captures every 10 min to verify work." />
            )}
            {(user.plan_type === 'Premium' || user.plan_type === 'Trial') && (
              <ConsentItem icon={<MonitorPlay size={16} />} title="Active Application" desc="Names of active windows (e.g. Chrome, VS Code)." />
            )}
            <ConsentItem icon={<MousePointerClick size={16} />} title="Activity Counts" desc="Mouse clicks and keystrokes count (not content)." />
            <ConsentItem icon={<MapPin size={16} />} title="General Location" desc="IP-based location for security auditing." />
            <div className="consent-note">
              Data is encrypted and only visible to your organization's admins. You can stop at any time.
            </div>
          </div>

          <div className="consent-actions">
            <button onClick={onAccept} className="btn btn-primary" style={{ width: '100%' }}>
              I Understand — Start Tracking
            </button>
            <button onClick={onDecline} className="btn btn-secondary" style={{ width: '100%' }}>
              Cancel
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ConsentItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="consent-item">
      <div className="consent-item-icon">{icon}</div>
      <div>
        <div className="consent-item-title">{title}</div>
        <div className="consent-item-desc">{desc}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Tracker
// ─────────────────────────────────────────────────────────────────────────────
function TrackerScreen({ user, project, idlePaused = false, onResumeFromIdle, liveIdleSeconds = 0, onStop, onSettings, todos, onTodoDone, localElapsed = 0, orgTimezone, isPaused = false, onPauseResume }: {
  user: User;
  project: Project;
  sessionId?: string | null;
  idlePaused?: boolean;
  onResumeFromIdle?: () => void;
  liveIdleSeconds?: number;
  onStop: () => void;
  onSettings: () => void;
  todos: Todo[];
  onTodoDone: (id: string) => void;
  localElapsed?: number;
  orgTimezone?: string;
  isPaused?: boolean;
  onPauseResume?: () => void;
}) {
  const fmt = (n: number) => String(n).padStart(2, '0');

  // Auto-focus window, set always-on-top, and handle keyboard shortcuts when idle popup triggers
  useEffect(() => {
    if (!idlePaused) return;

    // Pop window to front with Always-On-Top
    trackerAPI.focusWindow?.(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        trackerAPI.setAlwaysOnTop?.(false);
        onResumeFromIdle?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      trackerAPI.setAlwaysOnTop?.(false);
    };
  }, [idlePaused, onResumeFromIdle]);

  const baseKeptIdle = project.stats?.keptIdleSeconds || 0;

  // NEW FORMULA: Productive = Total Elapsed - Idle
  // liveIdleSeconds accumulates idle in the current unsaved session
  // baseKeptIdle is idle from previously completed/synced samples
  const totalIdleSeconds = baseKeptIdle + liveIdleSeconds;
  const displayProductive = Math.max(0, localElapsed - liveIdleSeconds);
  const displayIdle = totalIdleSeconds;

  const activeSecs = displayProductive;
  const hrsActive = Math.floor(activeSecs / 3600);
  const minsActive = Math.floor((activeSecs % 3600) / 60);
  const secsActive = activeSecs % 60;

  return (
    <div className="tracker-layout">
      {/* Idle Alert Popup */}
      <AnimatePresence>
        {idlePaused && (
          <motion.div
            className="idle-fullscreen-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="idle-popup-card"
              initial={{ scale: 0.94, y: 12, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.94, y: 8, opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 340 }}
            >
              {/* Icon */}
              <div className="idle-icon-wrap">
                <div className="idle-icon-ring" />
                <div className="idle-icon-ring idle-icon-ring-2" />
                <div className="idle-icon-core">
                  <ShieldAlert size={22} />
                </div>
              </div>

              {/* Text */}
              <h2 className="idle-title">Away Detected</h2>
              <p className="idle-subtitle">
                No activity for <strong>{user?.idle_limit || 10} min</strong>
                {' · '}
                <span className="idle-project-inline">
                  <span className="idle-project-inline-dot" style={{ backgroundColor: project.color || 'var(--accent)' }} />
                  {project.name}
                </span>
              </p>

              {/* Time stat */}
              <div className="idle-stat-row">
                <div className="idle-stat">
                  <span className="idle-stat-label">Productive</span>
                  <span className="idle-stat-val">{fmt(hrsActive)}:{fmt(minsActive)}:{fmt(secsActive)}</span>
                </div>
                <div className="idle-stat-sep" />
                <div className="idle-stat">
                  <span className="idle-stat-label">Away</span>
                  <span className="idle-stat-val idle-stat-val-away">{user?.idle_limit || 10}m</span>
                </div>
              </div>

              {/* Actions */}
              <div className="idle-actions">
                <button
                  className="idle-action-resume"
                  onClick={() => {
                    trackerAPI.setAlwaysOnTop?.(false);
                    onResumeFromIdle?.();
                  }}
                >
                  <Play size={15} fill="currentColor" />
                  Resume
                  <span className="idle-kbd">↵</span>
                </button>

                {user?.keep_idle_mode !== 'never' && (
                  <button
                    className="idle-action-discard"
                    onClick={() => {
                      trackerAPI.setAlwaysOnTop?.(false);
                      (window as any).discardIdleTime?.(true);
                    }}
                  >
                    <Trash2 size={14} />
                    Discard idle
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Topbar user={user} onLogout={onStop} onSettings={onSettings} todoBadge={todos.length} disabled={true} orgTimezone={orgTimezone} />

      <div className="tracker-body">
        <motion.div className="tracker-widget" initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.35 }}>
          <div className="tw-header">
            {isPaused ? (
              <div className="status-pill" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                <div className="status-dot" style={{ backgroundColor: '#f59e0b' }} />
                Paused
              </div>
            ) : (
              <div className="status-pill status-live">
                <div className="status-dot" />
                Live
              </div>
            )}
            <div className="tracker-project-pill">
              <div className="tracker-project-dot" style={{ backgroundColor: project.color || 'var(--accent)' }} />
              <span className="tracker-project-name">{project.name}</span>
            </div>
          </div>

          <div className="timer-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '1.25rem 0 2rem 0' }}>
            <span style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#666', marginBottom: '0.375rem' }}>
              Active Time
            </span>
            <div className="timer-display">
              {fmt(hrsActive)}:{fmt(minsActive)}:{fmt(secsActive)}
            </div>
          </div>

          <div className="stats-dashboard">
            <div className="stat-item">
              <span className="stat-label">Productive</span>
              <span className="stat-value">{fmt(Math.floor(displayProductive / 3600))}:{fmt(Math.floor((displayProductive % 3600) / 60))}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Idle</span>
              <span className="stat-value">{fmt(Math.floor(displayIdle / 3600))}:{fmt(Math.floor((displayIdle % 3600) / 60))}</span>
            </div>
          </div>

          <div className="tracker-controls" style={{ display: 'flex', gap: '0.625rem', width: '100%' }}>
            {isPaused && (
              <button className="control-btn" onClick={onPauseResume || onResumeFromIdle} style={{ flex: 1, backgroundColor: 'var(--accent)', color: '#000', fontWeight: 600 }}>
                <Play size={14} fill="currentColor" />
                Resume Tracking
              </button>
            )}
            <button className="control-btn action-stop" onClick={onStop} style={{ flex: isPaused ? 1 : undefined }}>
              <Square size={14} fill="currentColor" />
              Stop Session
            </button>
          </div>

          <p className="timer-subtext">
            TrackOwl
          </p>
        </motion.div>
      </div>

      <MyTasksPanel todos={todos} onDone={onTodoDone} />

      <UpdaterOverlay />
    </div>
  );
}
