import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Monitor, Camera, Download, 
    Clock, Activity as ActivityIcon, Users,
    ChevronDown, Zap, RefreshCw
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { PageLayout, Card, KpiCard } from '../components/ui';
import clsx from 'clsx';

const COLORS = ['#506ef8', '#818cf8', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
const RANGES = ['Today', 'Last 7 Days', 'Last 30 Days'] as const;
type Range = typeof RANGES[number];

export function Reports() {
    const [range, setRange] = useState<Range>('Last 7 Days');
    const [loading, setLoading] = useState(true);
    const [dailyActivity, setDailyActivity] = useState<{ date: string; activity: number; minutes: number }[]>([]);
    const [appBreakdown, setAppBreakdown] = useState<{ name: string; value: number }[]>([]);
    const [screenshotCount, setScreenshotCount] = useState(0);
    const [totalSessions, setTotalSessions] = useState(0);
    const [totalMins, setTotalMins] = useState(0);
    const [avgActivity, setAvgActivity] = useState(0);

    // Team & Member filtering
    const [teams, setTeams] = useState<{ id: string; name: string }[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<string>('All');
    const [members, setMembers] = useState<{ id: string; email: string; full_name: string }[]>([]);
    const [selectedMemberEmail, setSelectedMemberEmail] = useState<string>('All');

    useEffect(() => {
        fetchTeams();
        fetchMembers();
    }, []);

    useEffect(() => {
        fetchReports();
    }, [range, selectedTeamId, selectedMemberEmail]);

    async function fetchTeams() {
        const { data } = await supabase.from('teams').select('id, name');
        if (data) setTeams(data);
    }

    async function fetchMembers() {
        const { data } = await supabase.from('members').select('id, email, full_name').eq('status', 'Active');
        if (data) setMembers(data);
    }

    function getDateRange(): { start: string; end: string } {
        const now = new Date();
        const end = now.toISOString();
        let start: Date;
        if (range === 'Today') {
            start = new Date(now.setHours(0, 0, 0, 0));
        } else if (range === 'Last 7 Days') {
            start = new Date(Date.now() - 7 * 86400000);
        } else {
            start = new Date(Date.now() - 30 * 86400000);
        }
        return { start: start.toISOString(), end };
    }

    async function fetchReports() {
        setLoading(true);
        const { start, end } = getDateRange();

        let emails: string[] = [];

        if (selectedMemberEmail !== 'All') {
            emails = [selectedMemberEmail];
        } else if (selectedTeamId !== 'All') {
            const { data: tm } = await supabase.from('team_members').select('member_id').eq('team_id', selectedTeamId);
            const memberIds = tm?.map(t => t.member_id) || [];
            if (memberIds.length > 0) {
                const { data: m } = await supabase.from('members').select('email').in('id', memberIds);
                emails = m?.map(x => x.email) || [];
            }
        }

        if ((selectedMemberEmail !== 'All' || selectedTeamId !== 'All') && emails.length === 0) {
            setDailyActivity([]);
            setAppBreakdown([]);
            setTotalSessions(0);
            setScreenshotCount(0);
            setTotalMins(0);
            setAvgActivity(0);
            setLoading(false);
            return;
        }

        let samplesQuery = supabase.from('activity_samples').select('*').gte('recorded_at', start).lte('recorded_at', end);
        let sessionsQuery = supabase.from('sessions').select('id, user_id').gte('started_at', start).lte('started_at', end);
        let ssQuery = supabase.from('screenshots').select('id', { count: 'exact', head: true }).gte('recorded_at', start).lte('recorded_at', end);

        if (emails.length > 0) {
            samplesQuery = samplesQuery.in('user_id', emails);
            sessionsQuery = sessionsQuery.in('user_id', emails);
            ssQuery = ssQuery.in('user_id', emails);
        }

        try {
            const [{ data: samples }, { data: sessions }, { count: ssCount }] = await Promise.all([
                samplesQuery,
                sessionsQuery,
                ssQuery,
            ]);

            const allSamples = samples || [];

            const dailyMap: Record<string, { total: number; active: number }> = {};
            allSamples.forEach(s => {
                const day = s.recorded_at.split('T')[0];
                if (!dailyMap[day]) dailyMap[day] = { total: 0, active: 0 };
                dailyMap[day].total++;
                if (!s.idle) dailyMap[day].active++;
            });
            setDailyActivity(Object.entries(dailyMap).sort().map(([date, v]) => ({
                date: new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                activity: v.total > 0 ? Math.round((v.active / v.total) * 100) : 0,
                minutes: v.total,
            })));

            const appMap: Record<string, number> = {};
            allSamples.forEach(s => {
                const app = s.app_name || 'Unknown';
                appMap[app] = (appMap[app] || 0) + 1;
            });
            setAppBreakdown(
                Object.entries(appMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }))
            );

            setTotalSessions((sessions || []).length);
            setScreenshotCount(ssCount || 0);
            setTotalMins(allSamples.length);
            setAvgActivity(
                allSamples.length > 0
                    ? Math.round(allSamples.reduce((a, b) => a + b.activity_percent, 0) / allSamples.length)
                    : 0
            );
        } catch (err) {
            console.error("fetchReports unhandled error:", err);
        } finally {
            setLoading(false);
        }
    }

    const fmtHours = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${h}h ${m}m`;
    };

    return (
        <PageLayout
            title="Intelligence Matrix"
            description="Predictive productivity insights and workforce engagement analytics."
            maxWidth="full"
            actions={
                <div className="flex flex-wrap items-center gap-6">
                    <div className="flex items-center gap-2 bg-black/[0.02] border border-black/[0.05] p-1.5 rounded-[24px] shadow-inner">
                        {RANGES.map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={clsx(
                                    "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono",
                                    range === r ? "bg-white text-primary shadow-sm ring-1 ring-black/[0.05]" : "text-text-muted hover:text-text-primary"
                                )}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <FilterSelect 
                            icon={<Users className="w-4 h-4" strokeWidth={3} />}
                            value={selectedTeamId}
                            onChange={(val) => { setSelectedTeamId(val); setSelectedMemberEmail('All'); }}
                            options={[{ id: 'All', name: 'Global Units' }, ...teams]}
                        />
                        <FilterSelect 
                            icon={<ActivityIcon className="w-4 h-4" strokeWidth={3} />}
                            value={selectedMemberEmail}
                            onChange={(val) => { setSelectedMemberEmail(val); setSelectedTeamId('All'); }}
                            options={[{ id: 'All', email: 'All', full_name: 'Universal Nodes' }, ...members].map(m => ({ id: (m as any).email || m.id, name: (m as any).full_name || (m as any).name }))}
                        />
                        <button className="p-4 bg-white border border-black/[0.1] rounded-[20px] text-text-muted hover:text-primary hover:border-primary transition-all active:scale-95 shadow-sm group">
                            <Download className="w-5 h-5 group-hover:scale-110 transition-transform" strokeWidth={2.5} />
                        </button>
                    </div>
                </div>
            }
        >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                <KpiCard
                    icon={<Clock className="w-7 h-7" strokeWidth={2.5} />}
                    label="Tracked Capacity"
                    value={fmtHours(totalMins)}
                    sub="Cumulative operational time"
                    trend="+12%"
                    trendVariant="positive"
                />
                <KpiCard
                    icon={<ActivityIcon className="w-7 h-7" strokeWidth={2.5} />}
                    label="Performance Index"
                    value={`${avgActivity}%`}
                    sub="Effective output ratio"
                    trend="+4%"
                    trendVariant="positive"
                />
                <KpiCard
                    icon={<Monitor className="w-7 h-7" strokeWidth={2.5} />}
                    label="Active Sessions"
                    value={totalSessions.toString()}
                    sub="Unique pulse initiations"
                    trend="+2"
                    trendVariant="positive"
                />
                <KpiCard
                    icon={<Camera className="w-7 h-7" strokeWidth={2.5} />}
                    label="Proof of Work"
                    value={screenshotCount.toString()}
                    sub="Visual validation count"
                    trend="+45"
                    trendVariant="positive"
                />
            </div>

            {loading ? (
                <div className="h-[600px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-6">
                        <RefreshCw className="w-12 h-12 text-primary animate-spin" strokeWidth={3} />
                        <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.5em] animate-pulse font-mono">Aggregating Intelligence Matrix...</span>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                    <div className="lg:col-span-2 space-y-10">
                        <Card title="Productivity Trajectory">
                            <div className="h-[400px] w-full mt-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={dailyActivity} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#506ef8" stopOpacity={0.15} />
                                                <stop offset="95%" stopColor="#506ef8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'rgba(41,61,99,0.4)', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}
                                            dy={15}
                                        />
                                        <YAxis 
                                            domain={[0, 100]} 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'rgba(41,61,99,0.4)', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}
                                            unit="%"
                                        />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(80,110,248,0.2)', strokeWidth: 2 }} />
                                        <Area 
                                            type="monotone" 
                                            dataKey="activity" 
                                            stroke="#506ef8" 
                                            strokeWidth={5}
                                            fillOpacity={1} 
                                            fill="url(#colorActivity)" 
                                            animationDuration={2500}
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>

                        <Card title="Operational Intensity">
                            <div className="h-[350px] w-full mt-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dailyActivity} barSize={36}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.03)" />
                                        <XAxis 
                                            dataKey="date" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'rgba(41,61,99,0.4)', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}
                                            dy={15}
                                        />
                                        <YAxis 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: 'rgba(41,61,99,0.4)', fontSize: 10, fontWeight: 900, fontFamily: 'monospace' }}
                                        />
                                        <Tooltip content={<CustomTooltip unit="min" />} cursor={{ fill: 'rgba(80,110,248,0.03)' }} />
                                        <Bar 
                                            dataKey="minutes" 
                                            fill="url(#barGradient)" 
                                            radius={[12, 12, 0, 0]}
                                            animationDuration={2500}
                                        />
                                        <defs>
                                            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#506ef8" />
                                                <stop offset="100%" stopColor="#818cf8" />
                                            </linearGradient>
                                        </defs>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Card>
                    </div>

                    <div className="space-y-10">
                        <Card title="App Ecosystem Map" className="flex flex-col h-full">
                            <div className="flex-1 min-h-[450px] flex flex-col items-center justify-center py-12">
                                <div className="h-[300px] w-full relative">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={appBreakdown}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={90}
                                                outerRadius={125}
                                                paddingAngle={6}
                                                dataKey="value"
                                                animationDuration={2500}
                                            >
                                                {appBreakdown.map((_, i) => (
                                                    <Cell key={i} fill={COLORS[i % COLORS.length]} strokeWidth={0} />
                                                ))}
                                            </Pie>
                                            <Tooltip content={<CustomTooltip />} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                        <span className="text-5xl font-black text-text-primary tracking-tighter leading-none">{appBreakdown.length}</span>
                                        <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono mt-1">Prime Nodes</span>
                                    </div>
                                </div>

                                <div className="w-full mt-14 space-y-4">
                                    {appBreakdown.map((item, i) => (
                                        <div key={i} className="flex items-center justify-between group cursor-default p-2 rounded-xl hover:bg-black/[0.01] transition-all">
                                            <div className="flex items-center gap-5">
                                                <div className="w-3.5 h-3.5 rounded-full shadow-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                <span className="text-[12px] font-black text-text-primary tracking-tight truncate max-w-[180px] uppercase font-mono italic">{item.name}</span>
                                            </div>
                                            <span className="text-[9px] font-black text-text-muted bg-black/[0.03] px-3 py-1.5 rounded-lg uppercase tracking-widest font-mono border border-black/[0.03]">
                                                {item.value} Pulse
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </Card>

                        <div className="bg-white border border-black/[0.05] overflow-hidden rounded-[48px] relative group p-12 shadow-2xl">
                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-10">
                                    <div className="bg-primary/10 p-4 rounded-[24px] border border-primary/20 shadow-sm rotate-3 group-hover:rotate-0 transition-transform duration-700">
                                        <Zap className="w-8 h-8 text-primary" strokeWidth={2.5} />
                                    </div>
                                    <span className="text-[10px] font-black bg-black/[0.03] px-4 py-2 rounded-full tracking-[0.2em] uppercase border border-black/[0.05] font-mono italic">
                                        Active Matrix
                                    </span>
                                </div>
                                <h4 className="text-text-muted font-black uppercase tracking-[0.4em] text-[11px] mb-3 font-mono opacity-60">Efficiency Rating</h4>
                                <div className="flex items-baseline gap-4 mb-8">
                                    <span className="text-7xl font-black tracking-tighter text-text-primary leading-none italic">{avgActivity}</span>
                                    <span className="text-3xl font-black text-text-muted/30 tracking-tight font-mono">/ 100</span>
                                </div>
                                <p className="text-sm font-black text-text-primary leading-relaxed mb-10 opacity-80 uppercase tracking-tight">
                                    {selectedTeamId === 'All' ? 'Global operations' : 'Targeted unit'} efficiency is currently <span className="text-primary underline underline-offset-4 decoration-primary/30">optimal</span>. 
                                </p>
                                <div className="w-full h-4 bg-black/[0.05] rounded-full overflow-hidden border border-black/[0.03] shadow-inner">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-[2500ms] shadow-[0_0_25px_rgba(80,110,248,0.4)]"
                                        style={{ width: `${avgActivity}%` }}
                                    />
                                </div>
                            </div>
                            
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/[0.03] rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none group-hover:bg-primary/[0.06] transition-colors duration-1000" />
                        </div>
                    </div>
                </div>
            )}
        </PageLayout>
    );
}

function FilterSelect({ icon, value, onChange, options }: { icon: React.ReactNode; value: string; onChange: (val: string) => void; options: { id: string; name: string }[] }) {
    const activeLabel = options.find(o => o.id === value)?.name || value;
    
    return (
        <div className="relative group/select">
            <div className="flex items-center gap-4 bg-white border border-black/[0.1] rounded-[20px] px-6 py-4 shadow-sm transition-all group-hover/select:border-primary/40 group-hover/select:shadow-md cursor-pointer">
                <div className="text-primary group-hover/select:scale-110 group-hover/select:rotate-12 transition-all duration-500">{icon}</div>
                <span className="text-[11px] font-black text-text-primary uppercase tracking-[0.2em] font-mono min-w-[140px] truncate">{activeLabel}</span>
                <ChevronDown className="w-4 h-4 text-text-muted group-hover/select:text-primary transition-all group-hover/select:rotate-180" strokeWidth={3} />
            </div>
            
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            >
                {options.map(o => (
                    <option key={o.id} value={o.id} className="text-text-primary">{o.name}</option>
                ))}
            </select>
        </div>
    );
}

function CustomTooltip({ active, payload, label, unit }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white border border-black/[0.08] p-8 rounded-[32px] shadow-[0_32px_80px_rgba(0,0,0,0.12)] animate-in zoom-in-95 duration-300">
                <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono mb-4 border-b border-black/[0.03] pb-3 italic opacity-60 text-right">{label}</p>
                <div className="flex items-center gap-6">
                    <div className="w-4 h-4 rounded-full bg-primary shadow-xl shadow-primary/40" />
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-text-primary tracking-tighter italic">
                            {payload[0].value}
                        </span>
                        <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em] font-mono">
                            {unit === 'min' ? 'Minutes' : 'Percent'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
}
