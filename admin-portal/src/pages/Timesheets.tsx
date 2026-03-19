import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Clock, ChevronLeft, ChevronRight, 
    Calendar, Users, Activity, 
    Zap, Timer, BarChart3, Filter,
    CheckCircle2, AlertCircle
} from 'lucide-react';
import { PageLayout, Card, KpiCard, Button, LoadingState } from '../components/ui';
import clsx from 'clsx';

interface Session {
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
}

interface DailyEntry {
    date: string;
    sessions: Session[];
    totalMinutes: number;
    activeMinutes: number;
    activityPercent: number;
}

interface MemberInfo {
    id: string;
    full_name: string;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Timesheets() {
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    useEffect(() => { fetchMembers(); }, []);
    useEffect(() => { fetchTimesheets(); }, [weekOffset, selectedMember]);

    async function fetchMembers() {
        const { data } = await supabase.from('members').select('id, full_name').order('full_name');
        setMembers(data || []);
    }

    async function fetchTimesheets() {
        setLoading(true);
        try {
            let query = supabase.from('sessions')
                .select('id, user_id, started_at, ended_at')
                .gte('started_at', weekStart.toISOString())
                .lte('started_at', weekEnd.toISOString())
                .order('started_at', { ascending: true });

            if (selectedMember !== 'all') {
                query = query.eq('user_id', selectedMember);
            }

            const { data: sessions, error: sessionErr } = await query;
            if (sessionErr) throw sessionErr;

            const { data: activityData, error: activityErr } = await supabase
                .from('activity_samples')
                .select('session_id, idle')
                .gte('recorded_at', weekStart.toISOString())
                .lte('recorded_at', weekEnd.toISOString());

            if (activityErr) throw activityErr;

            const dailyMap: Record<string, DailyEntry> = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                const key = d.toISOString().split('T')[0]!;
                dailyMap[key] = { date: key, sessions: [], totalMinutes: 0, activeMinutes: 0, activityPercent: 0 };
            }

            (sessions || []).forEach(s => {
                const key = s.started_at.split('T')[0]!;
                if (!dailyMap[key]) return;
                dailyMap[key].sessions.push(s as Session);
                const startMs = new Date(s.started_at).getTime();
                const { endMs } = effectiveEnd(s.started_at, s.ended_at);
                dailyMap[key].totalMinutes += Math.max(0, Math.round((endMs - startMs) / 60000));
            });

            const sessionDay: Record<string, string> = {};
            (sessions || []).forEach(s => { sessionDay[s.id] = s.started_at.split('T')[0]!; });

            (activityData || []).forEach(a => {
                const day = sessionDay[a.session_id];
                if (!day || !dailyMap[day]) return;
                if (!a.idle) dailyMap[day].activeMinutes++;
            });

            const result = Object.values(dailyMap).map(d => ({
                ...d,
                activityPercent: d.totalMinutes > 0
                    ? Math.min(100, Math.round((d.activeMinutes / d.totalMinutes) * 100))
                    : 0,
            }));

            setEntries(result);
        } catch (error) {
            console.error('Error fetching timesheets:', error);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }

    function effectiveEnd(startedAt: string, endedAt: string | null) {
        const startMs = new Date(startedAt).getTime();
        const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
        return { endMs };
    }

    const fmtHours = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h}h ${m < 10 ? '0' : ''}${m}m`;
    };

    const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    const totalMins = entries.reduce((a, e) => a + e.totalMinutes, 0);
    const avgActivity = entries.filter(e => e.totalMinutes > 0).length 
        ? Math.round(entries.reduce((a, e) => a + e.activityPercent, 0) / entries.filter(e => e.totalMinutes > 0).length) 
        : 0;

    return (
        <PageLayout 
            title="Efficiency Timeline" 
            description={`Detailed breakdown of productivity across the organization • ${weekLabel}`} 
            maxWidth="full"
            actions={
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <FilterSelect 
                        icon={<Users className="w-4 h-4" />}
                        value={selectedMember}
                        onChange={setSelectedMember}
                        options={[{ id: 'all', name: 'Universal Matrix' }, ...members.map(m => ({ id: m.id, name: m.full_name }))]}
                    />
                    
                    <div className="flex items-center gap-1 glass border border-black/[0.05] rounded-2xl p-1.5 shadow-xl">
                        <button onClick={() => setWeekOffset(w => w - 1)} className="p-3 hover:bg-black/[0.03] rounded-xl transition-all text-text-muted hover:text-primary group">
                            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" strokeWidth={3} />
                        </button>
                        <div className="px-8 flex items-center justify-center min-w-[220px]">
                            <span className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em] font-mono">
                                {weekLabel}
                            </span>
                        </div>
                        <button onClick={() => setWeekOffset(w => w + 1)} className="p-3 hover:bg-black/[0.03] rounded-xl transition-all text-text-muted hover:text-primary group">
                            <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" strokeWidth={3} />
                        </button>
                    </div>

                    {weekOffset !== 0 && (
                        <button 
                            onClick={() => setWeekOffset(0)}
                            className="px-8 py-4 glass border border-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.3em] text-primary hover:bg-primary/5 transition-all active:scale-95 shadow-lg border-primary/20 font-mono"
                        >
                            SYNC TO PRESENT
                        </button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <KpiCard icon={<Timer className="w-6 h-6" />} label="Total Registry Duration" value={loading ? '—' : fmtHours(totalMins)} trend="+15%" trendVariant="positive" />
                <KpiCard icon={<BarChart3 className="w-6 h-6" />} label="Engagement Intensity" value={loading ? '—' : `${avgActivity}%`} trend="+2%" trendVariant="positive" />
                <KpiCard icon={<CheckCircle2 className="w-6 h-6" />} label="Operational Capacity" value={loading ? '—' : entries.filter(e => e.totalMinutes > 0).length + ' / 7 days'} />
                <KpiCard icon={<Activity className="w-6 h-6" />} label="Validated Intervals" value={loading ? '—' : entries.reduce((a, e) => a + e.sessions.length, 0).toString()} trend="+42" trendVariant="positive" />
            </div>

            <Card title="Productivity Timeline Grid" noPadding className="overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-1000">
                {loading ? (
                    <div className="py-56 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-16 h-16 border-[5px] border-primary/10 border-t-primary rounded-full animate-spin shadow-lg" />
                            <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.4em] animate-pulse font-mono">Synchronizing Intelligence Registry...</span>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-7 divide-y md:divide-y-0 md:divide-x divide-black/[0.03] bg-white/[0.2]">
                        {entries.map((entry, i) => {
                            const d = new Date(entry.date + 'T12:00:00');
                            const isToday = d.toDateString() === today.toDateString();
                            const isFuture = d > today;
                            const hasData = entry.totalMinutes > 0;

                            return (
                                <div key={i} className={clsx(
                                    "p-10 flex flex-col min-h-[380px] transition-all duration-700 relative group overflow-hidden",
                                    isToday ? "bg-primary/[0.03] border-b-[10px] md:border-b-0 md:border-r-[10px] border-primary/20" : "hover:bg-white/[0.4]"
                                )}>
                                    <div className="mb-12 relative z-10">
                                        <span className={clsx(
                                            "text-[10px] font-black uppercase tracking-[0.3em] mb-3 block font-mono transition-colors",
                                            isToday ? "text-primary" : "text-text-muted group-hover:text-text-primary"
                                        )}>
                                            {DAYS_SHORT[d.getDay()]}
                                        </span>
                                        <div className={clsx(
                                            "text-5xl font-black font-head tracking-tighter transition-all duration-500 group-hover:scale-110 group-hover:translate-x-2 origin-left",
                                            isToday ? "text-text-primary" : "text-text-secondary group-hover:text-text-primary"
                                        )}>
                                            {d.getDate()}
                                        </div>
                                    </div>

                                    {isFuture ? (
                                        <div className="mt-auto opacity-20 flex flex-col gap-5">
                                            <div className="h-1.5 bg-black/10 rounded-full w-28" />
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted font-mono">No Projection</span>
                                        </div>
                                    ) : !hasData ? (
                                        <div className="mt-auto opacity-30 group-hover:opacity-70 transition-opacity">
                                            <div className="flex items-center gap-4 mb-5">
                                                <AlertCircle className="w-5 h-5 text-text-muted" strokeWidth={2.5} />
                                                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-text-muted font-mono">Matrix Idle</span>
                                            </div>
                                            <div className="h-1.5 bg-black/5 rounded-full w-full" />
                                        </div>
                                    ) : (
                                        <div className="flex flex-col gap-3 flex-1 relative z-10">
                                            <div className="text-4xl font-black text-text-primary font-mono tracking-tighter mb-1.5 group-hover:text-primary transition-colors">
                                                {fmtHours(entry.totalMinutes)}
                                            </div>
                                            <div className="text-[10px] font-black text-text-secondary mb-10 uppercase tracking-[0.2em] font-mono group-hover:text-text-primary transition-colors opacity-70">
                                                {entry.sessions.length} Protocol Sequence{entry.sessions.length !== 1 ? 's' : ''}
                                            </div>
                                            
                                            <div className="mt-auto space-y-6">
                                                <div className="h-2.5 bg-black/[0.03] rounded-full overflow-hidden p-[1px] shadow-inner">
                                                    <div
                                                        className="h-full rounded-full transition-all duration-[2000ms] ease-out shadow-sm"
                                                        style={{
                                                            width: `${entry.activityPercent}%`,
                                                            backgroundColor: entry.activityPercent > 70 ? '#10b981' : entry.activityPercent > 40 ? '#f59e0b' : '#ef4444',
                                                            boxShadow: `0 0 15px ${entry.activityPercent > 70 ? '#10b98140' : entry.activityPercent > 40 ? '#f59e0ba0' : '#ef4444a0'}`
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Activity className={clsx(
                                                            "w-4 h-4",
                                                            entry.activityPercent > 70 ? "text-emerald-500" : entry.activityPercent > 40 ? "text-amber-500" : "text-rose-500"
                                                        )} strokeWidth={3} />
                                                        <span className="text-[9px] font-black text-text-muted uppercase tracking-[0.3em] font-mono">Intensity</span>
                                                    </div>
                                                    <span className="text-[11px] font-black text-text-primary uppercase tracking-widest leading-none bg-black/[0.03] px-3 py-1.5 rounded-lg border border-black/[0.03] font-mono">{entry.activityPercent}%</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {/* Subtle background glow on hover */}
                                    <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 blur-[100px] rounded-full -mr-24 -mt-24 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </PageLayout>
    );
}

function FilterSelect({ icon, value, onChange, options }: { icon: React.ReactNode; value: string; onChange: (val: string) => void; options: { id: string; name: string }[] }) {
    const activeLabel = options.find(o => o.id === value)?.name || value;
    
    return (
        <div className="relative group/select">
            <div className="flex items-center gap-3.5 glass border border-black/[0.05] rounded-2xl px-6 py-4 shadow-xl transition-all group-hover/select:border-primary/50 cursor-pointer shadow-black/[0.02]">
                <div className="text-primary group-hover/select:scale-110 transition-transform">{icon}</div>
                <span className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] min-w-[150px] font-mono">{activeLabel}</span>
                <ChevronDown className="w-4.5 h-4.5 text-text-muted group-hover/select:text-text-primary transition-all group-hover/select:rotate-180" strokeWidth={3} />
            </div>
            
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            >
                {options.map(o => (
                    <option key={o.id} value={o.id} className="bg-white text-text-primary">{o.name}</option>
                ))}
            </select>
        </div>
    );
}
