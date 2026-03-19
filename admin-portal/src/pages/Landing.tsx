import { useNavigate } from 'react-router-dom';
import {
    ChevronRight,
    Check,
    Zap,
    Shield,
    BarChart3,
    Users2,
    Clock
} from 'lucide-react';

export function Landing() {
    const navigate = useNavigate();

    const plans = [
        {
            name: 'Starter',
            price: '$12',
            period: '/member/mo',
            description: 'Essential tracking for small teams.',
            features: [
                'Automatic time tracking',
                'Activity screenshots',
                'Basic reports',
                'Up to 5 members',
                'Email support'
            ],
            buttonLabel: 'Select Starter',
            popular: false
        },
        {
            name: 'Professional',
            price: '$19',
            period: '/member/mo',
            description: 'Advanced insights for growing companies.',
            features: [
                'Everything in Starter',
                'App & URL tracking',
                'Priority support',
                'Unlimited members',
                'Customized reports',
                'Payroll management'
            ],
            buttonLabel: 'Select Professional',
            popular: true
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            description: 'Custom solutions for large organizations.',
            features: [
                'Everything in Professional',
                'dedicated account manager',
                'SLA & dedicated hosting',
                'Advanced security (SAML)',
                'Custom integrations',
                'On-premise options'
            ],
            buttonLabel: 'Talk to sales',
            popular: false
        }
    ];

    return (
        <div className="min-h-screen bg-background font-sans text-text-primary overflow-x-hidden selection:bg-primary/10 selection:text-primary">
            {/* Ambient Background Elements */}
            <div className="fixed inset-0 bg-gradient-mesh opacity-30 z-0 pointer-events-none" />
            <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full z-0 pointer-events-none animate-pulse" />
            <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-violet-500/5 blur-[120px] rounded-full z-0 pointer-events-none animate-pulse" style={{ animationDelay: '3s' }} />

            {/* Top navigation */}
            <header className="fixed top-0 left-0 right-0 z-50 border-b border-black/[0.03] bg-white/60 backdrop-blur-2xl">
                <nav className="mx-auto flex max-w-7xl items-center justify-between px-8 py-6">
                    <button
                        type="button"
                        onClick={() => navigate('/')}
                        className="flex items-center gap-4 group"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20 group-hover:rotate-12 transition-transform duration-500">
                             <div className="w-5 h-5 border-4 border-white rounded-[2px] rotate-45" />
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-lg font-black tracking-tighter uppercase italic leading-none">Trackora</span>
                            <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted font-mono leading-none mt-1">
                                Operational Intelligence
                            </span>
                        </div>
                    </button>

                    <div className="hidden items-center gap-12 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono md:flex">
                        <a href="#features" className="hover:text-primary transition-colors italic">Capabilities</a>
                        <a href="#how-it-works" className="hover:text-primary transition-colors italic">Protocols</a>
                        <a href="#pricing" className="hover:text-primary transition-colors italic">Tiers</a>
                    </div>

                    <div className="flex items-center gap-6">
                        <button
                            type="button"
                            onClick={() => navigate('/login')}
                            className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono hover:text-primary transition-colors"
                        >
                            Authorize
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/signup')}
                            className="bg-primary hover:bg-primary-dark text-white px-8 py-3.5 rounded-[20px] text-[11px] font-black uppercase tracking-[0.3em] font-mono shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all"
                        >
                            Deploy Matrix
                        </button>
                    </div>
                </nav>
            </header>

            {/* Hero */}
            <main className="relative z-10 pt-24">
                <section className="mx-auto flex max-w-7xl flex-col gap-20 px-8 py-32 md:flex-row md:items-center md:px-12">
                    <div className="flex-1 space-y-12">
                        <div className="inline-flex items-center gap-4 rounded-full border border-black/[0.05] bg-white px-6 py-2.5 shadow-xl">
                            <Zap className="h-4 w-4 text-primary animate-pulse" strokeWidth={3} />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-primary font-mono italic">Phase 2: Global Rollout Active</span>
                        </div>
                        
                        <h1 className="text-6xl font-black tracking-tighter text-text-primary leading-[0.9] uppercase italic sm:text-7xl lg:text-8xl">
                            Verify <span className="text-primary underline underline-offset-[16px] decoration-primary/10">Absolute</span><br />
                            Performance.
                        </h1>
                        
                        <p className="max-w-xl text-[13px] font-black text-text-muted uppercase tracking-widest font-mono leading-relaxed opacity-60">
                            Trackora synchronizes human output with digital pulse. A unified intelligence matrix for distributed teams that demands total transparency and operational excellence.
                        </p>

                        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
                            <button
                                type="button"
                                onClick={() => navigate('/signup')}
                                className="flex items-center justify-center gap-4 rounded-[28px] bg-primary px-10 py-5 text-[12px] font-black text-white shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:scale-105 active:scale-95 transition-all uppercase tracking-[0.3em] font-mono group"
                            >
                                Initiate Trial
                                <ChevronRight className="h-5 w-5 group-hover:translate-x-2 transition-transform" strokeWidth={3} />
                            </button>
                            <button
                                type="button"
                                className="px-10 py-5 rounded-[28px] border border-black/[0.1] bg-white text-[11px] font-black text-text-primary uppercase tracking-[0.3em] font-mono hover:bg-black/[0.02] hover:border-black/[0.2] transition-all active:scale-95 shadow-sm"
                            >
                                View Mechanics
                            </button>
                        </div>

                        <div className="flex flex-col gap-6 pt-8 border-t border-black/[0.03]">
                            <div className="flex items-center gap-6">
                                <div className="flex -space-x-4">
                                    {[1,2,3].map(i => (
                                        <div key={i} className="w-12 h-12 rounded-2xl bg-white border-4 border-background shadow-xl flex items-center justify-center overflow-hidden">
                                            <div className={`w-full h-full bg-gradient-to-br ${i === 1 ? 'from-primary to-indigo-400' : i === 2 ? 'from-violet-400 to-fuchsia-400' : 'from-emerald-400 to-teal-400'} opacity-30`} />
                                        </div>
                                    ))}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        {[1,2,3,4,5].map(i => (
                                            <Zap key={i} className="w-3 h-3 text-primary fill-primary" />
                                        ))}
                                    </div>
                                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] font-mono italic">Vetted by 500+ Distributed Nodes</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 relative">
                        <div className="absolute inset-0 bg-primary/10 blur-[120px] rounded-full -z-10 animate-pulse" />
                        <div className="relative p-1 bg-white/40 backdrop-blur-3xl border border-black/[0.03] rounded-[56px] shadow-[0_60px_120px_rgba(0,0,0,0.15)] group hover:scale-[1.02] transition-all duration-1000">
                            <div className="relative overflow-hidden rounded-[52px] bg-white border border-black/[0.05]">
                                <div className="flex items-center justify-between bg-black/[0.02] border-b border-black/[0.03] px-8 py-5">
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted font-mono italic">Operational Matrix</span>
                                    <div className="flex gap-2">
                                        <div className="w-2.5 h-2.5 rounded-full bg-rose-400/20 border border-rose-400/40" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400/20 border border-amber-400/40" />
                                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/20 border border-emerald-400/40" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-3 divide-x divide-black/[0.03] border-b border-black/[0.03]">
                                    <Metric label="Matrix Pulse" value="1,492h" />
                                    <Metric label="Active Units" value="84" />
                                    <Metric label="Risk Level" value="0.2%" tone="warning" />
                                </div>
                                <div className="p-4 space-y-4">
                                    {[
                                        { name: 'Core Infrastructure', status: 'Optimal', activity: 98, color: 'text-primary' },
                                        { name: 'Node Synchronization', status: 'Active', activity: 84, color: 'text-emerald-500' },
                                        { name: 'Data Infiltration', status: 'Processing', activity: 65, color: 'text-violet-500' }
                                    ].map((team) => (
                                        <div key={team.name} className="flex items-center gap-6 p-4 rounded-3xl hover:bg-black/[0.01] transition-all group/item">
                                            <div className="h-14 w-14 rounded-2xl bg-black/[0.03] border border-black/[0.05] flex items-center justify-center shadow-inner group-hover/item:scale-110 transition-transform">
                                                <Zap className={`w-6 h-6 ${team.color}`} strokeWidth={3} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-3">
                                                    <span className="text-[13px] font-black text-text-primary uppercase tracking-tight font-mono italic">
                                                        {team.name}
                                                    </span>
                                                    <span className="text-[9px] font-black text-text-muted uppercase tracking-widest font-mono opacity-60">{team.status}</span>
                                                </div>
                                                <div className="relative h-2 w-full rounded-full bg-black/[0.05] overflow-hidden">
                                                    <div 
                                                        className={`absolute inset-y-0 left-0 bg-primary opacity-80 rounded-full transition-all duration-1000`} 
                                                        style={{ width: `${team.activity}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        {/* Floating elements */}
                        <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/80 backdrop-blur-xl border border-black/[0.05] rounded-[32px] shadow-2xl p-6 flex flex-col items-center justify-center animate-bounce duration-[4000ms]">
                            <BarChart3 className="w-8 h-8 text-primary mb-2" strokeWidth={3} />
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary font-mono">+42%</span>
                        </div>
                    </div>
                </section>

                {/* Product pillars */}
                <section id="features" className="relative py-32 overflow-hidden">
                    <div className="mx-auto max-w-7xl px-8 md:px-12">
                        <div className="mb-20 max-w-3xl">
                            <h2 className="text-4xl font-black tracking-tight text-text-primary uppercase italic leading-none sm:text-5xl">
                                Enterprise-Grade <span className="text-primary underline underline-offset-8 decoration-primary/10">Mechanics</span>
                            </h2>
                            <p className="mt-6 text-[13px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-relaxed opacity-60">
                                Trackora architected an immutable source of truth. Synchronize your workforce with absolute precision.
                            </p>
                        </div>

                        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
                            <FeatureCard
                                icon={Clock}
                                title="Temporal Synthesis"
                                body="Autonomous tracking across all active nodes. Zero latency, zero manual friction."
                            />
                            <FeatureCard
                                icon={Users2}
                                title="Node Hierarchies"
                                body="Structural pods and tactical roles mirrored perfectly within the synchronization matrix."
                            />
                            <FeatureCard
                                icon={BarChart3}
                                title="Intelligence Feed"
                                body="High-entropy data visualized for instant strategic recalibration and forecasting."
                            />
                            <FeatureCard
                                icon={Shield}
                                title="Protocol Integrity"
                                body="Sovereign privacy controls and governance baked into the core kernel."
                            />
                        </div>
                    </div>
                </section>

                {/* How it works strip */}
                <section
                    id="how-it-works"
                    className="py-32 bg-black/[0.02] border-y border-black/[0.03]"
                >
                    <div className="mx-auto max-w-7xl px-8 md:px-12">
                        <div className="flex flex-col justify-between gap-16 md:flex-row md:items-start">
                            <div className="max-w-md">
                                <h3 className="text-[11px] font-black uppercase tracking-[0.4em] text-primary font-mono mb-6">
                                    Integration Protocol
                                </h3>
                                <p className="text-3xl font-black tracking-tight text-text-primary uppercase italic leading-none">
                                    From Deployment to <span className="text-primary">Intelligence</span>.
                                </p>
                            </div>
                            <ol className="grid flex-1 gap-8 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                <Step label="Synchronize Units" description="Onboard high-performance personnel via secure identity providers." index={1} />
                                <Step label="Map Architecture" description="Initialize pods, territories, and tactical mission objectives." index={2} />
                                <Step label="Activate Streams" description="Capture immutable activity data via high-fidelity desktop nodes." index={3} />
                                <Step label="Review Matrix" description="Execute data-driven coaching using real-time synchronization feeds." index={4} />
                            </ol>
                        </div>
                    </div>
                </section>

                {/* Pricing */}
                <section
                    id="pricing"
                    className="py-32"
                >
                    <div className="mx-auto max-w-7xl px-8 md:px-12">
                        <div className="mb-20 flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
                            <div className="max-w-2xl">
                                <h2 className="text-4xl font-black tracking-tight text-text-primary uppercase italic leading-none sm:text-5xl">
                                    Operational <span className="text-primary">Tiers</span>.
                                </h2>
                                <p className="mt-6 text-[13px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-relaxed opacity-60">
                                    Select the synchronization depth required for your organization. Professional-grade scaling with no legacy overhead.
                                </p>
                            </div>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-widest font-mono opacity-40">
                                Billed dynamically per active node.
                            </p>
                        </div>

                        <div className="grid gap-8 md:grid-cols-3">
                            {plans.map((plan) => (
                                <div
                                    key={plan.name}
                                    className={`flex h-full flex-col rounded-[48px] p-10 transition-all duration-500 hover:scale-[1.02] ${
                                        plan.popular 
                                            ? 'bg-primary text-white shadow-[0_40px_100px_rgba(80,110,248,0.25)] ring-1 ring-white/20' 
                                            : 'bg-white/60 backdrop-blur-3xl border border-black/[0.03] text-text-primary shadow-2xl'
                                    }`}
                                >
                                    {plan.popular && (
                                        <span className="mb-6 inline-flex items-center self-start rounded-full bg-white/10 px-4 py-1 text-[9px] font-black uppercase tracking-[0.3em] text-white font-mono italic">
                                            Elite Configuration
                                        </span>
                                    )}
                                    <div className="mb-10">
                                        <h3 className="text-2xl font-black uppercase italic tracking-tight">
                                            {plan.name}
                                        </h3>
                                        <div className="mt-4 flex items-baseline gap-2">
                                            <span className="text-6xl font-black tracking-tighter">
                                                {plan.price}
                                            </span>
                                            <span className={`text-[10px] font-black uppercase tracking-widest font-mono opacity-60 ${plan.popular ? 'text-white' : 'text-text-muted'}`}>
                                                {plan.period}
                                            </span>
                                        </div>
                                        <p className={`mt-4 text-[11px] font-black uppercase tracking-widest font-mono opacity-60 leading-relaxed ${plan.popular ? 'text-white' : 'text-text-muted'}`}>
                                            {plan.description}
                                        </p>
                                    </div>

                                    <ul className="mb-12 flex-1 space-y-4">
                                        {plan.features.map((feature) => (
                                            <li key={feature} className="flex items-center gap-4 text-[11px] font-black uppercase tracking-widest font-mono">
                                                <div className={`flex h-5 w-5 items-center justify-center rounded-lg border ${plan.popular ? 'bg-white/10 border-white/20' : 'bg-primary/5 border-primary/10'}`}>
                                                    <Check className={`h-3 w-3 ${plan.popular ? 'text-white' : 'text-primary'}`} strokeWidth={4} />
                                                </div>
                                                <span className={plan.popular ? 'text-white/90' : 'text-text-primary/80'}>
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>

                                    <button
                                        type="button"
                                        onClick={() => navigate('/signup', { state: { plan: plan.name } })}
                                        className={`mt-auto w-full py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.4em] font-mono transition-all ${
                                            plan.popular
                                                ? 'bg-white text-primary hover:bg-slate-100 shadow-xl'
                                                : 'bg-primary text-white hover:shadow-primary/30 shadow-lg'
                                        }`}
                                    >
                                        {plan.name === 'Enterprise' ? 'Contact Intel' : 'Initialize'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="relative py-20 border-t border-black/[0.03] bg-white/40 backdrop-blur-3xl">
                    <div className="mx-auto max-w-7xl px-8 md:px-12">
                        <div className="flex flex-col gap-12 md:flex-row md:items-center md:justify-between">
                            <div className="flex items-center gap-4">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white shadow-lg shadow-primary/20">
                                     <div className="w-5 h-5 border-4 border-white rounded-[2px] rotate-45" />
                                </div>
                                <span className="text-xl font-black tracking-tighter uppercase italic">Trackora</span>
                            </div>
                            <div className="grid grid-cols-2 gap-12 sm:flex sm:gap-12">
                                <a href="#" className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-text-muted hover:text-primary transition-colors italic">Privacy</a>
                                <a href="#" className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-text-muted hover:text-primary transition-colors italic">Terms</a>
                                <a href="#" className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-text-muted hover:text-primary transition-colors italic">Protocol Docs</a>
                                <a href="#" className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-text-muted hover:text-primary transition-colors italic">Support</a>
                            </div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] font-mono text-text-muted opacity-40">
                                © {new Date().getFullYear()} Trackora Ops. Implemented by DigiReps.
                            </p>
                        </div>
                    </div>
                </footer>
            </main>
        </div>
    );
}

interface MetricProps {
    label: string;
    value: string;
    tone?: 'default' | 'warning';
}

function Metric({ label, value, tone = 'default' }: MetricProps) {
    const valueClass =
        tone === 'warning' ? 'text-rose-500' : 'text-text-primary';
    return (
        <div className="px-8 py-5">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-text-muted font-mono opacity-60">
                {label}
            </p>
            <p className={`mt-2 text-xl font-black tracking-tight italic uppercase ${valueClass}`}>
                {value}
            </p>
        </div>
    );
}

interface FeatureCardProps {
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    title: string;
    body: string;
}

function FeatureCard({ icon: Icon, title, body }: FeatureCardProps) {
    return (
        <div className="group flex flex-col gap-6 rounded-[32px] bg-white/60 backdrop-blur-3xl border border-black/[0.03] p-8 text-sm text-text-primary shadow-2xl hover:scale-105 transition-all duration-500">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 group-hover:rotate-12 transition-all">
                <Icon className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <div className="space-y-3">
                <h3 className="text-[13px] font-black uppercase italic tracking-tight text-text-primary">
                    {title}
                </h3>
                <p className="text-[11px] font-black text-text-muted uppercase tracking-widest font-mono leading-relaxed opacity-60">{body}</p>
            </div>
        </div>
    );
}

interface StepProps {
    index: number;
    label: string;
    description: string;
}

function Step({ index, label, description }: StepProps) {
    return (
        <li className="group flex flex-col gap-4 rounded-[32px] bg-white border border-black/[0.03] p-8 shadow-xl hover:shadow-2xl transition-all">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-black/[0.03] text-[11px] font-black font-mono text-primary group-hover:bg-primary group-hover:text-white transition-all">
                0{index}
            </div>
            <div className="space-y-2">
                <p className="text-[11px] font-black uppercase tracking-widest text-text-primary italic">
                    {label}
                </p>
                <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.1em] font-mono leading-relaxed opacity-60">
                    {description}
                </p>
            </div>
        </li>
    );
}
