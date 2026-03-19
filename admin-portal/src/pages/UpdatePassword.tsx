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
            <div className="flex flex-col items-center gap-6 text-text-primary">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                <p className="text-[11px] font-black tracking-[0.4em] uppercase opacity-40 font-mono animate-pulse">Synchronizing Security Matrix...</p>
            </div>
        </div>
        );
    }

    if (step === 'error') {
        return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="relative z-10 w-full max-w-[480px] text-center">
                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px] space-y-10">
                    <div className="w-24 h-24 bg-rose-500/[0.05] border border-rose-500/10 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-rose-500/10 rotate-3">
                        <AlertCircle className="w-12 h-12 text-rose-500" strokeWidth={3} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-text-primary uppercase italic tracking-tight">Sequence Expired</h1>
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-relaxed opacity-60">{errorMsg}</p>
                    </div>
                    <button
                        className="w-full py-5 rounded-[28px] bg-primary text-white text-[12px] font-black uppercase tracking-[0.4em] shadow-xl hover:shadow-primary/30 active:scale-95 transition-all"
                        onClick={() => navigate('/forgot-password')}
                    >
                        Request New Sequence
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
                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px] space-y-10">
                    <div className="w-24 h-24 bg-primary/[0.05] border border-primary/10 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-primary/10 rotate-3 animate-in zoom-in duration-700">
                        <CheckCircle2 className="w-12 h-12 text-primary" strokeWidth={3} />
                    </div>
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-text-primary uppercase italic tracking-tight">Access Restored</h1>
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-relaxed opacity-60">
                            Your security credentials have been successfully updated. Your account is now fortified.
                        </p>
                    </div>
                    <button
                        className="w-full py-5 rounded-[28px] bg-primary text-white text-[12px] font-black uppercase tracking-[0.4em] shadow-xl hover:shadow-primary/30 active:scale-95 transition-all"
                        onClick={() => navigate('/login')}
                    >
                        Authorize Login
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
                    <div className="inline-flex items-center gap-4 px-5 py-2.5 rounded-[24px] bg-white border border-black/[0.05] shadow-xl mb-10 group">
                        <ShieldCheck className="w-5 h-5 text-primary group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-text-primary font-mono italic">Security Protocol</span>
                    </div>
                    
                    <h1 className="text-5xl font-black tracking-tight text-text-primary mb-5 uppercase italic leading-none">
                        New <span className="text-primary underline underline-offset-8 decoration-primary/20">Identity</span>
                    </h1>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed opacity-60">
                        Establish a high-entropy security key
                    </p>
                </div>

                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px]">
                    <form onSubmit={handleSubmit} className="space-y-10">
                        <div className="relative">
                            <Input
                                label="Primary Key (New Password)"
                                type={showPw ? 'text' : 'password'}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="••••••••"
                                required
                                autoFocus
                                leftIcon={<Lock className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPw(!showPw)}
                                className="absolute right-5 top-[52px] text-text-muted hover:text-primary transition-all"
                            >
                                {showPw ? <EyeOff className="w-5 h-5" strokeWidth={2.5} /> : <Eye className="w-5 h-5" strokeWidth={2.5} />}
                            </button>
                        </div>

                        <Input
                            label="Verification Sequence (Confirm)"
                            type={showPw ? 'text' : 'password'}
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            placeholder="Repeat password"
                            required
                            leftIcon={<Lock className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                            error={confirmPassword && password !== confirmPassword ? "Sequences do not match" : undefined}
                        />

                        {formError && (
                            <div className="p-5 rounded-[28px] bg-rose-500/[0.05] border border-rose-500/10 text-rose-600 text-xs font-black uppercase tracking-wider font-mono">
                                {formError}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting || password.length < 8 || password !== confirmPassword}
                            className="w-full py-5 rounded-[28px] text-[12px] font-black uppercase tracking-[0.4em] shadow-xl hover:shadow-primary/30 active:scale-95 transition-all"
                            rightIcon={!submitting && <ArrowRight className="w-5 h-5 stroke-[3]" />}
                        >
                            {submitting ? 'ENCRYPTING...' : 'FINALIZE KEY'}
                        </Button>
                    </form>
                </Card>
            </div>
        </div>
    );
}
