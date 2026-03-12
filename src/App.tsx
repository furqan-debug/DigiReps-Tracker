import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Mail, ArrowRight, Play, Square, Pause,
  ChevronRight, Activity, LogOut, CheckCircle2,
  ShieldAlert, Eye, MapPin, MonitorPlay, MousePointerClick,
  ClipboardList, Calendar, Circle, ChevronDown, ChevronUp
} from 'lucide-react';
import './App.css';

const SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string;

// Lazy singleton Supabase client for the renderer
let _supabase: any = null;
async function getSupabase() {
  if (!_supabase) {
    const { createClient } = await import('@supabase/supabase-js');
    _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

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
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [todos, setTodos] = useState<Todo[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realtimeRef = useRef<any>(null);

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
          fetchAndSubscribeTodos(saved.user.id);
        } else {
          clearSession();
        }
      })
      .catch(() => clearSession());
  }, []);

  // Fetch open todos for the logged-in member and subscribe for new ones
  async function fetchAndSubscribeTodos(userId: string) {
    const sb = await getSupabase();

    // Initial fetch
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

    // Realtime subscription — fires on INSERT of a new assigned todo
    if (realtimeRef.current) sb.removeChannel(realtimeRef.current);
    realtimeRef.current = sb
      .channel('my-todos-' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'todos', filter: `assignee_id=eq.${userId}` },
        async (payload: any) => {
          const t = payload.new;
          // Fetch project details for the new todo
          const { data: proj } = await sb.from('projects').select('name, color').eq('id', t.project_id).single();
          const enriched: Todo = {
            ...t,
            projectName: proj?.name,
            projectColor: proj?.color,
          };
          setTodos(prev => [enriched, ...prev]);
          // Fire native desktop notification
          (window as any).trackerAPI?.showNotification(
            '📋 New Task Assigned',
            t.title + (proj?.name ? ` — ${proj.name}` : '')
          );
        }
      )
      .subscribe();
  }

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
      fetchAndSubscribeTodos(data.user.id);
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
    setTrackingError(null);

    if (!(window as any).trackerAPI) {
      // Browser dev mode — simulate
      setSessionId('demo-' + Date.now());
      setIsTracking(true);
      setScreen('tracker');
      return;
    }
    // @ts-ignore
    const res = await (window as any).trackerAPI.startTracking(project.id, user?.id);
    if (res.status === 'error') {
      setTrackingError(res.error || 'Failed to start tracking. Is the backend running?');
      setActiveProject(null);
      return;
    }
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
    setTodos([]);
    // Unsubscribe realtime (fire-and-forget)
    if (realtimeRef.current) {
      const ch = realtimeRef.current;
      realtimeRef.current = null;
      getSupabase().then((sb: any) => sb.removeChannel(ch));
    }
    setScreen('login');
  }

  // ── Mark a todo as Done ───────────────────────────────────────────────────
  const handleTodoDone = useCallback(async (todoId: string) => {
    setTodos(prev => prev.filter(t => t.id !== todoId));
    const sb = await getSupabase();
    await sb.from('todos').update({ status: 'Done' }).eq('id', todoId);
  }, []);

  // Screen variants for framer-motion transitions
  const pageVariants = {
    initial: { opacity: 0, y: 10, scale: 0.98 },
    in: { opacity: 1, y: 0, scale: 1 },
    out: { opacity: 0, y: -10, scale: 0.98 }
  };

  const pageTransition: any = {
    type: 'tween',
    ease: 'easeInOut',
    duration: 0.3
  };

  return (
    <div className="app-container">
      <AnimatePresence mode="wait">
        {screen === 'login' && (
          <motion.div key="login" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ width: '100%', display: 'flex' }}>
            <LoginScreen onLogin={handleLogin} rememberMe={rememberMe} setRememberMe={setRememberMe} />
          </motion.div>
        )}

        {screen === 'projects' && (
          <motion.div key="projects" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <ProjectsScreen user={user!} projects={projects} onSelect={handleSelectProject} onLogout={handleLogout} trackingError={trackingError} todos={todos} onTodoDone={handleTodoDone} />
          </motion.div>
        )}

        {screen === 'consent' && (
          <motion.div key="consent" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <ConsentScreen project={activeProject!} onAccept={handleConsentAccepted} onDecline={handleConsentDeclined} />
          </motion.div>
        )}

        {screen === 'tracker' && (
          <motion.div key="tracker" initial="initial" animate="in" exit="out" variants={pageVariants} transition={pageTransition} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
            <TrackerScreen user={user!} project={activeProject!} sessionId={sessionId} isPaused={isPaused} elapsed={elapsed} onStop={handleStop} onPause={handlePause} onResume={handleResume} todos={todos} onTodoDone={handleTodoDone} />
          </motion.div>
        )}
      </AnimatePresence>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Forgot password state ──────────────────────────────────────────────────
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
      // Create client lazily so missing env vars don't crash the app on load
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        (import.meta as any).env?.VITE_SUPABASE_URL as string,
        (import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string
      );
      // redirectTo points at the Admin Portal update-password page
      const adminPortalUrl = (import.meta as any).env?.VITE_ADMIN_PORTAL_URL || 'http://localhost:5174';
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
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
      <div className="login-bg-shape"></div>
      <div className="login-bg-shape-2"></div>

      <motion.div
        className="login-card"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.5 }}
      >
        <div className="brand-header">
          <div className="brand-logo">
            <Activity strokeWidth={2.5} size={28} />
          </div>
          <div>
            <h1 className="heading-1">{forgotMode ? 'Reset Password' : 'Welcome back'}</h1>
            <p className="text-muted">{forgotMode ? 'Enter your email to receive a reset link' : 'Sign in to DigiReps Tracker'}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">
          {forgotMode ? (
            <motion.div
              key="forgot"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
            >
              {forgotSent ? (
                <div style={{ textAlign: 'center', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ fontSize: '2.5rem' }}>📧</div>
                  <p style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Check your email</p>
                  <p className="text-muted" style={{ fontSize: '0.875rem' }}>
                    A reset link has been sent to <strong>{forgotEmail}</strong>. Open the link on your phone or computer
                    to set a new password, then sign in here.
                  </p>
                  <button
                    className="btn btn-secondary"
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.75rem' }}
                    onClick={() => { setForgotMode(false); setForgotSent(false); setForgotEmail(''); }}
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <form onSubmit={submitForgot} className="login-form">
                  <div className="field-group">
                    <label className="field-label">Your Email Address</label>
                    <div style={{ position: 'relative' }}>
                      <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-tertiary)' }} />
                      <input
                        type="email" required autoFocus
                        value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="field-input"
                        style={{ paddingLeft: '2.5rem' }}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {forgotError && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="alert alert-error"
                        style={{ overflow: 'hidden' }}
                      >
                        <ShieldAlert size={16} />
                        <span>{forgotError}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button type="submit" disabled={forgotLoading || !forgotEmail.trim()} className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.875rem' }}>
                    {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                    {!forgotLoading && <ArrowRight size={18} />}
                  </button>

                  <button
                    type="button"
                    className="btn btn-ghost"
                    style={{ width: '100%', padding: '0.625rem', marginTop: '0.25rem', fontSize: '0.875rem' }}
                    onClick={() => { setForgotMode(false); setForgotError(null); }}
                  >
                    ← Back to Sign In
                  </button>
                </form>
              )}
            </motion.div>
          ) : (
            <motion.form
              key="login"
              onSubmit={submit}
              className="login-form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.25 }}
            >
              <div className="field-group">
                <label className="field-label">Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-tertiary)' }} />
                  <input
                    type="email" required autoFocus
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    className="field-input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>

              <div className="field-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.375rem' }}>
                  <label className="field-label" style={{ margin: 0 }}>Password</label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setForgotEmail(email); setForgotError(null); }}
                    style={{ fontSize: '0.78rem', color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline', opacity: 0.75 }}
                  >
                    Forgot password?
                  </button>
                </div>
                <div style={{ position: 'relative' }}>
                  <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-tertiary)' }} />
                  <input
                    type="password" required
                    value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="field-input"
                    style={{ paddingLeft: '2.5rem' }}
                  />
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="alert alert-error"
                    style={{ overflow: 'hidden' }}
                  >
                    <ShieldAlert size={16} />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <label className="checkbox-wrap">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                />
                <span>Keep me signed in</span>
              </label>

              <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: '0.5rem', width: '100%', padding: '0.875rem' }}>
                {loading ? 'Signing in...' : 'Sign In'}
                {!loading && <ArrowRight size={18} />}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Topbar
// ─────────────────────────────────────────────────────────────────────────────
function Topbar({ user, onLogout, todoBadge }: { user?: User; onLogout?: () => void; todoBadge?: number }) {
  const initials = user?.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'U';
  return (
    <header className="app-topbar">
      <div className="topbar-brand">
        <div className="topbar-logo">
          <Activity size={20} />
        </div>
        <span className="topbar-title">DigiReps</span>
      </div>
      {user && onLogout && (
        <div className="topbar-actions">
          {todoBadge != null && todoBadge > 0 && (
            <div style={{ position: 'relative', display: 'inline-flex' }} title={`${todoBadge} open task${todoBadge > 1 ? 's' : ''}`}>
              <ClipboardList size={20} style={{ color: 'var(--text-secondary)' }} />
              <span style={{
                position: 'absolute', top: '-6px', right: '-8px',
                background: '#ef4444', color: '#fff',
                borderRadius: '999px', fontSize: '9px', fontWeight: 700,
                minWidth: '14px', height: '14px', display: 'flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 3px',
                lineHeight: 1,
              }}>{todoBadge > 9 ? '9+' : todoBadge}</span>
            </div>
          )}
          <div className="user-avatar">{initials}</div>
          <button onClick={onLogout} className="btn btn-ghost" title="Sign out" style={{ padding: '0.4rem' }}>
            <LogOut size={18} />
          </button>
        </div>
      )}
    </header>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// My Tasks Panel
// ─────────────────────────────────────────────────────────────────────────────
function MyTasksPanel({ todos, onDone }: { todos: Todo[]; onDone: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  if (todos.length === 0) return null;
  return (
    <div style={{
      margin: '0 1rem 1rem',
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '0.875rem',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.65rem 0.9rem', background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: open ? '1px solid var(--border)' : 'none',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          <ClipboardList size={13} />
          My Tasks
          <span style={{
            background: 'var(--accent)', color: '#fff',
            borderRadius: '999px', fontSize: '9px', fontWeight: 700,
            minWidth: '16px', height: '16px', display: 'inline-flex',
            alignItems: 'center', justifyContent: 'center', padding: '0 4px',
          }}>{todos.length}</span>
        </span>
        {open ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
      </button>
      {/* Task list */}
      {open && (
        <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
          {todos.map(todo => (
            <div key={todo.id} style={{
              display: 'flex', alignItems: 'flex-start', gap: '0.6rem',
              padding: '0.6rem 0.9rem',
              borderBottom: '1px solid var(--border-subtle)',
            }}>
              <button
                onClick={() => onDone(todo.id)}
                title="Mark as done"
                style={{ marginTop: '2px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, color: 'var(--text-tertiary)' }}
              >
                <Circle size={15} />
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginBottom: '0.15rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {todo.title}
                  </span>
                  {todo.projectName && (
                    <span style={{
                      fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                      padding: '1px 5px', borderRadius: '4px',
                      background: todo.projectColor ? `${todo.projectColor}22` : '#e0e7ff',
                      color: todo.projectColor || '#4f46e5',
                    }}>{todo.projectName}</span>
                  )}
                </div>
                {todo.description && (
                  <p style={{ margin: '0 0 0.35rem 0', fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {todo.description}
                  </p>
                )}
                {todo.due_date && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', color: 'var(--text-tertiary)' }}>
                    <Calendar size={10} />
                    {new Date(todo.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function ProjectsScreen({ user, projects, onSelect, onLogout, trackingError, todos, onTodoDone }: {
  user: User;
  projects: Project[];
  onSelect: (p: Project) => void;
  onLogout: () => void;
  trackingError?: string | null;
  todos: Todo[];
  onTodoDone: (id: string) => void;
}) {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="projects-layout">
      <Topbar user={user} onLogout={onLogout} todoBadge={todos.length} />

      <div className="projects-content">
        <div className="projects-header">
          <h2 className="heading-1">Select a Project</h2>
          <p className="text-muted" style={{ marginTop: '0.5rem' }}>Choose the active project to begin tracking your time.</p>
        </div>

        {trackingError && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', borderRadius: '0.75rem', padding: '0.75rem 1rem' }}>
            <ShieldAlert size={16} />
            <span>{trackingError}</span>
          </div>
        )}
        {projects.length === 0 ? (
          <div className="projects-empty">
            <div className="projects-empty-icon">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="heading-3">You're all caught up!</h3>
            <p className="text-muted" style={{ marginTop: '0.5rem' }}>You don't have any active projects assigned right now. Speak with your manager if this is a mistake.</p>
          </div>
        ) : (
          <motion.div
            className="projects-grid"
            variants={containerVariants}
            initial="hidden"
            animate="show"
          >
            {projects.map(p => (
              <motion.div key={p.id} variants={itemVariants}>
                <div
                  className="project-card"
                  onClick={() => onSelect(p)}
                  style={{ '--project-color': p.color } as any}
                >
                  <div className="project-card-header">
                    <div>
                      <h3 className="project-card-title">{p.name}</h3>
                      {p.description && <p className="project-card-desc">{p.description}</p>}
                    </div>
                  </div>

                  <div className="project-card-footer">
                    <span>Select project</span>
                    <ChevronRight size={18} className="project-card-arrow" />
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      <MyTasksPanel todos={todos} onDone={onTodoDone} />
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
    <div className="projects-layout">
      <Topbar />

      <div className="consent-content">
        <motion.div
          className="consent-card"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        >
          <div className="consent-header">
            <div className="consent-icon">
              <ShieldAlert size={28} />
            </div>
            <h2 className="heading-2">Tracking Permissions</h2>
            <p className="text-muted" style={{ marginTop: '0.5rem', lineHeight: '1.5' }}>
              You are about to start tracking for <strong>{project.name}</strong>. Please review exactly what data will be collected during this session.
            </p>
          </div>

          <div className="consent-body">
            <div className="consent-section">
              <h3 className="consent-section-title">Data Collected</h3>
              <div className="consent-list">
                <ConsentItem icon={<Eye size={20} />} title="Screenshots" desc="Up to 3 random captures every 10 minutes to verify work." />
                <ConsentItem icon={<MonitorPlay size={20} />} title="Active Application" desc="Names of the active window (e.g. Chrome, VS Code) in focus." />
                <ConsentItem icon={<MousePointerClick size={20} />} title="Activity Counts" desc="Number of mouse clicks and keystrokes (but NOT what was typed)." />
                <ConsentItem icon={<MapPin size={20} />} title="General Location" desc="Approximate IP-based location for security auditing." />
              </div>
            </div>

            <div className="consent-section" style={{ backgroundColor: '#fafbfd' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-tertiary)', lineHeight: '1.5', textAlign: 'center' }}>
                Activity data is transmitted securely and is only visible to your organization's administrators. You can stop tracking at any time.
              </p>
            </div>
          </div>

          <div className="consent-actions">
            <button onClick={onAccept} className="btn btn-primary" style={{ width: '100%', padding: '0.875rem' }}>
              I Understand &mdash; Start Tracking
            </button>
            <button onClick={onDecline} className="btn btn-secondary" style={{ width: '100%', padding: '0.875rem' }}>
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
      <div className="consent-item-text">
        <span className="consent-item-title">{title}</span>
        <span className="consent-item-desc">{desc}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Screen: Tracker
// ─────────────────────────────────────────────────────────────────────────────
function TrackerScreen({ user, project, isPaused = false, elapsed, onStop, onPause, onResume, todos, onTodoDone }: {
  user: User;
  project: Project;
  sessionId?: string | null;
  isPaused?: boolean;
  elapsed: number;
  onStop: () => void;
  onPause: () => void;
  onResume: () => void;
  todos: Todo[];
  onTodoDone: (id: string) => void;
}) {
  const hrs = Math.floor(elapsed / 3600);
  const mins = Math.floor((elapsed % 3600) / 60);
  const secs = elapsed % 60;
  const fmt = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="tracker-layout">
      <Topbar user={user} />

      <div className="tracker-content">
        <motion.div
          className="tracker-widget"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <div className={`status-pill ${isPaused ? 'status-paused' : 'status-live'}`}>
            <div className="status-dot"></div>
            {isPaused ? 'Timer Paused' : 'Tracking Live'}
          </div>

          <div className="tracker-project-info">
            <div className="color-dot" style={{ backgroundColor: project.color }}></div>
            <span className="tracker-project-name">{project.name}</span>
          </div>

          <div className={`timer-display ${isPaused ? 'timer-paused' : ''}`}>
            {fmt(hrs)}:{fmt(mins)}:{fmt(secs)}
          </div>

          <div className="timer-subtext">
            {isPaused
              ? "Your activity is not currently being recorded."
              : "Screenshots and activity metrics are being securely recorded."}
          </div>

          <div className="tracker-controls">
            {isPaused ? (
              <button className="control-btn active-resume" onClick={onResume}>
                <Play className="control-icon" fill="currentColor" />
                Resume Work
              </button>
            ) : (
              <button className="control-btn active-pause" onClick={onPause}>
                <Pause className="control-icon" fill="currentColor" />
                Take a Break
              </button>
            )}

            <button className="control-btn action-stop" onClick={onStop}>
              <Square className="control-icon" fill="currentColor" />
              Stop & Exit
            </button>
          </div>
        </motion.div>
      </div>

      <MyTasksPanel todos={todos} onDone={onTodoDone} />
    </div>
  );
}
