import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Mail, Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

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
                // Member row creation is now handled automatically by a Postgres Trigger in Supabase
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
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-8">
            {/* Background Elements */}
            <div className="absolute inset-0 bg-gradient-mesh opacity-40 z-0" />
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-primary/5 blur-[160px] rounded-full z-0 animate-pulse" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-violet-500/5 blur-[160px] rounded-full z-0 animate-pulse" style={{ animationDelay: '2s' }} />
            
            <div className="relative z-10 w-full max-w-[480px]">
                <div className="mb-12 text-center">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="inline-flex items-center gap-4 px-5 py-2.5 rounded-[24px] bg-white border border-black/[0.05] shadow-xl hover:shadow-2xl hover:scale-105 transition-all mb-10 group"
                    >
                        <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20 group-hover:rotate-12 transition-transform">
                             <div className="w-4 h-4 border-4 border-white rounded-[2px] rotate-45" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-text-primary font-mono italic">Trackora Workspace</span>
                    </button>
                    
                    <h1 className="text-5xl font-black tracking-tight text-text-primary mb-5 uppercase italic leading-none">
                        Initialize <span className="text-primary underline underline-offset-8 decoration-primary/20">Credential</span>
                    </h1>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed opacity-60">
                        Start your 14-day elite trial on the <span className="text-primary font-black underline underline-offset-4 decoration-primary/30">{selectedPlan}</span> protocol
                    </p>
                </div>

                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px]">
                    <form onSubmit={handleSignup} className="space-y-8">
                        <Input
                            label="Operative Full Name"
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Taylor Reid"
                            leftIcon={<User className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                        />

                        <Input
                            label="Verification Email"
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="you@company.com"
                            leftIcon={<Mail className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                        />

                        <div className="space-y-4">
                            <label className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono opacity-60 pl-1 italic">Security Sequence</label>
                            <div className="relative">
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="At least 8 characters"
                                    leftIcon={<Lock className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                                    className="pr-14"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPw(!showPw)}
                                    className="absolute right-5 top-1/2 -translate-y-1/2 text-text-muted hover:text-primary transition-all mt-4"
                                >
                                    {showPw ? <EyeOff className="w-5 h-5" strokeWidth={2.5} /> : <Eye className="w-5 h-5" strokeWidth={2.5} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-4 p-5 rounded-[28px] bg-rose-500/[0.05] border border-rose-500/10 text-rose-600 text-xs font-black uppercase tracking-wider font-mono">
                                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" strokeWidth={3} />
                                <p>{error}</p>
                            </div>
                        )}

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full py-5 rounded-[28px] text-[12px] font-black uppercase tracking-[0.4em] shadow-xl hover:shadow-primary/30 active:scale-95 transition-all"
                            rightIcon={!loading && <ArrowRight className="w-5 h-5 stroke-[3]" />}
                        >
                            {loading ? 'CALIBRATING...' : 'ESTABLISH'}
                        </Button>
                    </form>

                    <p className="mt-8 text-[10px] font-black text-text-muted text-center uppercase tracking-widest font-mono opacity-40 leading-relaxed italic">
                        By initializing, you agree to our <a href="#" className="text-primary hover:underline underline-offset-4">Protocols</a> and <a href="#" className="text-primary hover:underline underline-offset-4">Privacy Core</a>.
                    </p>

                    <div className="mt-12 pt-10 border-t border-black/[0.03] flex flex-col items-center gap-6 text-center">
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono opacity-50 italic">
                            Already Authenticated?
                        </p>
                        <button 
                            onClick={() => navigate('/login')}
                            className="w-full py-5 rounded-[28px] border border-black/[0.1] text-text-primary text-[11px] font-black uppercase tracking-[0.3em] font-mono hover:bg-black/[0.02] hover:border-black/[0.2] transition-all active:scale-95 shadow-sm"
                        >
                            Sign in Instead
                        </button>
                    </div>
                </Card>

                <div className="mt-12 flex flex-wrap justify-center gap-x-12 gap-y-6 px-4">
                    <div className="flex items-center gap-3 group">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/20 group-hover:scale-150 transition-all" />
                        <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono italic opacity-60">No Card Required</span>
                    </div>
                    <div className="flex items-center gap-3 group">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/20 group-hover:scale-150 transition-all" />
                        <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono italic opacity-60">Cancel Anytime</span>
                    </div>
                    <div className="flex items-center gap-3 group">
                        <div className="w-2 h-2 rounded-full bg-primary shadow-lg shadow-primary/20 group-hover:scale-150 transition-all" />
                        <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono italic opacity-60">Cloud Sync</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
