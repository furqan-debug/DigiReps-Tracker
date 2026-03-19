import { useState } from 'react';
import { Mail, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useNavigate } from 'react-router-dom';

type Step = 'form' | 'sent';

export function ForgotPassword() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>('form');
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError(null);
        if (!email.trim()) return;

        setSubmitting(true);
        try {
            const redirectTo = `${window.location.origin}/update-password`;
            const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
            if (error) throw new Error(error.message);
            setStep('sent');
        } catch (err: any) {
            setFormError(err.message);
        } finally {
            setSubmitting(false);
        }
    }

    if (step === 'sent') {
        return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[160px] rounded-full z-0 animate-pulse" />
            
            <div className="relative z-10 w-full max-w-[480px] text-center">
                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px] space-y-10">
                    <div className="w-24 h-24 bg-primary/[0.05] border border-primary/10 rounded-[32px] flex items-center justify-center mx-auto shadow-xl shadow-primary/10 rotate-3 animate-in zoom-in duration-700">
                        <CheckCircle2 className="w-12 h-12 text-primary" strokeWidth={3} />
                    </div>
                    
                    <div className="space-y-4">
                        <h1 className="text-4xl font-black text-text-primary uppercase italic tracking-tight">Signal Sent</h1>
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-relaxed opacity-60">
                            A recovery link has been dispatched to<br/>
                            <span className="text-primary underline underline-offset-4 decoration-primary/30">{email}</span>
                        </p>
                    </div>

                    <div className="pt-10 border-t border-black/[0.03]">
                        <p className="text-[10px] font-black text-text-muted mb-8 uppercase tracking-[0.2em] font-mono opacity-40 italic">
                            No signal received? Check your archives or try an alternative identifier.
                        </p>
                        <button
                            className="w-full py-5 rounded-[28px] border border-black/[0.1] text-text-primary text-[11px] font-black uppercase tracking-[0.3em] font-mono hover:bg-black/[0.02] hover:border-black/[0.2] transition-all active:scale-95 shadow-sm"
                            onClick={() => { setStep('form'); setFormError(null); }}
                        >
                            Try Alternative Email
                        </button>
                    </div>
                </Card>
                
                <button
                    onClick={() => navigate('/login')}
                    className="mt-12 inline-flex items-center gap-4 text-[11px] font-black text-text-muted hover:text-primary transition-all tracking-[0.3em] uppercase font-mono group"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" strokeWidth={3} />
                    Return to Login
                </button>
            </div>
        </div>
        );
    }

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-500/5 blur-[160px] rounded-full z-0 animate-pulse" />
            
            <div className="relative z-10 w-full max-w-[480px]">
                <div className="mb-12 text-center">
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="inline-flex items-center gap-4 px-5 py-2.5 rounded-[24px] bg-white border border-black/[0.05] shadow-xl hover:shadow-2xl hover:scale-105 transition-all mb-10 group"
                    >
                        <ArrowLeft className="w-4 h-4 text-primary group-hover:-translate-x-1 transition-transform" strokeWidth={3} />
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-text-primary font-mono italic">Back to Matrix</span>
                    </button>
                    
                    <h1 className="text-5xl font-black tracking-tight text-text-primary mb-5 uppercase italic leading-none">
                        Key <span className="text-primary underline underline-offset-8 decoration-primary/20">Recovery</span>
                    </h1>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed opacity-60">
                        Initiate authorization bypass sequence
                    </p>
                </div>

                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px]">
                    <form onSubmit={handleSubmit} className="space-y-10">
                        <Input
                            label="Identification Email"
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="agent@trackora.ai"
                            leftIcon={<Mail className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                            autoFocus
                        />

                        {formError && (
                            <div className="p-5 rounded-[28px] bg-rose-500/[0.05] border border-rose-500/10 text-rose-600 text-xs font-black uppercase tracking-wider font-mono">
                                {formError}
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={submitting || !email.trim()}
                            className="w-full py-5 rounded-[28px] text-[12px] font-black uppercase tracking-[0.4em] shadow-xl hover:shadow-primary/30 active:scale-95 transition-all"
                            rightIcon={!submitting && <ArrowRight className="w-5 h-5 stroke-[3]" />}
                        >
                            {submitting ? 'DISPATCHING...' : 'SEND RECOVERY'}
                        </Button>
                    </form>
                </Card>
                
                <p className="mt-12 text-center text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono px-8 leading-relaxed opacity-40 italic">
                    Security protocols active. Dispatched links expire in 60 minutes for protocol integrity.
                </p>
            </div>
        </div>
    );
}
