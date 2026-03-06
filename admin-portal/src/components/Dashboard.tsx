import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Users, FolderOpen, CircleDollarSign, Activity, Camera } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid } from 'recharts';

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
        setLoading(true);

        const now = new Date();
        const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
        const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay()); weekStart.setHours(0, 0, 0, 0);

        const [
            { data: todaySessions },
            { data: weekSessions },
            { data: projectsData },
            { data: membersData },
            { count: ssCount },
        ] = await Promise.all([
            supabase.from('sessions').select('id, started_at, ended_at').gte('started_at', todayStart.toISOString()),
            supabase.from('sessions').select('id, user_id, project_id, started_at, ended_at').gte('started_at', weekStart.toISOString()),
            supabase.from('projects').select('id, name, color'),
            supabase.from('members').select('id, auth_user_id, pay_rate'),
            supabase.from('screenshots').select('id', { count: 'exact', head: true }).gte('recorded_at', weekStart.toISOString()),
        ]);

        // Today minutes
        const todayMins = (todaySessions || []).reduce((acc, s) => {
            const start = new Date(s.started_at).getTime();
            const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
            return acc + Math.max(0, Math.round((end - start) / 60000));
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
            const end = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
            const mins = Math.max(0, Math.round((end - start) / 60000));
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
        setLoading(false);
    }

    const maxProjectMins = projects[0]?.minutes || 1;
    const today = new Date();
    const weekLabel = `${new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay() + 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-slate-400 text-sm mt-1">{weekLabel}</p>
            </div>

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <KpiCard icon={<Clock className="w-4 h-4 text-indigo-500" />} label="Today" value={loading ? '—' : fmtTime(stats.todayMinutes)} />
                <KpiCard icon={<Clock className="w-4 h-4 text-violet-500" />} label="This Week" value={loading ? '—' : fmtTime(stats.weekMinutes)} />
                <KpiCard icon={<CircleDollarSign className="w-4 h-4 text-emerald-500" />} label="Week Cost" value={loading ? '—' : `$${stats.weekCost.toFixed(2)}`} />
                <KpiCard icon={<Users className="w-4 h-4 text-blue-500" />} label="Active Members" value={loading ? '—' : stats.activeMembers.toString()} />
                <KpiCard icon={<FolderOpen className="w-4 h-4 text-amber-500" />} label="Projects" value={loading ? '—' : stats.activeProjects.toString()} />
                <KpiCard icon={<Camera className="w-4 h-4 text-rose-500" />} label="Screenshots" value={loading ? '—' : stats.screenshotCount.toString()} />
            </div>

            {/* Main Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Projects */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">Projects This Week</h2>
                    {loading ? (
                        <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                    ) : projects.length === 0 ? (
                        <div className="h-48 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <FolderOpen className="w-10 h-10 text-slate-200" />
                            <p className="text-sm font-medium">No tracked sessions this week</p>
                            <p className="text-xs text-center">Start a tracking session in the Electron app to see data here.</p>
                        </div>
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
                                            <span className="text-sm font-medium text-slate-700 truncate">{p.name}</span>
                                            <span className="text-xs text-slate-400 ml-3 shrink-0">{fmtTime(p.minutes)}</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full rounded-full transition-all"
                                                style={{ width: `${Math.round((p.minutes / maxProjectMins) * 100)}%`, backgroundColor: p.color }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Weekly bars */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex flex-col">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">This Week</h2>
                    {loading ? (
                        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                    ) : (
                        <div className="flex-1">
                            <ResponsiveContainer width="100%" height={200}>
                                <BarChart data={weekBars} barSize={20}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip
                                        formatter={(v: number | undefined) => [fmtTime(v ?? 0), 'Tracked']}
                                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                    />
                                    <Bar dataKey="minutes" fill="#4f46e5" radius={[4, 4, 0, 0]}
                                        label={false} />
                                </BarChart>
                            </ResponsiveContainer>
                            {/* Today highlight */}
                            <p className="text-xs text-slate-400 text-center mt-2">
                                Today: <span className="font-semibold text-indigo-600">{DAYS_SHORT[today.getDay()]}</span>
                            </p>
                        </div>
                    )}
                </div>

                {/* Live activity feed */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center gap-2 mb-5">
                        <Activity className="w-4 h-4 text-indigo-500" />
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Recent Tracking Sessions</h2>
                    </div>
                    <RecentSessions />
                </div>
            </div>
        </div>
    );
}

function RecentSessions() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.from('sessions')
            .select('id, member_id, user_id, project_id, started_at, ended_at')
            .order('started_at', { ascending: false })
            .limit(8)
            .then(({ data }) => { setSessions(data || []); setLoading(false); });
    }, []);

    if (loading) return <div className="text-slate-400 text-sm py-4">Loading…</div>;
    if (sessions.length === 0) return (
        <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-400">
            <Activity className="w-8 h-8 text-slate-200" />
            <p className="text-sm">No sessions yet. Start tracking in the Electron app.</p>
        </div>
    );

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100 text-left">
                        <th className="pb-3 pr-6 text-xs font-semibold text-slate-400 uppercase">Member</th>
                        <th className="pb-3 pr-6 text-xs font-semibold text-slate-400 uppercase">Started</th>
                        <th className="pb-3 pr-6 text-xs font-semibold text-slate-400 uppercase">Duration</th>
                        <th className="pb-3 text-xs font-semibold text-slate-400 uppercase">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => {
                        const startMs = new Date(s.started_at).getTime();
                        const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
                        const mins = Math.max(0, Math.round((endMs - startMs) / 60000));
                        const isActive = !s.ended_at;
                        const mid = s.member_id ?? s.user_id ?? '—';

                        return (
                            <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                                <td className="py-3 pr-6">
                                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs flex items-center justify-center">
                                        {mid.slice(0, 1).toUpperCase()}
                                    </div>
                                </td>
                                <td className="py-3 pr-6 text-slate-500">
                                    {new Date(s.started_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="py-3 pr-6 font-medium text-slate-700">{fmtTime(mins)}</td>
                                <td className="py-3">
                                    {isActive ? (
                                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                            Live
                                        </span>
                                    ) : (
                                        <span className="text-xs text-slate-400">Ended</span>
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

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
            </div>
            <div className="text-2xl font-semibold text-slate-800 tracking-tight">{value}</div>
            <div className="text-xs text-slate-400 mt-0.5 font-medium">{label}</div>
        </div>
    );
}
