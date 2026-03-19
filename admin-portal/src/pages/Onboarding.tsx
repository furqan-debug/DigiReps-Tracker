import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Building2,
    CreditCard,
    CheckCircle2,
    ArrowRight,
    Rocket,
    Check,
    Lock,
    ShieldCheck,
    Zap
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';

export function Onboarding() {
    const navigate = useNavigate();
    const location = useLocation();
    const { profile, refreshProfile } = useAuth();
    const selectedPlan = location.state?.plan || 'Starter';

    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [orgSize, setOrgSize] = useState('1-10');
    const [industry, setIndustry] = useState('');

    const industries = [
        'Marketing Agency',
        'Software Development',
        'Customer Support',
        'E-commerce',
        'Real Estate',
        'Other'
    ];

    const handleOrgSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStep(2);
    };

    const handlePaymentSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            await new Promise(resolve => setTimeout(resolve, 2000));

            const { data: orgData, error: orgError } = await supabase
                .from('organizations')
                .insert({
                    name: orgName,
                    industry: industry,
                    size: orgSize
                })
                .select()
                .single();

            if (orgError) throw orgError;

            if (profile?.email && orgData) {
                const { error: memberError } = await supabase
                    .from('members')
                    .update({
                        status: 'Active',
                        organization_id: orgData.id
                    })
                    .eq('email', profile.email);

                if (memberError) throw memberError;
                await refreshProfile();
            }

            setStep(3);
        } catch (err) {
            console.error('Onboarding update error:', err);
            alert('Failed to complete onboarding. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { id: 1, title: 'Organization', icon: Building2, desc: 'Identity & Setup' },
        { id: 2, title: 'Subscription', icon: CreditCard, desc: 'Secure Billing' },
        { id: 3, title: 'Launch', icon: Rocket, desc: 'Ready to Track' }
    ];

    return (
        <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4 md:p-8">
            <div className="absolute inset-0 bg-gradient-mesh z-0" />
            
            <Card className="relative z-10 w-full max-w-5xl overflow-hidden border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] flex flex-col md:flex-row min-h-[640px]">
                
                {/* Left Sidebar: Progress */}
                <div className="md:w-[320px] bg-slate-900/40 backdrop-blur-xl border-r border-white/5 p-10 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-violet-600" />
                    
                    <div className="flex items-center gap-3 mb-16">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                             <div className="w-3.5 h-3.5 border-2 border-white rounded-[1px] rotate-45" />
                        </div>
                        <span className="text-lg font-bold tracking-tight text-white font-head">Trackora</span>
                    </div>

                    <div className="space-y-10 flex-1 relative z-10">
                        {steps.map((s) => (
                            <div key={s.id} className="flex items-start gap-5 group relative">
                                {s.id < 3 && (
                                    <div className={clsx(
                                        "absolute left-[19px] top-10 w-[2px] h-10 transition-colors duration-500",
                                        step > s.id ? "bg-indigo-500" : "bg-white/5"
                                    )} />
                                )}
                                <div className={clsx(
                                    "w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-500 shrink-0",
                                    step > s.id ? "bg-indigo-500 border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.4)]" : 
                                    step === s.id ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "border-white/5 text-text-muted"
                                )}>
                                    {step > s.id ? <Check className="w-5 h-5 text-white" /> : <s.icon className="w-5 h-5" />}
                                </div>
                                <div className="pt-0.5">
                                    <span className={clsx("block text-[10px] font-bold uppercase tracking-[0.2em] mb-1 transition-colors duration-500", step >= s.id ? "text-indigo-400" : "text-text-muted/50")}>
                                        Step 0{s.id}
                                    </span>
                                    <p className={clsx("text-base font-bold transition-colors duration-500 font-head", step === s.id ? "text-white" : "text-text-muted")}>
                                        {s.title}
                                    </p>
                                    <p className="text-xs text-text-muted/60 font-medium">{s.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-auto pt-10">
                        <div className="p-5 rounded-2xl glass border border-white/5 overflow-hidden relative group">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-indigo-500/20 transition-colors" />
                            <p className="text-[10px] text-text-muted uppercase font-bold tracking-[0.15em] mb-2 opacity-60">Provisioned Plan</p>
                            <div className="flex items-center gap-2">
                                <Zap className="w-4 h-4 text-indigo-400" />
                                <p className="text-base font-bold text-white font-head">{selectedPlan}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Area: Content */}
                <div className="flex-1 bg-white/[0.02] backdrop-blur-sm p-8 md:p-16 overflow-y-auto">
                    {step === 1 && (
                        <div className="max-w-md mx-auto animate-in fade-in slide-in-from-right-8 duration-700">
                             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-8">
                                <Building2 className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary font-sans">Business Identity</span>
                            </div>
                            
                            <h2 className="text-3xl font-bold text-text-primary mb-3 font-head">Setup your workspace</h2>
                            <p className="text-text-secondary text-base mb-10 font-medium">Configure your organizational profile to get started.</p>

                            <form onSubmit={handleOrgSubmit} className="space-y-8">
                                <Input
                                    label="Legal Company Name"
                                    required
                                    value={orgName}
                                    onChange={e => setOrgName(e.target.value)}
                                    placeholder="Acme Global Inc."
                                    leftIcon={<Building2 className="w-4 h-4 text-text-muted" />}
                                    className="p-4"
                                />

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider pl-1 font-sans">Industry Segment</label>
                                        <div className="relative">
                                            <select
                                                required
                                                value={industry}
                                                onChange={e => setIndustry(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium appearance-none hover:bg-white/[0.07]"
                                            >
                                                <option value="" className="bg-slate-900">Select industry</option>
                                                {industries.map(ind => <option key={ind} value={ind} className="bg-slate-900">{ind}</option>)}
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted opacity-50">
                                                <ArrowRight className="w-4 h-4 rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-text-secondary uppercase tracking-wider pl-1 font-sans">Organization Size</label>
                                        <div className="relative">
                                            <select
                                                value={orgSize}
                                                onChange={e => setOrgSize(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium appearance-none hover:bg-white/[0.07]"
                                            >
                                                <option value="1-10" className="bg-slate-900">1-10 people</option>
                                                <option value="11-50" className="bg-slate-900">11-50 people</option>
                                                <option value="51-200" className="bg-slate-900">51-200 people</option>
                                                <option value="201+" className="bg-slate-900">201+ people</option>
                                            </select>
                                            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted opacity-50">
                                                <ArrowRight className="w-4 h-4 rotate-90" />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    className="w-full py-4 text-base mt-4"
                                    rightIcon={<ArrowRight className="w-5 h-5" />}
                                >
                                    Review & Continue
                                </Button>
                            </form>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="max-w-md mx-auto animate-in fade-in slide-in-from-right-8 duration-700">
                             <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass mb-8">
                                <CreditCard className="w-4 h-4 text-indigo-400" />
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-secondary font-sans">Payment verification</span>
                            </div>

                            <h2 className="text-3xl font-bold text-text-primary mb-3 font-head">Billing activation</h2>
                            <p className="text-text-secondary text-base mb-10 font-medium">Confirm your subscription to activate your workspace.</p>

                            <div className="bg-gradient-to-br from-indigo-500 to-violet-700 rounded-3xl p-8 mb-10 text-white relative overflow-hidden shadow-[0_20px_40px_-10px_rgba(99,102,241,0.5)]">
                                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-3xl rounded-full translate-x-12 -translate-y-12" />
                                <div className="relative z-10 flex justify-between items-start">
                                    <div className="space-y-1">
                                         <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-100/70">Activation Total</p>
                                         <p className="text-4xl font-extrabold font-head">$0.00</p>
                                    </div>
                                    <Zap className="w-8 h-8 text-white/30" />
                                </div>
                                <div className="mt-8 pt-8 border-t border-white/20 flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5 text-indigo-200" />
                                    <p className="text-xs font-medium text-indigo-100 leading-snug">
                                        Your 14-day free trial on the <span className="text-white font-bold">{selectedPlan} plan</span> starts now. Zero commitment required.
                                    </p>
                                </div>
                            </div>

                            <form onSubmit={handlePaymentSubmit} className="space-y-6">
                                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-5 group hover:bg-white/[0.08] transition-colors cursor-pointer border-dashed">
                                    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-text-muted group-hover:text-indigo-400 transition-colors">
                                        <Lock className="w-6 h-6" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-sm font-bold text-text-primary mb-0.5 font-head tracking-wide">Stripe Secured Portal</p>
                                        <p className="text-xs text-text-muted font-medium">Click to confirm payment simulation</p>
                                    </div>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-4 text-base shadow-[0_20px_40px_-10px_rgba(14,165,233,0.3)]"
                                    loading={loading}
                                >
                                    Activate & Launch Workspace
                                </Button>
                                
                                <p className="text-[11px] text-text-muted text-center px-4 leading-relaxed font-medium opacity-60">
                                    By clicking "Activate", you authorize Trackora to start your trial. You can cancel any time from the billing section.
                                </p>
                            </form>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="max-w-md mx-auto animate-in zoom-in-95 duration-1000 text-center flex flex-col items-center justify-center min-h-[500px]">
                            <div className="relative mb-10">
                                <div className="absolute inset-0 bg-emerald-500/20 blur-3xl rounded-full" />
                                <div className="w-24 h-24 bg-emerald-500/10 border border-emerald-500/20 rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-2xl rotate-12 group hover:rotate-0 transition-transform duration-500">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                                </div>
                            </div>
                            
                            <h2 className="text-4xl font-bold text-text-primary mb-4 font-head tracking-tight">Setup Complete!</h2>
                            <p className="text-text-secondary mb-12 max-w-sm mx-auto text-base leading-relaxed font-medium">
                                Welcome aboard, <span className="text-indigo-400 font-bold">{profile?.full_name}</span>. Your organization <span className="text-white font-bold">{orgName}</span> is now active.
                            </p>
                            
                            <Button
                                onClick={() => navigate('/dashboard')}
                                className="w-full py-5 text-lg group"
                                rightIcon={<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
                            >
                                Enter Workspace
                            </Button>
                            
                            <p className="mt-8 text-[11px] text-text-muted font-bold tracking-widest uppercase opacity-40">
                                Infrastructure Ready • System Online
                            </p>
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}

function clsx(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
