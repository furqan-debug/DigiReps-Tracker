import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Building2,
    CreditCard,
    CheckCircle2,
    ArrowRight,
    Rocket
} from 'lucide-react';

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
            // Simulated delay for payment processing
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 1. Create the organization
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

            // 2. Update member profile status to Active and link to Organization
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
        { id: 1, title: 'Identity', icon: Building2 },
        { id: 2, title: 'Payment', icon: CreditCard },
        { id: 3, title: 'Launch', icon: Rocket }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
            <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col md:flex-row">

                {/* Left Sidebar: Progress */}
                <div className="md:w-64 bg-slate-900 p-8 text-white flex flex-col">
                    <div className="flex items-center gap-2 mb-12">
                        <div className="w-6 h-6 bg-blue-600 rounded-md flex items-center justify-center">
                            <span className="text-white font-bold text-[10px]">D</span>
                        </div>
                        <span className="font-bold tracking-tight text-sm">DigiReps Setup</span>
                    </div>

                    <div className="space-y-8 flex-1">
                        {steps.map((s) => (
                            <div key={s.id} className="flex items-center gap-4 group">
                                <div className={clsx(
                                    "w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all",
                                    step >= s.id ? "bg-blue-600 border-blue-600 shadow-lg shadow-blue-500/20" : "border-slate-800"
                                )}>
                                    <s.icon className={clsx("w-4 h-4", step >= s.id ? "text-white" : "text-slate-700")} />
                                </div>
                                <div className="flex flex-col">
                                    <span className={clsx("text-xs font-bold uppercase tracking-wider", step >= s.id ? "text-white" : "text-slate-600")}>
                                        Step {s.id}
                                    </span>
                                    <span className={clsx("text-sm font-medium", step >= s.id ? "text-slate-300" : "text-slate-700")}>
                                        {s.title}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10">
                        <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Plan Selected</p>
                        <p className="text-sm font-bold text-blue-400">{selectedPlan}</p>
                    </div>
                </div>

                {/* Right Area: Content */}
                <div className="flex-1 p-10">
                    {step === 1 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Tell us about your organization</h2>
                            <p className="text-slate-500 text-sm mb-8">We'll use this to customize your workspace.</p>

                            <form onSubmit={handleOrgSubmit} className="space-y-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Company Name</label>
                                    <div className="relative group">
                                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-600" />
                                        <input
                                            type="text"
                                            required
                                            value={orgName}
                                            onChange={e => setOrgName(e.target.value)}
                                            placeholder="DigiReps Inc."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-10 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Industry</label>
                                        <select
                                            required
                                            value={industry}
                                            onChange={e => setIndustry(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium appearance-none"
                                        >
                                            <option value="">Select industry</option>
                                            {industries.map(ind => <option key={ind} value={ind}>{ind}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team Size</label>
                                        <select
                                            value={orgSize}
                                            onChange={e => setOrgSize(e.target.value)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 transition-all font-medium appearance-none"
                                        >
                                            <option value="1-10">1-10 people</option>
                                            <option value="11-50">11-50 people</option>
                                            <option value="51-200">51-200 people</option>
                                            <option value="201+">201+ people</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full bg-slate-900 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all mt-8"
                                >
                                    Continue to Payment
                                    <ArrowRight className="w-4 h-4" />
                                </button>
                            </form>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                            <h2 className="text-2xl font-bold text-slate-900 mb-2">Subscription & Payment</h2>
                            <p className="text-slate-500 text-sm mb-8">Secure your workspace and start tracking.</p>

                            <div className="bg-blue-600 rounded-2xl p-6 mb-8 text-white relative overflow-hidden shadow-xl shadow-blue-500/20">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-2xl rounded-full translate-x-12 -translate-y-12" />
                                <p className="text-xs font-bold uppercase tracking-widest opacity-60 mb-1">Total due today</p>
                                <p className="text-3xl font-extrabold">$0.00</p>
                                <p className="text-[10px] mt-2 font-medium opacity-80">Your 14-day free trial starts now. Cancellation is easy.</p>
                            </div>

                            <form onSubmit={handlePaymentSubmit} className="space-y-4">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center gap-4">
                                    <div className="w-10 h-10 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm">
                                        <CreditCard className="w-5 h-5 text-slate-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold text-slate-900 mb-0.5 tracking-tight uppercase">Card Details</p>
                                        <p className="text-[11px] text-slate-500">Payment simulation - just click pay</p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-blue-600 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-blue-700 transition-all disabled:opacity-50 mt-4 shadow-lg shadow-blue-500/25"
                                >
                                    {loading ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Pay & Launch Workspace
                                            <ArrowRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-400 text-center px-4">
                                    By clicking "Pay & Launch", you authorize DigiReps to charge your card after the 14-day trial period.
                                </p>
                            </form>
                        </div>
                    )}

                    {step === 3 && (
                        <div className="animate-in zoom-in-95 duration-700 text-center py-10">
                            <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <CheckCircle2 className="w-10 h-10 text-green-500" />
                            </div>
                            <h2 className="text-3xl font-bold text-slate-900 mb-4">Workspace is ready!</h2>
                            <p className="text-slate-500 mb-10 max-w-xs mx-auto text-sm leading-relaxed">
                                Welcome, <b>{profile?.full_name}</b>. Your organization <b>{orgName}</b> has been successfully set up.
                            </p>
                            <button
                                onClick={() => navigate('/dashboard')}
                                className="w-full bg-slate-900 text-white font-bold rounded-xl py-4 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-xl"
                            >
                                Go to Dashboard
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function clsx(...classes: any[]) {
    return classes.filter(Boolean).join(' ');
}
