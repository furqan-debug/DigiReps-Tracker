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
                        <span className="text-[11px] font-black uppercase tracking-[0.3em] text-text-primary font-mono italic">Trackora Intelligence</span>
                    </button>
                    
                    <h1 className="text-5xl font-black tracking-tight text-text-primary mb-5 uppercase italic leading-none">
                        Access <span className="text-primary underline underline-offset-8 decoration-primary/20">Matrix</span>
                    </h1>
                    <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed opacity-60">
                        Synchronize with your operational workspace
                    </p>
                </div>

                <Card className="p-12 shadow-[0_40px_100px_rgba(0,0,0,0.08)] bg-white/80 backdrop-blur-3xl border-black/[0.03] rounded-[64px]">
                    <form onSubmit={handleLogin} className="space-y-10">
                        <Input
                            label="Operational ID (Email)"
                            type="email"
                            required
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="agent@trackora.ai"
                            leftIcon={<Mail className="w-5 h-5 text-primary" strokeWidth={2.5} />}
                        />

                        <div className="space-y-4">
                            <div className="flex justify-between items-center px-1">
                                <label className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono opacity-60 italic">Key Protocol</label>
                                <button
                                    type="button"
                                    onClick={() => navigate('/forgot-password')}
                                    className="text-[10px] font-black text-primary hover:underline underline-offset-4 uppercase tracking-[0.1em] transition-all font-mono"
                                >
                                    Lost Key?
                                </button>
                            </div>
                            <div className="relative">
                                <Input
                                    type={showPw ? 'text' : 'password'}
                                    required
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
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
                            {loading ? 'INITIALIZING...' : 'INFILTRATE'}
                        </Button>
                    </form>

                    <div className="mt-12 pt-10 border-t border-black/[0.03] flex flex-col items-center gap-6 text-center">
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono opacity-50 italic">
                            New Operative?
                        </p>
                        <button 
                            onClick={() => navigate('/signup')}
                            className="w-full py-5 rounded-[28px] border border-black/[0.1] text-text-primary text-[11px] font-black uppercase tracking-[0.3em] font-mono hover:bg-black/[0.02] hover:border-black/[0.2] transition-all active:scale-95 shadow-sm"
                        >
                            Establish Credential
                        </button>
                    </div>
                </Card>

                <p className="mt-12 text-center text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono px-8 leading-relaxed opacity-40 italic">
                    Protected by multi-layer <span className="text-primary font-black">Trackora Guard</span>. Verify domain authenticity: trackora.ai
                </p>
            </div>
        </div>
    );
}
