import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Clock, Users, FolderOpen, CircleDollarSign, 
    Activity, Camera, Zap, ChevronRight, 
    ArrowUpRight, BarChart3, Globe
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { PageLayout, Card, KpiCard, EmptyState, LoadingState } from './ui';
import clsx from 'clsx';

interface DashStats {
    todayMinutes: number;
    weekMinutes: number;
    weekCost: number;
    activeMembers: number;
    activeProjects: number;
    screenshotCount: number;
}

interface ProjectStat {
    id: string;
    name: string;
    minutes: number;
    color: string;
}

interface DayBar {
    day: string;
    minutes: number;
}

// Light-friendly vibrant palette
const PROJECT_COLORS = ['#506ef8', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

function effectiveEnd(startedAt: string, endedAt: string | null): { endMs: number; isLive: boolean; isStale: boolean } {
    const startMs = new Date(startedAt).getTime();
    if (endedAt) return { endMs: new Date(endedAt).getTime(), isLive: false, isStale: false };
    const now = Date.now();
    if (now - startMs > STALE_THRESHOLD_MS) {
        return { endMs: startMs, isLive: false, isStale: true };
    }
    return { endMs: now, isLive: true, isStale: false };
}

function fmtTime(min: number) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return h > 0 ? `${h}h ${m < 10 ? '0' : ''}${m}m` : `${m}m`;
}

export function Dashboard() {
    const [stats, setStats] = useState<DashStats>({
        todayMinutes: 0, weekMinutes: 0, weekCost: 0,
        activeMembers: 0, activeProjects: 0, screenshotCount: 0,
    });
    const [projects, setProjects] = useState<ProjectStat[]>([]);
    const [weekBars, setWeekBars] = useState<DayBar[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchDashboard(); }, []);

    async function fetchDashboard() {
        try {
            setLoading(true);
            const now = new Date();
            const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
            const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);

            const [
                { data: rawSessions },
                { data: projectsData },
                { data: membersData },
                { count: ssCount },
            ] = await Promise.all([
                supabase.from('sessions').select('id, user_id, project_id, started_at, ended_at').gte('started_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()),
                supabase.from('projects').select('id, name, color'),
                supabase.from('members').select('id, pay_rate'),
                supabase.from('screenshots').select('id', { count: 'exact', head: true }).gte('recorded_at', weekStart.toISOString()),
            ]);

            const todaySessions = (rawSessions || []).filter(s => new Date(s.started_at) >= todayStart);
            const weekSessions = (rawSessions || []).filter(s => new Date(s.started_at) >= weekStart);

            const todayMins = (todaySessions || []).reduce((acc, s) => {
                const start = new Date(s.started_at).getTime();
                const { endMs } = effectiveEnd(s.started_at, s.ended_at);
                return acc + Math.max(0, Math.round((endMs - start) / 60000));
            }, 0);

            const memberRateMap: Record<string, number> = {};
            (membersData || []).forEach(m => { memberRateMap[m.id] = m.pay_rate ?? 0; });

            let weekMins = 0;
            let weekCost = 0;
            const projectMinMap: Record<string, number> = {};
            const dayMinMap: number[] = Array(7).fill(0);
            const uniqueMembers = new Set<string>();
            const uniqueProjects = new Set<string>();

            (weekSessions || []).forEach(s => {
                const start = new Date(s.started_at).getTime();
                const { endMs } = effectiveEnd(s.started_at, s.ended_at);
                const mins = Math.max(0, Math.round((endMs - start) / 60000));
                weekMins += mins;

                if (s.user_id) {
                    uniqueMembers.add(s.user_id);
                    const rate = memberRateMap[s.user_id] ?? 0;
                    weekCost += (mins / 60) * rate;
                }

                if (s.project_id) {
                    uniqueProjects.add(s.project_id);
                    projectMinMap[s.project_id] = (projectMinMap[s.project_id] || 0) + mins;
                }

                const dayIdx = new Date(s.started_at).getDay();
                dayMinMap[dayIdx] = (dayMinMap[dayIdx] || 0) + mins;
            });

            const projectMap: Record<string, string> = {};
            const projectColorMap: Record<string, string> = {};
            (projectsData || []).forEach((p, i) => {
                projectMap[p.id] = p.name;
                projectColorMap[p.id] = p.color || PROJECT_COLORS[i % PROJECT_COLORS.length]!;
            });

            const projectStats: ProjectStat[] = Object.entries(projectMinMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([id, minutes], i) => ({
                    id,
                    name: projectMap[id] || 'Unknown',
                    minutes,
                    color: projectColorMap[id] || PROJECT_COLORS[i % PROJECT_COLORS.length]!,
                }));

            const bars: DayBar[] = DAYS_SHORT.map((day, i) => ({
                day,
                minutes: dayMinMap[i] || 0,
            }));

            setStats({
                todayMinutes: todayMins,
                weekMinutes: weekMins,
                weekCost: Math.round(weekCost * 100) / 100,
                activeMembers: uniqueMembers.size,
                activeProjects: uniqueProjects.size,
                screenshotCount: ssCount || 0,
            });
            setProjects(projectStats);
            setWeekBars(bars);
        } catch (error) {
            console.error("fetchDashboard unhandled error:", error);
        } finally {
            setLoading(false);
        }
    }

    const maxProjectMins = projects[0]?.minutes || 1;
    const today = new Date();
    const weekLabel = `${new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return (
        <PageLayout title="Command Center" description={`Global operational metrics • ${weekLabel}`} maxWidth="full">
            {/* KPI Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-6 mb-10 animate-in slide-in-from-top-4 duration-700">
                <KpiCard icon={<Clock className="w-5 h-5" />} label="Tracked Today" value={loading ? '—' : fmtTime(stats.todayMinutes)} trend="+14%" trendVariant="positive" />
                <KpiCard icon={<BarChart3 className="w-5 h-5" />} label="Weekly Volume" value={loading ? '—' : fmtTime(stats.weekMinutes)} trend="+8%" trendVariant="positive" />
                <KpiCard icon={<CircleDollarSign className="w-5 h-5" />} label="Cost Projection" value={loading ? '—' : `$${stats.weekCost.toLocaleString()}`} trend="-2%" trendVariant="negative" />
                <KpiCard icon={<Users className="w-5 h-5" />} label="Active Units" value={loading ? '—' : stats.activeMembers.toString()} sub="Total personnel" />
                <KpiCard icon={<Globe className="w-5 h-5" />} label="Active Clusters" value={loading ? '—' : stats.activeProjects.toString()} sub="Project nodes" />
                <KpiCard icon={<Camera className="w-5 h-5" />} label="Visual Validation" value={loading ? '—' : stats.screenshotCount.toString()} trend="+124" trendVariant="positive" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
                {/* Weekly Trends */}
                <div className="lg:col-span-8">
                    <Card title="Engagement Velocity Trend">
                        {loading ? (
                            <LoadingState className="h-[300px]" />
                        ) : (
                            <div className="h-[300px] w-full mt-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={weekBars} barSize={32}>
                                        <defs>
                                            <linearGradient id="dashBarGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#506ef8" />
                                                <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.4} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(41, 61, 99, 0.05)" />
                                        <XAxis 
                                            dataKey="day" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#5c6b8a', fontSize: 10, fontWeight: 900 }}
                                            dy={15}
                                        />
                                        <YAxis hide />
                                        <Tooltip 
                                            cursor={{ fill: 'rgba(80, 110, 248, 0.02)' }}
                                            content={({ active, payload }) => {
                                                if (active && payload && payload.length) {
                                                    return (
                                                        <div className="glass border border-primary/10 rounded-2xl px-5 py-4 shadow-xl">
                                                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1.5 font-mono">{payload[0].payload.day}</p>
                                                            <p className="text-xl font-black text-text-primary tracking-tighter leading-none">{fmtTime(payload[0].value as number)}</p>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            }}
                                        />
                                        <Bar dataKey="minutes" fill="url(#dashBarGrad)" radius={[10, 10, 0, 0]} animationDuration={2000} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                        <div className="flex items-center justify-center gap-8 mt-10 pt-10 border-t border-black/[0.03] font-mono text-[9px] uppercase tracking-[0.3em] font-black text-text-muted/60">
                            <div className="flex items-center gap-2.5"><div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" /> Pulse Velocity</div>
                            <div className="flex items-center gap-2.5"><div className="w-2.5 h-2.5 rounded-full bg-black/5" /> Target Baseline</div>
                        </div>
                    </Card>
                </div>

                {/* Projects Allocation */}
                <div className="lg:col-span-4">
                    <Card title="Project Distribution">
                        {loading ? (
                            <LoadingState className="h-[300px]" />
                        ) : projects.length === 0 ? (
                            <EmptyState icon={<FolderOpen className="w-10 h-10 opacity-20" />} title="No Data" description="Registry is void of activity" />
                        ) : (
                            <div className="space-y-8 mt-4">
                                {projects.map((p) => (
                                    <div key={p.id} className="group cursor-default">
                                        <div className="flex items-center justify-between mb-3.5">
                                            <div className="flex items-center gap-3.5">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-[11px] font-black shadow-lg shadow-black/5 group-hover:scale-110 transition-transform"
                                                    style={{ backgroundColor: p.color }}>
                                                    {p.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm font-black text-text-primary tracking-tight group-hover:text-primary transition-colors leading-none">{p.name}</span>
                                            </div>
                                            <span className="text-[10px] font-black text-text-secondary bg-black/[0.03] px-3.5 py-1.5 rounded-xl uppercase tracking-widest font-mono border border-black/[0.03]">
                                                {fmtTime(p.minutes)}
                                            </span>
                                        </div>
                                        <div className="h-2 bg-black/[0.03] rounded-full overflow-hidden w-full p-[1px]">
                                            <div 
                                                className="h-full rounded-full transition-all duration-1000 ease-out"
                                                style={{ 
                                                    width: `${Math.round((p.minutes / maxProjectMins) * 100)}%`, 
                                                    backgroundColor: p.color,
                                                    boxShadow: `0 0 12px ${p.color}20`
                                                }} 
                                            />
                                        </div>
                                    </div>
                                ethnic))}
                            </div>
                        )}
                        <button className="w-full mt-10 py-4 glass border border-primary/10 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-text-muted hover:text-primary hover:bg-primary/5 transition-all flex items-center justify-center gap-3 group shadow-sm font-mono">
                            CLUSTER ANALYSIS
                            <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" strokeWidth={2.5} />
                        </button>
                    </Card>
                </div>
            </div>

            {/* Recent Sessions */}
            <Card title="Operational Pulse" noPadding>
                <div className="divide-y divide-black/[0.03] overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                            <tr className="bg-black/[0.01]">
                                <th className="px-10 py-7 text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Designated Member</th>
                                <th className="px-10 py-7 text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Active Cluster</th>
                                <th className="px-10 py-7 text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Protocol Start</th>
                                <th className="px-10 py-7 text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">Session Intensity</th>
                                <th className="px-10 py-7 text-[10px] font-black text-text-muted uppercase tracking-[0.3em] text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03]">
                            <RecentSessionsRows />
                        </tbody>
                    </table>
                </div>
            </Card>
        </PageLayout>
    );
}

function RecentSessionsRows() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [memberMap, setMemberMap] = useState<Record<string, string>>({});
    const [projectMap, setProjectMap] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [{ data }, { data: membersData }, { data: projectsData }] = await Promise.all([
                    supabase.from('sessions').select('id, user_id, project_id, started_at, ended_at').order('started_at', { ascending: false }).limit(6),
                    supabase.from('members').select('id, full_name'),
                    supabase.from('projects').select('id, name, color'),
                ]);
                setSessions(data || []);
                const mMap: Record<string, string> = {};
                (membersData || []).forEach(m => { mMap[m.id] = m.full_name; });
                setMemberMap(mMap);
                const pMap: Record<string, any> = {};
                (projectsData || []).forEach(p => { pMap[p.id] = p; });
                setProjectMap(pMap);
            } catch (err) {
                console.error("RecentSessions Error:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <tr><td colSpan={5} className="py-24 text-center"><LoadingState /></td></tr>;
    if (sessions.length === 0) return <tr><td colSpan={5} className="py-24 text-center opacity-40"><EmptyState icon={<Zap className="w-10 h-10" />} /></td></tr>;

    return (
        <>
            {sessions.map(s => {
                const startMs = new Date(s.started_at).getTime();
                const { endMs, isLive, isStale } = effectiveEnd(s.started_at, s.ended_at);
                const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
                const memberName = (s.user_id && memberMap[s.user_id]) || 'System Entity';
                const proj = s.project_id && projectMap[s.project_id];

                return (
                    <tr key={s.id} className="group hover:bg-black/[0.01] transition-all">
                        <td className="px-10 py-7">
                            <div className="flex items-center gap-4">
                                <div className="w-11 h-11 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary font-black text-[12px] group-hover:scale-110 transition-transform shadow-sm">
                                    {memberName.charAt(0)}
                                </div>
                                <div>
                                    <div className="font-black text-text-primary text-[15px] tracking-tight leading-none group-hover:text-primary transition-colors mb-1.5">{memberName}</div>
                                    <div className="text-[9px] font-black text-text-muted uppercase tracking-[0.2em] font-mono opacity-70">UID: {s.user_id?.slice(0, 8) || 'SYSTEM'}</div>
                                </div>
                            </div>
                        </td>
                        <td className="px-10 py-7">
                            {proj ? (
                                <div className="flex items-center gap-3">
                                    <div className="w-2.5 h-2.5 rounded-full shadow-lg" style={{ backgroundColor: proj.color, boxShadow: `0 0 10px ${proj.color}40` }} />
                                    <span className="text-[11px] font-black text-text-secondary uppercase tracking-[0.2em] font-mono">{proj.name}</span>
                                </div>
                            ) : (
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40 font-mono">Unassigned Node</span>
                            )}
                        </td>
                        <td className="px-10 py-7 text-[11px] font-black text-text-muted uppercase tracking-[0.2em] font-mono group-hover:text-text-primary transition-colors">
                            {new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-10 py-7">
                            <span className="text-base font-black text-text-primary font-mono tracking-tighter">
                                {isStale ? '0h 00m' : fmtTime(mins)}
                            </span>
                        </td>
                        <td className="px-10 py-7 text-right">
                            {isLive ? (
                                <span className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-emerald-600 bg-emerald-500/5 border border-emerald-500/10 shadow-sm font-mono">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                    Active Stream
                                </span>
                            ) : isStale ? (
                                <span className="inline-flex items-center gap-3 px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 bg-amber-500/5 border border-amber-500/10 font-mono">
                                    Sync Lost
                                </span>
                            ) : (
                                <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] opacity-40 font-mono">Recorded</span>
                            )}
                        </td>
                    </tr>
                );
            })}
        </>
    );
}
