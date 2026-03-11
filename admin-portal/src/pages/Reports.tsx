import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, Monitor, Camera, Download, Calendar, Clock, Activity as ActivityIcon, Users } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { PageLayout, Card, KpiCard, Button, EmptyState, LoadingState } from '../components/ui';

const COLORS = ['#6366f1', '#a855f7', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
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
            // A specific member is picked
            emails = [selectedMemberEmail];
        } else if (selectedTeamId !== 'All') {
            // A team is picked, get all team members' emails
            const { data: tm } = await supabase.from('team_members').select('member_id').eq('team_id', selectedTeamId);
            const memberIds = tm?.map(t => t.member_id) || [];
            if (memberIds.length > 0) {
                const { data: m } = await supabase.from('members').select('email').in('id', memberIds);
                emails = m?.map(x => x.email) || [];
            }
        }

        // If a filter is active but yielded 0 valid emails, short-circuit
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

        // Base queries
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

            // Daily activity data
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

            // App breakdown
            const appMap: Record<string, number> = {};
            allSamples.forEach(s => {
                const app = s.app_name || 'Unknown';
                appMap[app] = (appMap[app] || 0) + 1;
            });
            setAppBreakdown(
                Object.entries(appMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ name, value }))
            );

            // Totals
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
            setDailyActivity([]);
            setAppBreakdown([]);
            setTotalSessions(0);
            setScreenshotCount(0);
            setTotalMins(0);
            setAvgActivity(0);
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
            title="Time & Activity"
            description="Detailed tracking insights and productivity metrics."
            maxWidth="full"
            actions={
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-shell-lg px-4 py-2 shadow-shell-sm">
                        <Users className="w-4 h-4 text-text-muted" />
                        <select
                            value={selectedTeamId}
                            onChange={(e) => { setSelectedTeamId(e.target.value); setSelectedMemberEmail('All'); }}
                            className="text-sm font-medium text-text-primary bg-transparent outline-none cursor-pointer"
                        >
                            <option value="All">All Teams</option>
                            {teams.map(t => (
                                <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-2 bg-surface border border-border rounded-shell-lg px-4 py-2 shadow-shell-sm">
                        <Users className="w-4 h-4 text-text-muted" />
                        <select
                            value={selectedMemberEmail}
                            onChange={(e) => { setSelectedMemberEmail(e.target.value); setSelectedTeamId('All'); }}
                            className="text-sm font-medium text-text-primary bg-transparent outline-none cursor-pointer max-w-[150px] truncate"
                        >
                            <option value="All">All Members</option>
                            <option disabled>──────────</option>
                            {members.map(m => (
                                <option key={m.id} value={m.email}>{m.full_name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center bg-surface border border-border rounded-shell-lg p-1 shadow-shell-sm">
                        {RANGES.map(r => (
                            <button
                                key={r}
                                onClick={() => setRange(r)}
                                className={`px-5 py-2 rounded-shell-md text-sm font-medium transition-all duration-200 ${range === r
                                    ? 'bg-primary text-white shadow-shell-sm'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-subtle'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />}>
                        Export
                    </Button>
                </div>
            }
        >
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                <KpiCard
                    icon={<Clock className="w-6 h-6 text-primary" />}
                    label="Total Tracked"
                    value={fmtHours(totalMins)}
                    sub="Cumulative time"
                    trend="+12%"
                    trendVariant="positive"
                />
                <KpiCard
                    icon={<ActivityIcon className="w-6 h-6 text-primary" />}
                    label="Avg Activity"
                    value={`${avgActivity}%`}
                    sub="Productive work"
                    trend="+4%"
                    trendVariant="positive"
                />
                <KpiCard
                    icon={<Monitor className="w-6 h-6 text-primary" />}
                    label="Active Sessions"
                    value={totalSessions.toString()}
                    sub="Unique starts"
                    trend="+2"
                    trendVariant="positive"
                />
                <KpiCard
                    icon={<Camera className="w-6 h-6 text-primary" />}
                    label="Proof of Work"
                    value={screenshotCount.toString()}
                    sub="Screenshots"
                    trend="+45"
                    trendVariant="positive"
                />
            </div>

            {loading ? (
                <LoadingState message="Aggregating analytics…" className="h-96" />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">Activity Trend</h3>
                                    <p className="text-sm text-text-secondary font-medium tracking-tight">Daily productivity percentage</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-text-muted bg-surface-subtle px-3 py-1.5 rounded-shell-md">
                                    <Calendar className="w-3.5 h-3.5" />
                                    BY DAY
                                </div>
                            </div>

                            {dailyActivity.length === 0 ? (
                                <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="No data available" className="h-[250px]" />
                            ) : (
                                <div className="h-[300px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={dailyActivity}>
                                            <defs>
                                                <linearGradient id="colorActivity" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                                                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 600 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                domain={[0, 100]}
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 600 }}
                                                unit="%"
                                            />
                                            <Tooltip content={<ChartTooltip />} />
                                            <Area
                                                type="monotone"
                                                dataKey="activity"
                                                stroke="var(--color-primary)"
                                                strokeWidth={3}
                                                fillOpacity={1}
                                                fill="url(#colorActivity)"
                                                animationDuration={1500}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>

                        <Card>
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h3 className="text-lg font-semibold text-text-primary">Work Volume</h3>
                                    <p className="text-sm text-text-secondary font-medium tracking-tight">Total minutes tracked daily</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-medium text-text-muted bg-surface-subtle px-3 py-1.5 rounded-shell-md uppercase tracking-wider">
                                    Minutes per day
                                </div>
                            </div>

                            {dailyActivity.length === 0 ? (
                                <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="No data available" className="h-[250px]" />
                            ) : (
                                <div className="h-[250px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dailyActivity} barSize={40}>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border-subtle)" />
                                            <XAxis
                                                dataKey="date"
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 600 }}
                                                dy={10}
                                            />
                                            <YAxis
                                                axisLine={false}
                                                tickLine={false}
                                                tick={{ fontSize: 11, fill: 'var(--color-text-muted)', fontWeight: 600 }}
                                            />
                                            <Tooltip cursor={{ fill: 'var(--color-background)' }} content={<ChartTooltip unit="min" />} />
                                            <Bar
                                                dataKey="minutes"
                                                fill="var(--color-primary)"
                                                radius={[8, 8, 8, 8]}
                                                animationDuration={1500}
                                            />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Card>
                    </div>

                    <div className="space-y-8">
                        <Card className="h-full flex flex-col">
                            <div className="mb-8">
                                <h3 className="text-lg font-semibold text-text-primary">App Ecosystem</h3>
                                <p className="text-sm text-text-secondary font-medium tracking-tight">Usage distribution by application</p>
                            </div>

                            {appBreakdown.length === 0 ? (
                                <EmptyState icon={<BarChart3 className="w-6 h-6" />} title="No data available" className="h-[300px]" />
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="h-[300px] w-full relative">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={appBreakdown}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={80}
                                                    outerRadius={110}
                                                    paddingAngle={8}
                                                    dataKey="value"
                                                    animationDuration={1500}
                                                >
                                                    {appBreakdown.map((_, i) => (
                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<ChartTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-3xl font-bold text-text-primary">{appBreakdown.length}</span>
                                            <span className="text-[10px] font-medium text-text-muted uppercase tracking-widest">Top Apps</span>
                                        </div>
                                    </div>

                                    <div className="w-full mt-6 space-y-3">
                                        {appBreakdown.map((item, i) => (
                                            <div key={i} className="flex items-center justify-between group cursor-default">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                                                    <span className="text-xs font-medium text-text-primary truncate max-w-[140px] tracking-tight">{item.name}</span>
                                                </div>
                                                <span className="text-[10px] font-medium text-text-muted bg-surface-subtle px-2 py-0.5 rounded transition-colors group-hover:bg-border uppercase">
                                                    {item.value} samples
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </Card>

                        <div className="bg-primary rounded-shell-lg p-8 text-white shadow-shell-md">
                            <div className="flex justify-between items-start mb-6">
                                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                                    <TrendingUp className="w-6 h-6 text-white" />
                                </div>
                                <span className="text-[10px] font-black bg-white/20 px-2 py-1 rounded backdrop-blur-md tracking-widest uppercase">
                                    Real-time
                                </span>
                            </div>
                            <h4 className="text-white/80 font-bold uppercase tracking-widest text-[10px] mb-1">Productivity Score</h4>
                            <div className="flex items-baseline gap-2 mb-4">
                                <span className="text-5xl font-black tracking-tighter">{avgActivity}</span>
                                <span className="text-xl font-bold text-white/60">/ 100</span>
                            </div>
                            <p className="text-sm font-medium text-white/70 leading-relaxed mb-6">
                                {selectedTeamId === 'All' ? 'Your team is' : 'This team is'} currently operating at an optimal activity level. Great job!
                            </p>
                            <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-white rounded-full transition-all duration-1000"
                                    style={{ width: `${avgActivity}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PageLayout>
    );
}

function ChartTooltip({ active, payload, label, unit }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="bg-surface border border-border p-4 rounded-shell-lg shadow-shell-md">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">{label}</p>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <p className="text-lg font-semibold text-text-primary tracking-tight">
                        {payload[0].value}{unit === 'min' ? ' min' : '%'}
                    </p>
                </div>
            </div>
        );
    }
    return null;
}
