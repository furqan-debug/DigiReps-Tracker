import { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

export function Signup() {
    const navigate = useNavigate();
    const location = useLocation();
    const selectedPlan = location.state?.plan || 'Starter';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Sign up user in Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: fullName,
                    }
                }
            });

            if (authError) throw authError;

            if (authData.user) {
                // 2. detecting if user was already invited (pre-registered in members)
                const { data: existingMember } = await supabase
                    .from('members')
                    .select('id, role')
                    .eq('email', email)
                    .single();

                const { error: profileError } = await supabase
                    .from('members')
                    .upsert({
                        id: existingMember ? existingMember.id : authData.user.id,
                        email,
                        full_name: fullName,
                        role: 'Admin', // Purchasers through pricing/plan always get Admin access
                        status: 'Pending'
                    });

                if (profileError) {
                    console.error('Profile update error:', profileError);
                }

                // 3. Move to onboarding
                navigate('/onboarding', { state: { plan: selectedPlan } });
            }
        } catch (err: any) {
            setError(err.message || 'Signup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-stretch justify-center gap-10 px-4 py-8 md:flex-row md:items-center md:px-6 lg:py-16">
                {/* Left: brand & reassurance */}
                <section className="md:w-1/2">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-2.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500"
                    >
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-[10px] font-semibold text-white">
                            DR
                        </div>
                        <span>Trackora workspace setup</span>
                    </button>

                    <h1 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900 sm:text-[2.15rem]">
                        Create your Trackora admin account.
                    </h1>
                    <p className="mt-3 max-w-md text-sm leading-relaxed text-slate-600">
                        You&apos;ll use this account to invite reps, configure tracking policies, and access reports across your organization.
                    </p>

                    <div className="mt-6 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 pr-4 text-[11px] text-slate-600">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                            14d
                        </div>
                        <div className="flex flex-col">
                            <span className="font-semibold text-slate-900">
                                {selectedPlan} plan · 14‑day free trial
                            </span>
                            <span className="text-[11px] text-slate-500">
                                No card required to get started. Change plans any time from billing.
                            </span>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-3 text-[11px] text-slate-500 sm:grid-cols-2">
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                What you get
                            </p>
                            <p className="mt-2 text-xs text-slate-600">
                                Access to the full admin portal, time tracking, and analytics for your team.
                            </p>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                After signup
                            </p>
                            <p className="mt-2 text-xs text-slate-600">
                                A short onboarding flow will help you set up your organization and invite reps.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Right: form */}
                <section className="md:w-[380px]">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <h2 className="text-base font-semibold tracking-tight text-slate-900">
                            Create your account
                        </h2>
                        <p className="mt-1 text-xs text-slate-500">
                            We’ll use these details to personalize your Trackora workspace.
                        </p>

                        <form onSubmit={handleSignup} className="mt-6 space-y-4">
                            <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Full name
                                </label>
                                <div className="relative">
                                    <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        placeholder="Taylor Reid"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-9 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none ring-0 transition focus:border-slate-900 focus:bg-white focus:ring-1 focus:ring-slate-900/60"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Work email
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
                                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                                    Password
                                </label>
                                <div className="relative">
                                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                                    <input
                                        type={showPw ? 'text' : 'password'}
                                        required
                                        value={password}
                                        onChange={e => setPassword(e.target.value)}
                                        placeholder="At least 8 characters"
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
                                <p className="mt-1 text-[11px] text-slate-500">
                                    You&apos;ll use this email and password to sign in to the admin portal.
                                </p>
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
                                className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? 'Creating account…' : 'Continue to onboarding'}
                                {!loading && <ArrowRight className="h-4 w-4" />}
                            </button>
                        </form>

                        <p className="mt-4 text-[11px] text-slate-500">
                            By signing up, you agree to our{' '}
                            <a href="#" className="underline underline-offset-2 hover:text-slate-900">
                                Terms
                            </a>{' '}
                            and{' '}
                            <a href="#" className="underline underline-offset-2 hover:text-slate-900">
                                Privacy Policy
                            </a>.
                        </p>

                        <p className="mt-3 text-[11px] text-slate-500">
                            Already have an account?{' '}
                            <Link
                                to="/login"
                                className="font-semibold text-slate-900 underline-offset-2 hover:underline"
                            >
                                Sign in
                            </Link>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
