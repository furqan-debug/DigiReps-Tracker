import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

type Step = 'loading' | 'form' | 'success' | 'error';

export function AcceptInvite() {
    const [step, setStep] = useState<Step>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    // Form fields
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Supabase session (set from the invite link's access_token in the URL hash)
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        // Supabase puts the session in the URL hash after the user clicks the invite link.
        // Calling getSession() picks it up automatically from the hash.
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error || !session) {
                setErrorMsg(
                    error?.message ||
                    'This invite link is invalid or has expired. Please ask your admin to resend the invite.'
                );
                setStep('error');
                return;
            }
            setUserId(session.user.id);
            setStep('form');
        });
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);

        if (!fullName.trim()) return setFormError('Full name is required.');
        if (password.length < 8) return setFormError('Password must be at least 8 characters.');
        if (password !== confirmPassword) return setFormError('Passwords do not match.');
        if (!userId) return setFormError('Session expired. Please use the invite link again.');

        setSubmitting(true);
        try {
            // 1. Update password in Supabase Auth
            const { error: pwError } = await supabase.auth.updateUser({ password });
            if (pwError) throw new Error(pwError.message);

            // 2. Complete member profile via backend
            const res = await fetch(`${API}/api/members/complete-setup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auth_user_id: userId, full_name: fullName.trim(), phone: phone.trim() || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to complete setup.');

            setStep('success');
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    // ── Loading ──────────────────────────────────────────────────────────────
    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-white/60">
                    <div className="w-8 h-8 border-2 border-white/20 border-t-white/70 rounded-full animate-spin" />
                    <p className="text-sm">Verifying your invite link…</p>
                </div>
            </div>
        );
    }

    // ── Error ────────────────────────────────────────────────────────────────
    if (step === 'error') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 text-center">
                    <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <h1 className="text-xl font-bold text-slate-900 mb-2">Invite link invalid</h1>
                    <p className="text-sm text-slate-500">{errorMsg}</p>
                </div>
            </div>
        );
    }

    // ── Success ──────────────────────────────────────────────────────────────
    if (step === 'success') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                    <div className="bg-emerald-50 px-8 py-8 flex flex-col items-center text-center gap-3">
                        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center">
                            <span className="text-3xl">✅</span>
                        </div>
                        <h1 className="text-2xl font-bold text-emerald-900">You're all set!</h1>
                        <p className="text-sm text-emerald-700">Your account has been activated successfully.</p>
                    </div>
                    <div className="px-8 py-6 space-y-3 text-sm text-slate-600">
                        <p className="font-semibold text-slate-800">Next steps:</p>
                        <ol className="list-decimal list-inside space-y-1.5">
                            <li>Download and open the <strong>DigiReps Tracker</strong> app</li>
                            <li>Sign in with your email and the password you just set</li>
                            <li>Start tracking — your admin has already assigned your projects</li>
                        </ol>
                    </div>
                </div>
            </div>
        );
    }

    // ── Setup Form ───────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
            {/* Logo / Brand */}
            <div className="w-full max-w-md space-y-6">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2.5 mb-4">
                        <div className="w-9 h-9 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                            <span className="text-white font-bold text-lg">D</span>
                        </div>
                        <span className="text-white text-xl font-bold tracking-tight">DigiReps</span>
                    </div>
                    <h1 className="text-2xl font-bold text-white">Welcome to DigiReps</h1>
                    <p className="text-blue-200/70 text-sm mt-1">Set up your account to get started</p>
                </div>

                <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl">
                    {/* Full Name */}
                    <div>
                        <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wide mb-1.5">
                            Full Name *
                        </label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Jane Smith"
                            required
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                    </div>

                    {/* Phone (optional) */}
                    <div>
                        <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wide mb-1.5">
                            Phone <span className="text-white/30 normal-case font-normal">(optional)</span>
                        </label>
                        <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+1 555 000 0000"
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                    </div>

                    {/* Password */}
                    <div>
                        <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wide mb-1.5">
                            Password *
                        </label>
                        <div className="relative">
                            <input
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Min. 8 characters"
                                required
                                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                            />
                            <button type="button" onClick={() => setShowPw(p => !p)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 text-xs">
                                {showPw ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        {password.length > 0 && password.length < 8 && (
                            <p className="text-xs text-amber-400 mt-1">At least 8 characters required</p>
                        )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label className="block text-xs font-semibold text-blue-200/80 uppercase tracking-wide mb-1.5">
                            Confirm Password *
                        </label>
                        <input
                            type={showPw ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat your password"
                            required
                            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                        />
                        {confirmPassword.length > 0 && password !== confirmPassword && (
                            <p className="text-xs text-rose-400 mt-1">Passwords don't match</p>
                        )}
                    </div>

                    {/* Form error */}
                    {formError && (
                        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-4 py-2.5 rounded-xl">
                            {formError}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={submitting || !fullName.trim() || password.length < 8 || password !== confirmPassword}
                        className="w-full bg-blue-500 hover:bg-blue-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-lg shadow-blue-500/25 mt-2"
                    >
                        {submitting ? 'Activating account…' : 'Activate Account'}
                    </button>
                </form>

                <p className="text-center text-xs text-white/30">
                    Having issues? Contact your administrator.
                </p>
            </div>
        </div>
    );
}
