import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Users, FolderOpen, CircleDollarSign, Activity, Camera } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';
import { PageLayout, Card, KpiCard, EmptyState, LoadingState } from './ui';

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

const PROJECT_COLORS = ['#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Sessions with no ended_at that started more than this many ms ago are considered stale/orphaned.
const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Returns the effective end time for a session. Stale open sessions use their start time (0 duration). */
function effectiveEnd(startedAt: string, endedAt: string | null): { endMs: number; isLive: boolean; isStale: boolean } {
    const startMs = new Date(startedAt).getTime();
    if (endedAt) return { endMs: new Date(endedAt).getTime(), isLive: false, isStale: false };
    const now = Date.now();
    if (now - startMs > STALE_THRESHOLD_MS) {
        // Orphaned session — treat as ended at start (duration = 0) and not live
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

            // Fetch all recent data first to avoid timezone timezone stripping issues in Supabase queries.
            // We will filter exactly on the client side to guarantee correctness.
            const [
                { data: rawSessions, error: sessionErr },
                { data: projectsData, error: projErr },
                { data: membersData, error: memErr },
                { count: ssCount, error: ssErr },
            ] = await Promise.all([
                // Get past 14 days of sessions to guarantee we have all 'this week' data regardless of TZ diff
                supabase.from('sessions').select('id, user_id, project_id, started_at, ended_at').gte('started_at', new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()),
                supabase.from('projects').select('id, name, color'),
                supabase.from('members').select('id, pay_rate'),
                supabase.from('screenshots').select('id', { count: 'exact', head: true }).gte('recorded_at', weekStart.toISOString()),
            ]);

            if (sessionErr) console.error("Session Error:", sessionErr);
            if (projErr) console.error("Project Error:", projErr);
            if (memErr) console.error("Member Error:", memErr);
            if (ssErr) console.error("Screenshot Error:", ssErr);

            const todaySessions = (rawSessions || []).filter(s => new Date(s.started_at) >= todayStart);
            const weekSessions = (rawSessions || []).filter(s => new Date(s.started_at) >= weekStart);

            // Today minutes
            const todayMins = (todaySessions || []).reduce((acc, s) => {
                const start = new Date(s.started_at).getTime();
                const { endMs } = effectiveEnd(s.started_at, s.ended_at);
                return acc + Math.max(0, Math.round((endMs - start) / 60000));
            }, 0);

            // Week minutes + cost per member
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

            // Project breakdown
            const projectMap: Record<string, string> = {};
            const projectColorMap: Record<string, string> = {};
            (projectsData || []).forEach((p, i) => {
                projectMap[p.id] = p.name;
                projectColorMap[p.id] = p.color || PROJECT_COLORS[i % PROJECT_COLORS.length]!;
            });

            const projectStats: ProjectStat[] = Object.entries(projectMinMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([id, minutes], i) => ({
                    id,
                    name: projectMap[id] || 'Unknown',
                    minutes,
                    color: projectColorMap[id] || PROJECT_COLORS[i % PROJECT_COLORS.length]!,
                }));

            // Week bar chart — reorder to Mon–Sun with today highlighted
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
        <PageLayout title="Dashboard" description={weekLabel} maxWidth="full">
            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <KpiCard icon={<Clock className="w-4 h-4 text-primary" />} label="Today" value={loading ? '—' : fmtTime(stats.todayMinutes)} />
                <KpiCard icon={<Clock className="w-4 h-4 text-primary" />} label="This Week" value={loading ? '—' : fmtTime(stats.weekMinutes)} />
                <KpiCard icon={<CircleDollarSign className="w-4 h-4 text-primary" />} label="Week Cost" value={loading ? '—' : `$${stats.weekCost.toFixed(2)}`} />
                <KpiCard icon={<Users className="w-4 h-4 text-primary" />} label="Active Members" value={loading ? '—' : stats.activeMembers.toString()} />
                <KpiCard icon={<FolderOpen className="w-4 h-4 text-primary" />} label="Projects" value={loading ? '—' : stats.activeProjects.toString()} />
                <KpiCard icon={<Camera className="w-4 h-4 text-primary" />} label="Screenshots" value={loading ? '—' : stats.screenshotCount.toString()} />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Projects */}
                <Card title="Projects This Week" className="lg:col-span-2">
                    {loading ? (
                        <LoadingState className="min-h-[12rem]" />
                    ) : projects.length === 0 ? (
                        <EmptyState
                            icon={<FolderOpen className="w-6 h-6" />}
                            title="No tracked sessions this week"
                            description="Start a tracking session in the Electron app to see data here."
                            className="min-h-[12rem]"
                        />
                    ) : (
                        <div className="space-y-3">
                            {projects.map((p) => (
                                <div key={p.id} className="flex items-center gap-4 group">
                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                                        style={{ backgroundColor: p.color }}>
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium text-text-primary truncate">{p.name}</span>
                                            <span className="text-xs text-text-muted ml-3 shrink-0">{fmtTime(p.minutes)}</span>
                                        </div>
                                        <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all"
                                                style={{ width: `${Math.round((p.minutes / maxProjectMins) * 100)}%`, backgroundColor: p.color }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </Card>

                {/* Weekly bars */}
                <Card title="This Week" className="flex flex-col">
                    {loading ? (
                        <LoadingState className="flex-1 min-h-[12rem]" />
                    ) : (
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={weekBars} barSize={20}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip
                                        formatter={(v: number | undefined) => [fmtTime(v ?? 0), 'Tracked']}
                                        contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                                    />
                                    <Bar dataKey="minutes" fill="var(--color-primary)" radius={[4, 4, 0, 0]}
                                        label={false} />
                                </BarChart>
                            </ResponsiveContainer>
                            {/* Today highlight */}
                            <p className="text-xs text-text-muted text-center mt-2">
                                Today: <span className="font-semibold text-primary">{DAYS_SHORT[today.getDay()]}</span>
                            </p>
                        </div>
                    )}
                </Card>

                {/* Live activity feed */}
                <Card title="Recent Tracking Sessions" className="lg:col-span-3">
                    <RecentSessions />
                </Card>
            </div>
        </PageLayout>
    );
}

function RecentSessions() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const { data, error } = await supabase.from('sessions')
                    .select('id, user_id, project_id, started_at, ended_at')
                    .order('started_at', { ascending: false })
                    .limit(8);
                if (error) console.error("RecentSessions Error:", error);
                setSessions(data || []);
            } catch (err) {
                console.error("RecentSessions unhandled error:", err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    if (loading) return <LoadingState message="Loading…" className="py-4 min-h-0" />;
    if (sessions.length === 0) return (
        <EmptyState
            icon={<Activity className="w-6 h-6" />}
            title="No sessions yet"
            description="Start tracking in the Electron app."
        />
    );

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-border text-left">
                        <th className="pb-3 pr-6 text-xs font-semibold text-text-muted uppercase">Member</th>
                        <th className="pb-3 pr-6 text-xs font-semibold text-text-muted uppercase">Started</th>
                        <th className="pb-3 pr-6 text-xs font-semibold text-text-muted uppercase">Duration</th>
                        <th className="pb-3 text-xs font-semibold text-text-muted uppercase">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => {
                        const startMs = new Date(s.started_at).getTime();
                        const { endMs, isLive, isStale } = effectiveEnd(s.started_at, s.ended_at);
                        const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
                        const isActive = isLive;
                        const mid = s.user_id ?? '—';

                        return (
                            <tr key={s.id} className="border-b border-border-subtle hover:bg-surface-subtle/50 transition-colors">
                                <td className="py-3 pr-6">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                                        {mid.slice(0, 1).toUpperCase()}
                                    </div>
                                </td>
                                <td className="py-3 pr-6 text-text-secondary">
                                    {new Date(s.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-3 pr-6 font-medium text-text-primary">
                                    {isStale ? <span className="text-text-muted">—</span> : fmtTime(mins)}
                                </td>
                                <td className="py-3">
                                    {isActive ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Live
                                        </span>
                                    ) : isStale ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                            Orphaned
                                        </span>
                                    ) : (
                                        <span className="text-xs text-text-muted">Ended</span>
                                    )}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

