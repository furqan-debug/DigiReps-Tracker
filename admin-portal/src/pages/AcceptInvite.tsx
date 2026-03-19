import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Phone, Lock, Eye, EyeOff, AlertCircle, Rocket, Download, LayoutDashboard, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

type Step = 'loading' | 'form' | 'success' | 'error';

export function AcceptInvite() {
    const navigate = useNavigate();
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

    // Supabase session
    const [userId, setUserId] = useState<string | null>(null);
    const [role, setRole] = useState<string>('User');

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' || event === 'PASSWORD_RECOVERY') {
                if (session) {
                    setUserId(session.user.id);
                    setStep('form');
                }
            } else if (event === 'INITIAL_SESSION' && session) {
                setUserId(session.user.id);
                setStep('form');
            } else if (!session && step === 'loading') {
                setTimeout(async () => {
                    const { data: { session: s } } = await supabase.auth.getSession();
                    if (s) {
                        setUserId(s.user.id);
                        setStep('form');
                    } else {
                        setErrorMsg('This invite link is invalid or has expired. Please ask your admin to resend the invite.');
                        setStep('error');
                    }
                }, 500);
            }
        });
        return () => subscription.unsubscribe();
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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expired. Please use the invite link again.');

            const { error: pwError } = await supabase.auth.updateUser({ password });
            if (pwError) throw new Error(pwError.message);

            const res = await fetch('/api/complete-setup', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim() || null }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to complete setup.');

            if (data.member?.role) {
                setRole(data.member.role);
            }
            setStep('success');
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    if (step === 'loading') {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-gradient-mesh z-0" />
                <div className="flex flex-col items-center gap-4 text-text-secondary">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-sm font-bold tracking-widest uppercase opacity-60">Verifying invite...</p>
                </div>
            </div>
        );
    }

    if (step === 'error') {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-gradient-mesh z-0" />
                <div className="relative z-10 w-full max-w-[440px] text-center">
                    <Card className="p-10 shadow-2xl space-y-6">
                        <div className="w-20 h-20 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                            <AlertCircle className="w-10 h-10 text-rose-400" />
                        </div>
                        <div className="space-y-2">
                            <h1 className="text-2xl font-bold text-text-primary font-head">Invite unavailable</h1>
                            <p className="text-sm text-text-secondary leading-relaxed">{errorMsg}</p>
                        </div>
                        <Button
                            className="w-full"
                            onClick={() => navigate('/')}
                        >
                            Back to home
                        </Button>
                    </Card>
                </div>
            </div>
        );
    }

    if (step === 'success') {
        return (
            <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
                <div className="absolute inset-0 bg-gradient-mesh z-0" />
                <div className="relative z-10 w-full max-w-[560px]">
                    <Card className="overflow-hidden border-none shadow-2xl">
                        <div className="bg-gradient-to-br from-indigo-600 to-violet-700 px-8 py-12 text-center text-white relative overflow-hidden">
                            <div className="absolute inset-0 bg-black/10" />
                            <div className="relative z-10">
                                <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl border border-white/20">
                                    <Rocket className="w-10 h-10" />
                                </div>
                                <h1 className="text-4xl font-bold tracking-tight mb-2 font-head">Account Activated!</h1>
                                <p className="text-indigo-100 font-medium">Welcome to the team, {fullName.split(' ')[0]}!</p>
                            </div>
                        </div>

                        <div className="p-10 space-y-10">
                            {role === 'User' ? (
                                <div className="space-y-8">
                                    <div className="space-y-4 text-center">
                                        <h2 className="text-xl font-bold text-text-primary font-head uppercase tracking-wider">Next Steps</h2>
                                        <div className="grid gap-4 text-left">
                                            {[
                                                { icon: <Download className="w-5 h-5" />, title: 'Download Tracker', desc: 'Install the Trackora app to begin tracking your work.' },
                                                { icon: <User className="w-5 h-5" />, title: 'Sign In', desc: 'Use your work email and the new password to log in.' },
                                                { icon: <Rocket className="w-5 h-5" />, title: 'Start Working', desc: 'Select your project and click "Start" to begin your shift.' },
                                            ].map((step, i) => (
                                                <div key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors">
                                                    <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0 border border-indigo-500/20">
                                                        {step.icon}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-text-primary text-sm">{step.title}</p>
                                                        <p className="text-xs text-text-secondary">{step.desc}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <Button className="w-full py-4 text-base" leftIcon={<Download className="w-5 h-5" />}>
                                        Download Tracker App
                                    </Button>
                                </div>
                            ) : (
                                <div className="space-y-6 text-center">
                                    <div className="space-y-3">
                                        <h2 className="text-xl font-bold text-text-primary font-head uppercase tracking-wider">Manager Access</h2>
                                        <p className="text-sm text-text-secondary leading-relaxed max-w-sm mx-auto">
                                            As a <span className="text-indigo-400 font-bold">{role}</span>, you have full access to manage teams, review activity, and view reports.
                                        </p>
                                    </div>
                                    <Button 
                                        className="w-full py-4" 
                                        onClick={() => navigate('/login')}
                                        leftIcon={<LayoutDashboard className="w-5 h-5" />}
                                    >
                                        Go to Admin Dashboard
                                    </Button>
                                </div>
                            )}

                            <div className="pt-8 border-t border-border text-center">
                                <p className="text-[11px] text-text-muted font-medium uppercase tracking-widest">
                                    Need help? Contact support@trackora.ai
                                </p>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gradient-mesh z-0" />
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full z-0" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-violet-600/10 blur-[120px] rounded-full z-0" />
            
            <div className="relative z-10 w-full max-w-[480px]">
                <div className="mb-8 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-6">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                             <div className="w-2.5 h-2.5 border-2 border-white rounded-[1px] rotate-45" />
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary">Trackora Invitation</span>
                    </div>
                    
                    <h1 className="text-3xl font-bold tracking-tight text-text-primary mb-3 font-head">
                        Welcome to the team
                    </h1>
                    <p className="text-sm text-text-secondary font-medium">
                        Set up your professional profile to get started
                    </p>
                </div>

                <Card className="p-8 shadow-2xl">
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Input
                            label="Full Name"
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Taylor Reid"
                            leftIcon={<User className="w-4 h-4 text-text-muted" />}
                        />

                        <Input
                            label="Phone Number"
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+1 (555) 000-0000"
                            leftIcon={<Phone className="w-4 h-4 text-text-muted" />}
                        />

                        <div className="space-y-1.5 border-t border-border pt-5 mt-5">
                            <label className="text-xs font-bold text-text-secondary uppercase tracking-wider opacity-80 pl-0.5">Secure Password</label>
                            <div className="relative">
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                                    className="pr-10"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors mt-3"
                                >
                                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>
                        </div>

                        <Input
                            label="Confirm Password"
                            type={showPw ? 'text' : 'password'}
                            required
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            leftIcon={<Lock className="w-4 h-4 text-text-muted" />}
                            error={confirmPassword && password !== confirmPassword ? "Passwords don't match" : undefined}
                        />

                        {formError && (
                            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>{formError}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting || !fullName.trim() || password.length < 8 || password !== confirmPassword}
                            className="w-full py-4"
                            rightIcon={!submitting && <ArrowRight className="w-4 h-4" />}
                        >
                            {submitting ? 'Activating account...' : 'Activate Account'}
                        </Button>
                    </form>
                </Card>

                <p className="mt-8 text-center text-[11px] text-text-muted font-medium px-4 leading-relaxed">
                    By activating, you agree to your organization's data policies and Trackora's <a href="#" className="underline">Terms of Service</a>.
                </p>
            </div>
        </div>
    );
}
