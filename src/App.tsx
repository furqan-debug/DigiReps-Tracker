import { useState, useEffect, useRef } from 'react';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type Screen = 'login' | 'projects' | 'consent' | 'tracker';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

interface Project {
  id: string;
  name: string;
  description: string;
  color: string;
}

interface ActivitySample {
  type?: 'screenshot';
  session_id: string;
  timestamp: string;
  mouse_count?: number;
  keyboard_count?: number;
  app_name?: string;
  window_title?: string;
  domain?: string;
  idle_flag?: boolean;
  file_url?: string;
}

// ─── Persistent storage ───────────────────────────────────────────────────────
const TOKEN_KEY = 'digireps_token';
const USER_KEY = 'digireps_user';
const CONSENT_KEY = 'digireps_consent_v1';

function loadSession(): { token: string; user: User } | null {
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    const user = JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    if (token && user) return { token, user };
  } catch { }
  return null;
}
function saveSession(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
function hasConsented(): boolean {
  return localStorage.getItem(CONSENT_KEY) === 'true';
}
function saveConsent() {
  localStorage.setItem(CONSENT_KEY, 'true');
}

// ─── App ──────────────────────────────────────────────────────────────────────
const API = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:3001';

export default function App() {
  const [screen, setScreen] = useState<Screen>('login');
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [rememberMe, setRememberMe] = useState(true);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Restore session on startup
  useEffect(() => {
    (window as any).trackerAPI?.onTrackingSample((_sample: ActivitySample) => {
      // samples are sent to admin via backend — not displayed in tracker
    });

    const saved = loadSession();
    if (!saved) return;

    fetch(`${API}/api/auth/me`, { headers: { Authorization: `Bearer ${saved.token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.user) {
          setUser(saved.user);
          setProjects(data.projects || []);
          setScreen('projects');
        } else {
          clearSession();
        }
      })
      .catch(() => clearSession());
  }, []);

  // Elapsed timer — only ticks when tracking and not paused
  useEffect(() => {
    if (isTracking && !isPaused) {
      timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking, isPaused]);

  // ── Auth ──────────────────────────────────────────────────────────────────
  async function handleLogin(email: string, password: string): Promise<string | null> {
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return data.error || 'Login failed';

      if (rememberMe) saveSession(data.token, data.user);
      setUser(data.user);
      setProjects(data.projects || []);
      setScreen('projects');
      return null;
    } catch {
      return 'Network error — is the backend running?';
    }
  }

  // ── Project select → Consent gate ─────────────────────────────────────────
  function handleSelectProject(project: Project) {
    setActiveProject(project);
    // If already consented in this install, skip consent screen
    if (hasConsented()) {
      startTracking(project);
    } else {
      setScreen('consent');
    }
  }

  // ── Consent accepted ──────────────────────────────────────────────────────
  function handleConsentAccepted() {
    saveConsent();
    if (activeProject) startTracking(activeProject);
  }

  // ── Consent declined / back ───────────────────────────────────────────────
  function handleConsentDeclined() {
    setActiveProject(null);
    setScreen('projects');
  }

  // ── Start tracking ────────────────────────────────────────────────────────
  async function startTracking(project: Project) {
    setElapsed(0);
    setIsPaused(false);

    if (!(window as any).trackerAPI) {
      // Browser dev mode — simulate
      setSessionId('demo-' + Date.now());
      setIsTracking(true);
      setScreen('tracker');
      return;
    }
    // @ts-ignore
    const res = await (window as any).trackerAPI.startTracking(project.id);
    setIsTracking(true);
    setSessionId(res.session_id);
    setScreen('tracker');
  }

  // ── Stop ──────────────────────────────────────────────────────────────────
  async function handleStop() {
    if ((window as any).trackerAPI) {
      // @ts-ignore
      await (window as any).trackerAPI.stopTracking();
    }
    setIsTracking(false);
    setIsPaused(false);
    setSessionId(null);
    setActiveProject(null);
    setElapsed(0);
    setScreen('projects');
  }

  // ── Pause / Resume ────────────────────────────────────────────────────────
  async function handlePause() {
    setIsPaused(true);
    if ((window as any).trackerAPI?.pauseTracking) {
      // @ts-ignore
      await (window as any).trackerAPI.pauseTracking();
    }
  }

  async function handleResume() {
    setIsPaused(false);
    if ((window as any).trackerAPI?.resumeTracking) {
      // @ts-ignore
      await (window as any).trackerAPI.resumeTracking();
    }
  }

  // ── Logout ────────────────────────────────────────────────────────────────
  function handleLogout() {
    handleStop();
    clearSession();
    setUser(null);
    setProjects([]);
    setScreen('login');
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  if (screen === 'login') {
    return <LoginScreen onLogin={handleLogin} rememberMe={rememberMe} setRememberMe={setRememberMe} />;
  }

  if (screen === 'projects') {
    return (
      <ProjectsScreen
        user={user!}
        projects={projects}
        onSelect={handleSelectProject}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === 'consent') {
    return (
      <ConsentScreen
        project={activeProject!}
        onAccept={handleConsentAccepted}
        onDecline={handleConsentDeclined}
      />
    );
  }

  return (
    <TrackerScreen
      user={user!}
      project={activeProject!}
      sessionId={sessionId}
      isPaused={isPaused}
      elapsed={elapsed}
      onStop={handleStop}
      onPause={handlePause}
      onResume={handleResume}
    />
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await onLogin(email.trim(), password);
    if (err) setError(err);
    setLoading(false);
  }

  return (
    <div className="screen login-screen">
      <div className="login-card">
        {/* Logo mark */}
        <div className="brand">
          <div className="brand-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.15" />
              <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="brand-name">DigiReps</span>
        </div>

        <h1 className="login-title">Welcome back</h1>
        <p className="login-sub">Sign in to your workspace</p>

        <form onSubmit={submit} className="login-form">
          <div className="field">
            <label className="label">Email address</label>
            <input
              type="email" required autoFocus
              value={email} onChange={e => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="input"
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className="input"
            />
          </div>

          {error && <div className="alert-error">{error}</div>}

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
            />
            <span className="checkbox-label">Keep me signed in</span>
          </label>

          <button type="submit" disabled={loading} className="btn-primary">
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Project Picker
// ─────────────────────────────────────────────────────────────────────────────
function ProjectsScreen({ user, projects, onSelect, onLogout }: {
  user: User;
  projects: Project[];
  onSelect: (p: Project) => void;
  onLogout: () => void;
}) {
  const initials = user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="screen projects-screen">
      {/* Top bar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="brand-icon sm">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" fill="white" fillOpacity="0.2" />
              <path d="M8 12l3 3 5-5" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="topbar-name">DigiReps</span>
        </div>
        <div className="topbar-user">
          <div className="avatar">{initials}</div>
          <button onClick={onLogout} className="btn-logout" title="Sign out">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="projects-body">
        <div className="section-header">
          <h2 className="section-title">Select a project</h2>
          <p className="section-sub">Choose the project you're working on today</p>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3" />
                <path d="M9 12h6M12 9v6" />
              </svg>
            </div>
            <p className="empty-title">No projects assigned</p>
            <p className="empty-hint">Ask your admin to assign you to a project.</p>
          </div>
        ) : (
          <div className="project-list">
            {projects.map(p => (
              <button key={p.id} className="project-item" onClick={() => onSelect(p)}>
                <div className="project-dot" style={{ backgroundColor: p.color }} />
                <div className="project-info">
                  <span className="project-name">{p.name}</span>
                  {p.description && <span className="project-desc">{p.description}</span>}
                </div>
                <svg className="project-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Consent
// ─────────────────────────────────────────────────────────────────────────────
function ConsentScreen({ project, onAccept, onDecline }: {
  project: Project;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <div className="screen consent-screen">
      <div className="consent-card">
        {/* Header */}
        <div className="consent-header">
          <div className="consent-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <h1 className="consent-title">Before you start</h1>
          <p className="consent-subtitle">
            Tracking will begin for <strong>{project.name}</strong>. Please review what data is collected.
          </p>
        </div>

        {/* Data collected */}
        <div className="consent-section">
          <h2 className="consent-section-title">Data collected while tracking</h2>
          <div className="consent-items">
            <ConsentItem
              icon="📸"
              label="Screenshots"
              detail="3 screenshots at random moments within every 10-minute window"
            />
            <ConsentItem
              icon="🖥️"
              label="Active application"
              detail="Name of the app in focus (e.g., Chrome, VS Code)"
            />
            <ConsentItem
              icon="🌐"
              label="Browser domain"
              detail="Domain of the website you're visiting (e.g., github.com)"
            />
            <ConsentItem
              icon="⌨️"
              label="Activity counts"
              detail="Number of keystrokes and mouse clicks per interval (not content)"
            />
            <ConsentItem
              icon="📍"
              label="Approximate location"
              detail="IP-based city/country — not GPS tracking"
            />
          </div>
        </div>

        {/* How it's used */}
        <div className="consent-section">
          <h2 className="consent-section-title">How this data is used</h2>
          <ul className="consent-list">
            <li>To calculate time worked on each project</li>
            <li>To generate productivity reports for your manager</li>
            <li>For accurate payroll based on tracked hours</li>
            <li>Data is visible only to admins, not to other team members</li>
          </ul>
        </div>

        {/* Permissions required */}
        <div className="consent-section">
          <h2 className="consent-section-title">Permissions required</h2>
          <ul className="consent-list">
            <li>Screen recording (for screenshots)</li>
            <li>Accessibility access (for app/window name detection)</li>
          </ul>
        </div>

        {/* Actions */}
        <div className="consent-actions">
          <button onClick={onDecline} className="btn-decline">Go back</button>
          <button onClick={onAccept} className="btn-accept">I understand — Start tracking</button>
        </div>

        <p className="consent-footer">
          You can stop tracking at any time. Your consent is remembered on this device.
        </p>
      </div>
    </div>
  );
}

function ConsentItem({ icon, label, detail }: { icon: string; label: string; detail: string }) {
  return (
    <div className="consent-item">
      <span className="consent-item-icon">{icon}</span>
      <div className="consent-item-body">
        <span className="consent-item-label">{label}</span>
        <span className="consent-item-detail">{detail}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Tracker  (minimal — no activity feed)
// ─────────────────────────────────────────────────────────────────────────────
function TrackerScreen({ user, project, isPaused = false, elapsed, onStop, onPause, onResume }: {
  user: User;
  project: Project;
  sessionId?: string | null;
  isPaused?: boolean;
  elapsed: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const fmt = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="screen tracker-screen">
      {/* Status bar */}
      <div className="tracker-bar">
        <div className={`live-pill ${isPaused ? 'paused' : ''}`}>
          <span className="live-dot" />
          {isPaused ? 'Paused' : 'Live'}
        </div>
        <span className="tracker-username">{user.full_name}</span>
      </div>

      {/* Main content */}
      <div className="tracker-body">
        {/* Project label */}
        <div className="tracker-project">
          <span className="tracker-project-dot" style={{ backgroundColor: project.color }} />
          <span className="tracker-project-name">{project.name}</span>
        </div>

        {/* Clock */}
        <div className={`tracker-clock ${isPaused ? 'clock-paused' : ''}`}>
          {fmt(hrs)}:{fmt(mins)}:{fmt(secs)}
        </div>

        {/* Status text */}
        <p className="tracker-status-text">
          {isPaused ? 'Timer paused — activity is not being recorded' : 'Tracking your time and activity'}
        </p>

        {/* Actions */}
        <div className="tracker-actions">
          {isPaused ? (
            <button className="btn-resume" onClick={onResume}>Resume</button>
          ) : (
            <button className="btn-pause" onClick={onPause}>Pause</button>
          )}
          <button className="btn-stop" onClick={onStop}>Stop & exit</button>
        </div>

        {/* Subtle note */}
        <p className="tracker-note">
          Activity data is sent securely to your workspace admin.
        </p>
      </div>
    </div>
  );
}
