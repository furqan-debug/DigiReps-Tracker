import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

type Step = 'loading' | 'form' | 'success' | 'error';

export function UpdatePassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('loading');
    const [errorMsg, setErrorMsg] = useState('');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (error || !session) {
                setErrorMsg(
                    error?.message ||
                    'This reset link is invalid or has expired. Please request a new one.'
                );
                setStep('error');
                return;
            }
            setStep('form');
        });
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);

        if (password.length < 8) return setFormError('Password must be at least 8 characters.');
        if (password !== confirmPassword) return setFormError('Passwords do not match.');

        setSubmitting(true);
        try {
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw new Error(error.message);
            setStep('success');
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    if (step === 'loading') {
        return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="flex flex-col items-center gap-6 text-text-primary animate-in fade-in duration-700">
                <div className="w-12 h-12 border-4 border-primary/10 border-t-primary rounded-full animate-spin" />
                <p className="text-[11px] font-bold tracking-[0.3em] uppercase opacity-40 font-mono">Verifying recovery link...</p>
            </div>
        </div>
        );
    }

    if (step === 'error') {
        return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="relative z-10 w-full max-w-[480px] text-center">
                <Card className="p-12 shadow-glow bg-white/60 backdrop-blur-3xl border-black/[0.02] rounded-[56px] space-y-10 animate-in stagger-1">
                    <div className="w-24 h-24 bg-rose-500/[0.03] border border-rose-500/10 rounded-[40px] flex items-center justify-center mx-auto shadow-glow rotate-3">
                        <AlertCircle className="w-12 h-12 text-rose-500" strokeWidth={2} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-extrabold text-text-primary tracking-tight">Link Expired</h1>
                        <p className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.2em] font-mono leading-relaxed opacity-50">{errorMsg}</p>
                    </div>
                    <button
                        className="w-full py-5 rounded-[24px] bg-primary text-white text-[12px] font-bold uppercase tracking-[0.3em] shadow-glow-primary hover:scale-[1.02] active:scale-95 transition-all"
                        onClick={() => navigate('/forgot-password')}
                    >
                        Request New Link
                    </button>
                </Card>
            </div>
        </div>
        );
    }

    if (step === 'success') {
        return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="relative z-10 w-full max-w-[480px] text-center">
                <Card className="p-12 shadow-glow bg-white/60 backdrop-blur-3xl border-black/[0.02] rounded-[56px] space-y-10 animate-in stagger-1">
                    <div className="w-24 h-24 bg-primary/[0.03] border border-primary/10 rounded-[40px] flex items-center justify-center mx-auto shadow-glow rotate-3">
                        <CheckCircle2 className="w-12 h-12 text-primary" strokeWidth={2} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-extrabold text-text-primary tracking-tight">Password Updated</h1>
                        <p className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.2em] font-mono leading-relaxed opacity-50">
                            Your security credentials have been successfully updated. Your account is now secure.
                        </p>
                    </div>
                    <button
                        className="w-full py-5 rounded-[24px] bg-primary text-white text-[12px] font-bold uppercase tracking-[0.3em] shadow-glow-primary hover:scale-[1.02] active:scale-95 transition-all"
                        onClick={() => navigate('/login')}
                    >
                        Back to Login
                    </button>
                </Card>
            </div>
        </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[160px] rounded-full z-0 animate-pulse" />
            
            <div className="relative z-10 w-full max-w-[480px]">
                <div className="mb-12 text-center">
                    <div className="inline-flex items-center gap-4 px-6 py-2.5 rounded-[24px] bg-white border border-black/[0.05] shadow-glow mb-10 group">
                        <ShieldCheck className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={2} />
                        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-primary font-mono">Security Settings</span>
                    </div>
                    
                    <h1 className="text-5xl font-extrabold tracking-tighter text-text-primary mb-6">
                        New <span className="text-primary">Password</span>
                    </h1>
                    <p className="text-[11px] font-bold text-text-secondary uppercase tracking-[0.3em] font-mono leading-relaxed opacity-50">
                        Choose a strong password for your account
                    </p>
                </div>

                <Card className="p-12 shadow-glow bg-white/60 backdrop-blur-3xl border-black/[0.02] rounded-[56px] animate-in stagger-1">
                    <form onSubmit={handleSubmit} className="space-y-10">
                        <div className="relative">
                            <Input
                                label="New Password"
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoFocus
                                leftIcon={<Lock className="w-5 h-5 text-primary" strokeWidth={2} />}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-6 top-[52px] text-text-muted hover:text-primary transition-all"
                            >
                                {showPw ? <EyeOff className="w-5 h-5" strokeWidth={2} /> : <Eye className="w-5 h-5" strokeWidth={2} />}
                            </button>
                        </div>

                        <Input
                            label="Confirm Password"
                            type={showPw ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            required
                            leftIcon={<Lock className="w-5 h-5 text-primary" strokeWidth={2} />}
                            error={confirmPassword && password !== confirmPassword ? "Passwords do not match" : undefined}
                        />

                        {formError && (
                            <div className="p-5 rounded-[24px] bg-rose-500/[0.03] border border-rose-500/10 text-rose-600 text-xs font-bold uppercase tracking-wider font-mono">
                                {formError}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting || password.length < 8 || password !== confirmPassword}
                            className="w-full py-5 rounded-[24px] text-[12px] font-bold uppercase tracking-[0.3em] shadow-glow-primary hover:scale-[1.02] active:scale-95 transition-all"
                            rightIcon={!submitting && <ArrowRight className="w-5 h-5 stroke-[2]" />}
                        >
                            {submitting ? 'Updating...' : 'Update Password'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
