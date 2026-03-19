import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    ChevronLeft, ChevronRight, 
    Activity, TrendingUp, ShieldCheck, 
    RefreshCw
} from 'lucide-react';
import clsx from 'clsx';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am – 8pm
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ActivityBlock {
    date: string; // YYYY-MM-DD
    hour: number;
    count: number; // samples in that hour
}

export function Schedules() {
    const [blocks, setBlocks] = useState<ActivityBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    useEffect(() => {
        fetchSchedules();
    }, [weekOffset]);

    async function fetchSchedules() {
        setLoading(true);

        const { data } = await supabase
            .from('activity_samples')
            .select('recorded_at, idle')
            .gte('recorded_at', weekStart.toISOString())
            .lte('recorded_at', weekEnd.toISOString());

        const blockMap: Record<string, number> = {};
        (data || []).forEach(a => {
            if (a.idle) return;
            const d = new Date(a.recorded_at);
            const key = `${d.toISOString().split('T')[0]}_${d.getHours()}`;
            blockMap[key] = (blockMap[key] || 0) + 1;
        });

        const result: ActivityBlock[] = Object.entries(blockMap).map(([key, count]) => {
            const [date, hourStr] = key.split('_');
            return { date: date!, hour: parseInt(hourStr!), count };
        });

        setBlocks(result);
        setLoading(false);
    }

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    function getBlock(date: string, hour: number): ActivityBlock | undefined {
        return blocks.find(b => b.date === date && b.hour === hour);
    }

    function blockOpacity(count: number): number {
        return Math.min(1, 0.2 + (count / 15) * 0.8);
    }

    const totalActiveHours = blocks.reduce((a, b) => a + b.count, 0);
    const peakDay = weekDays.length > 0 ? weekDays.reduce((best, d) => {
        const ds = d.toISOString().split('T')[0];
        const dayTotal = blocks.filter(b => b.date === ds).reduce((a, b) => a + b.count, 0);
        const bestTotal = blocks.filter(b => b.date === (best?.toISOString().split('T')[0] || '')).reduce((a, b) => a + b.count, 0);
        return dayTotal > bestTotal ? d : best;
    }, weekDays[0]!) : weekDays[0];

    const formatHeader = () =>
        `${weekStart.toLocaleString('en-US', { month: 'short' })} ${weekStart.getDate()} – ${weekEnd.toLocaleString('en-US', { month: 'short' })} ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

    return (
        <div className="flex flex-col h-full bg-transparent animate-in fade-in duration-700">
            {/* Header section with Summary */}
            <div className="px-10 py-12 border-b border-black/[0.05] bg-white/[0.01]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                                <Activity className="w-6 h-6 text-primary" strokeWidth={2.5} />
                            </div>
                            <h1 className="text-3xl font-black text-text-primary tracking-tighter leading-none">Operational Velocity</h1>
                        </div>
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed">Real-time workforce distribution and activity saturation analytics</p>
                    </div>

                    <div className="flex items-center gap-6">
                        <div className="flex bg-black/[0.02] border border-black/[0.05] p-1.5 rounded-[24px] shadow-inner items-center">
                            <button 
                                onClick={() => setWeekOffset(w => w - 1)}
                                className="p-3.5 hover:bg-white rounded-xl transition-all text-text-muted hover:text-primary hover:shadow-sm"
                            >
                                <ChevronLeft className="w-5 h-5" strokeWidth={3} />
                            </button>
                            <div className="px-8 min-w-[280px] text-center">
                                <span className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em] font-mono whitespace-nowrap">
                                    {formatHeader()}
                                </span>
                            </div>
                            <button 
                                onClick={() => setWeekOffset(w => w + 1)}
                                className="p-3.5 hover:bg-white rounded-xl transition-all text-text-muted hover:text-primary hover:shadow-sm"
                            >
                                <ChevronRight className="w-5 h-5" strokeWidth={3} />
                            </button>
                        </div>
                        <button
                            onClick={() => setWeekOffset(0)}
                            className="px-8 py-5 rounded-[20px] bg-white border border-black/[0.1] text-[10px] font-black text-text-muted hover:text-text-primary hover:border-text-primary transition-all active:scale-95 shadow-sm uppercase tracking-[0.2em] font-mono"
                        >
                            Sync to Present
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <StatsCard 
                        label="Active Samples" 
                        value={totalActiveHours.toLocaleString()} 
                        icon={<Activity className="w-5 h-5" strokeWidth={2.5} />} 
                        subtitle="Current week volume"
                        color="indigo" 
                    />
                    <StatsCard 
                        label="Peak Distribution" 
                        value={peakDay ? DAYS_SHORT[peakDay.getDay()] + ', ' + peakDay.getDate() : '—'} 
                        icon={<TrendingUp className="w-5 h-5" strokeWidth={2.5} />} 
                        subtitle="Max reach capacity"
                        color="violet" 
                    />
                    <StatsCard 
                        label="Coverage Index" 
                        value={`${new Set(blocks.map(b => b.hour)).size} hr`} 
                        icon={<ShieldCheck className="w-5 h-5" strokeWidth={2.5} />} 
                        subtitle="Operational width"
                        color="emerald" 
                    />
                </div>
            </div>

            {/* Heatmap Section */}
            <div className="p-10 flex-1 overflow-auto custom-scrollbar bg-white/[0.01]">
                <div className="glass border border-black/[0.05] rounded-[48px] shadow-2xl overflow-hidden relative group bg-white mb-20 transition-all duration-700 hover:shadow-primary/5">
                    <div className="px-10 py-10 border-b border-black/[0.03] bg-black/[0.01] flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div>
                            <h2 className="text-2xl font-black text-text-primary tracking-tighter leading-none mb-3 uppercase">Activity Saturation Matrix</h2>
                            <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-relaxed">Cross-jurisdictional intensity mapping by hour and node registry</p>
                        </div>
                        <div className="flex items-center gap-6 bg-black/[0.03] border border-black/[0.05] rounded-[24px] px-6 py-4 shadow-inner">
                            <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] font-mono italic opacity-60">Saturation Index:</span>
                            <div className="flex items-center gap-2">
                                {[0.2, 0.4, 0.6, 0.8, 1].map(o => (
                                    <div 
                                        key={o} 
                                        className="w-4 h-4 rounded-md bg-primary shadow-sm transition-all hover:scale-125 cursor-help" 
                                        style={{ opacity: o }} 
                                    />
                                ))}
                            </div>
                        </div>
                    </div>

                    {loading ? (
                        <div className="h-[600px] flex items-center justify-center">
                            <div className="flex flex-col items-center gap-6">
                                <RefreshCw className="w-12 h-12 text-primary animate-spin" strokeWidth={3} />
                                <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.5em] animate-pulse font-mono">Reconstructing Matrix Core...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto custom-scrollbar p-10">
                            <table className="w-full border-separate border-spacing-3">
                                <thead>
                                    <tr>
                                        <th className="w-32 pb-8 text-right pr-10 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono italic opacity-60">Node Registry</th>
                                        {weekDays.map((d, i) => {
                                            const isToday = d.toDateString() === today.toDateString();
                                            return (
                                                <th key={i} className="pb-8">
                                                    <div className={clsx(
                                                        "flex flex-col items-center p-5 rounded-[28px] transition-all duration-700 border",
                                                        isToday 
                                                            ? "bg-primary text-white border-primary shadow-xl shadow-primary/20 scale-105 -translate-y-1" 
                                                            : "bg-black/[0.02] border-black/[0.05] hover:bg-black/[0.04]"
                                                    )}>
                                                        <span className={clsx(
                                                            "text-[10px] font-black uppercase tracking-[0.2em] mb-2",
                                                            isToday ? "text-white/70" : "text-text-muted"
                                                        )}>
                                                            {DAYS_SHORT[d.getDay()]}
                                                        </span>
                                                        <span className="text-2xl font-black tracking-tighter">
                                                            {d.getDate()}
                                                        </span>
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {HOURS.map(hour => (
                                        <tr key={hour} className="group/row">
                                            <td className="py-4 text-right pr-10 font-mono text-[12px] font-black text-text-muted group-hover/row:text-text-primary transition-all duration-500 uppercase tracking-tighter italic">
                                                {hour < 12 ? `${hour}:00 AM` : hour === 12 ? '12:00 PM' : `${hour - 12}:00 PM`}
                                            </td>
                                            {weekDays.map((d, di) => {
                                                const dateStr = d.toISOString().split('T')[0];
                                                const block = getBlock(dateStr!, hour);
                                                return (
                                                    <td key={di} className="p-0">
                                                        {block ? (
                                                            <div
                                                                title={`${block.count} active samples at ${hour}:00`}
                                                                className="h-16 w-full rounded-[18px] bg-primary border border-primary/20 transition-all duration-700 hover:scale-[1.08] hover:rotate-2 hover:shadow-2xl hover:shadow-primary/30 cursor-pointer group/cell relative"
                                                                style={{
                                                                    opacity: blockOpacity(block.count),
                                                                }}
                                                            >
                                                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-all duration-500 bg-primary rounded-[18px] shadow-inner ring-1 ring-white/20">
                                                                    <span className="text-[12px] font-black text-white">{block.count}</span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="h-16 w-full rounded-[18px] bg-black/[0.01] border border-black/[0.02] group-hover/row:border-black/[0.05] group-hover/row:bg-black/[0.02] transition-all duration-500" />
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full -mr-48 -mt-48 pointer-events-none group-hover:bg-indigo-500/10 transition-colors duration-1000" />
                </div>
            </div>
        </div>
    );
}

function StatsCard({ label, value, icon, subtitle, color }: { label: string; value: string; icon: React.ReactNode; subtitle: string; color: 'indigo' | 'violet' | 'emerald' }) {
    const colorClasses = {
        indigo: { bg: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary', glow: 'bg-primary/5' },
        emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-600', glow: 'bg-emerald-500/5' },
        violet: { bg: 'bg-violet-500/5', border: 'border-violet-500/20', text: 'text-violet-600', glow: 'bg-violet-500/5' }
    };

    return (
        <div className="glass p-10 rounded-[44px] border border-black/[0.03] hover:border-primary/20 transition-all group overflow-hidden relative shadow-sm hover:shadow-xl duration-700 bg-white">
            <div className={clsx("absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 group-hover:scale-125 transition-transform duration-1000", colorClasses[color].glow)} />
            <div className="flex items-center gap-6 mb-6">
                <div className={clsx("w-12 h-12 rounded-[18px] flex items-center justify-center border shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-700", colorClasses[color].bg, colorClasses[color].border, colorClasses[color].text)}>
                    {icon}
                </div>
                <div>
                    <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-none mb-2">{label}</p>
                    <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-[0.2em] font-mono leading-none">{subtitle}</p>
                </div>
            </div>
            <h2 className="text-5xl font-black text-text-primary tracking-tighter leading-none">{value}</h2>
        </div>
    );
}
