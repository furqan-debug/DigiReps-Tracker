import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, TrendingUp, Monitor, Camera } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];
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

    useEffect(() => {
        fetchReports();
    }, [range]);

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

        const [{ data: samples }, { data: sessions }, { count: ssCount }] = await Promise.all([
            supabase.from('activity_samples').select('*').gte('recorded_at', start).lte('recorded_at', end),
            supabase.from('sessions').select('id').gte('started_at', start).lte('started_at', end),
            supabase.from('screenshots').select('id', { count: 'exact', head: true }).gte('recorded_at', start).lte('recorded_at', end),
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

        setLoading(false);
    }

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
                    <p className="text-slate-500 text-sm mt-1">Productivity analytics & insights</p>
                </div>
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
                    {RANGES.map(r => (
                        <button key={r} onClick={() => setRange(r)}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${range === r ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <KpiCard icon={<BarChart3 className="w-5 h-5 text-blue-500" />} label="Total Sessions" value={totalSessions.toString()} sub="tracking sessions" />
                <KpiCard icon={<TrendingUp className="w-5 h-5 text-emerald-500" />} label="Avg Activity" value={`${avgActivity}%`} sub="across all samples" />
                <KpiCard icon={<Monitor className="w-5 h-5 text-purple-500" />} label="Minutes Tracked" value={`${Math.floor(totalMins / 60)}h ${totalMins % 60}m`} sub="total work time" />
                <KpiCard icon={<Camera className="w-5 h-5 text-orange-500" />} label="Screenshots" value={screenshotCount.toString()} sub="proof of work" />
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-slate-400">Loading report data...</div>
            ) : (
                <div className="space-y-6">
                    {/* Activity Trend Line */}
                    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                        <h2 className="text-sm font-semibold text-slate-500 mb-6 uppercase tracking-wider">Activity Trend</h2>
                        {dailyActivity.length === 0 ? (
                            <EmptyChart />
                        ) : (
                            <ResponsiveContainer width="100%" height={240}>
                                <LineChart data={dailyActivity}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                                    <Tooltip
                                        formatter={(v?: number, name?: string) => [
                                            name === 'activity' ? `${v ?? 0}%` : `${v ?? 0} min`,
                                            name === 'activity' ? 'Activity' : 'Minutes'
                                        ]}
                                        contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                    />
                                    <Line type="monotone" dataKey="activity" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Minutes per Day Bar */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-500 mb-6 uppercase tracking-wider">Minutes Tracked Per Day</h2>
                            {dailyActivity.length === 0 ? <EmptyChart /> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <BarChart data={dailyActivity} barSize={28}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                        <Tooltip
                                            formatter={(v?: number) => [`${v ?? 0} min`, 'Tracked']}
                                            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                        />
                                        <Bar dataKey="minutes" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            )}
                        </div>

                        {/* App Breakdown Pie */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                            <h2 className="text-sm font-semibold text-slate-500 mb-6 uppercase tracking-wider">Top Apps Used</h2>
                            {appBreakdown.length === 0 ? <EmptyChart /> : (
                                <ResponsiveContainer width="100%" height={220}>
                                    <PieChart>
                                        <Pie
                                            data={appBreakdown}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={90}
                                            paddingAngle={3}
                                            dataKey="value"
                                        >
                                            {appBreakdown.map((_, i) => (
                                                <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(v?: number) => [`${v ?? 0} samples`, 'Usage']}
                                            contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                        />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                                    </PieChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-3xl font-light text-slate-800 tracking-tight">{value}</div>
            <div className="text-xs text-slate-400 mt-1">{sub}</div>
        </div>
    );
}

function EmptyChart() {
    return (
        <div className="flex items-center justify-center h-48 text-slate-400 text-sm flex-col gap-2">
            <BarChart3 className="w-8 h-8 text-slate-300" />
            No data for this period yet.
        </div>
    );
}
