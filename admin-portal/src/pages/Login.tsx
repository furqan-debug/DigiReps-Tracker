import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export function Login() {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) navigate('/dashboard', { replace: true });
        });
    }, [navigate]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Immediately check for a professional role in the members table
            const { data: member, error: dbError } = await supabase
                .from('members')
                .select('role')
                .eq('email', email)
                .single();

            if (dbError || !member) {
                // If no member record exists, they might be an invited user who hasn't accepted yet
                // or just doesn't belong here. For now, we allow them to go to dashboard which 
                // will handle the state (like Onboarding) but if they are definitely not an admin/manager/viewer
                // and they are on the ADMIN portal, we might want to warn them.
                navigate('/dashboard', { replace: true });
            } else {
                // Roles like 'Admin', 'Manager', 'Viewer' are all welcome in the Admin Portal.
                // Each will see limited options via the Sidebar logic.
                navigate('/dashboard', { replace: true });
            }
        } catch (err: any) {
            setError(err.message || 'Failed to sign in. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-gradient-mesh z-0" />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full z-0" />
            
            <div className="relative z-10 w-full max-w-[440px]">
                <div className="mb-8 text-center">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass hover:bg-white/5 transition-colors mb-6"
                    >
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                             <div className="w-2.5 h-2.5 border-2 border-white rounded-[1px] rotate-45" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">Trackora Admin</span>
                    </button>
                    
                    <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3 font-head">
                        Welcome back
                    </h1>
                                At a glance
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">Dashboard, activity, and payroll in one place.</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                Switch between timesheets, reports, and teams without losing context.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                For admins & managers
                            </p>
                            <p className="mt-2 text-sm font-semibold text-slate-900">Role‑aware access out of the box.</p>
                            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                                Your permissions and views are tailored to your role in Trackora.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Form */}
                <section className="md:w-[380px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900">
                            Sign in
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            Enter your work email and password to access the admin portal.
                        </p>

                        <form onSubmit={handleLogin} className="mt-6 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="email"
                                        required
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="you@company.com"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900/60"
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="mb-1.5 flex items-center justify-between">
                                    <label className="block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => navigate('/forgot-password')}
                                        className="text-[11px] font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
                                    >
                                        Forgot?
                                    </button>
                                </div>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2.5 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900/60"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPw(!showPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                                    >
                                        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] text-rose-700">
                                    <AlertCircle className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                                    <p>{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className="mt-2 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? 'Signing in…' : 'Sign in'}
                            </button>
                        </form>

                        <p className="mt-4 text-[11px] text-slate-500">
                            New to Trackora?{' '}
                            <button
                                type="button"
                                onClick={() => navigate('/signup')}
                                className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                            >
                                Create an account
                            </button>
                        </p>
                    </div>

                    <p className="mt-4 text-[11px] text-slate-400">
                        For security, make sure you&apos;re signing in on the official Trackora domain.
                    </p>
                </section>
            </div>
        </div>
    );
}
