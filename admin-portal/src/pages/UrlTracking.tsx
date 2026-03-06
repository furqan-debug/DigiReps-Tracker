import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Globe, TrendingUp, Clock, Search, BarChart2 } from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts';

interface DomainEntry {
    domain: string;
    count: number;
    percent: number;
    category: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

const CATEGORIES: Record<string, string> = {
    'github.com': 'Development', 'stackoverflow.com': 'Development', 'localhost': 'Development',
    'google.com': 'Search', 'bing.com': 'Search',
    'youtube.com': 'Media', 'netflix.com': 'Media',
    'slack.com': 'Communication', 'teams.microsoft.com': 'Communication', 'discord.com': 'Communication',
    'notion.so': 'Productivity', 'figma.com': 'Productivity', 'linear.app': 'Productivity',
    'twitter.com': 'Social', 'x.com': 'Social', 'linkedin.com': 'Social', 'facebook.com': 'Social',
};
function categorize(domain: string): string {
    const match = Object.keys(CATEGORIES).find(k => domain.includes(k));
    return match ? CATEGORIES[match]! : 'Other';
}

const RANGES = ['Today', 'Last 7 Days', 'Last 30 Days'] as const;
type Range = typeof RANGES[number];

export function UrlTracking() {
    const [domains, setDomains] = useState<DomainEntry[]>([]);
    const [hourlyData, setHourlyData] = useState<{ hour: string; count: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<Range>('Last 7 Days');
    const [search, setSearch] = useState('');

    useEffect(() => { fetchDomains(); }, [range]);

    function getDateRange() {
        const end = new Date().toISOString();
        let start: string;
        if (range === 'Today') start = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
        else if (range === 'Last 7 Days') start = new Date(Date.now() - 7 * 86400000).toISOString();
        else start = new Date(Date.now() - 30 * 86400000).toISOString();
        return { start, end };
    }

    async function fetchDomains() {
        setLoading(true);
        const { start, end } = getDateRange();

        const { data } = await supabase
            .from('activity_samples')
            .select('domain, recorded_at')
            .gte('recorded_at', start)
            .lte('recorded_at', end)
            .not('domain', 'is', null)
            .neq('domain', '');

        const domainMap: Record<string, number> = {};
        const hourMap: Record<number, number> = {};

        (data || []).forEach(row => {
            if (!row.domain) return;
            domainMap[row.domain] = (domainMap[row.domain] || 0) + 1;
            const h = new Date(row.recorded_at).getHours();
            hourMap[h] = (hourMap[h] || 0) + 1;
        });

        const total = Object.values(domainMap).reduce((a, b) => a + b, 0) || 1;
        const sorted: DomainEntry[] = Object.entries(domainMap)
            .sort((a, b) => b[1] - a[1])
            .map(([domain, count]) => ({
                domain,
                count,
                percent: Math.round((count / total) * 100),
                category: categorize(domain),
            }));

        setDomains(sorted);
        setHourlyData(Array.from({ length: 24 }, (_, h) => ({
            hour: `${h}:00`,
            count: hourMap[h] || 0,
        })));
        setLoading(false);
    }

    const filtered = domains.filter(d =>
        d.domain.toLowerCase().includes(search.toLowerCase())
    );

    // Category breakdown for pie
    const catMap: Record<string, number> = {};
    domains.forEach(d => { catMap[d.category] = (catMap[d.category] || 0) + d.count; });
    const pieData = Object.entries(catMap).map(([name, value]) => ({ name, value }));

    const totalVisits = domains.reduce((a, b) => a + b.count, 0);
    const uniqueDomains = domains.length;
    const topCategory = pieData.sort((a, b) => b.value - a.value)[0]?.name || '—';

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">URL Tracking</h1>
                    <p className="text-slate-500 text-sm mt-1">Browser domains visited during tracked time</p>
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

            {/* KPI Row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <KpiCard icon={<Globe className="w-5 h-5 text-blue-500" />} label="Total Visits" value={totalVisits.toLocaleString()} />
                <KpiCard icon={<TrendingUp className="w-5 h-5 text-purple-500" />} label="Unique Domains" value={uniqueDomains.toString()} />
                <KpiCard icon={<Clock className="w-5 h-5 text-emerald-500" />} label="Top Category" value={topCategory} />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Hourly activity */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-500 mb-5 uppercase tracking-wider">Browsing Activity — By Hour</h2>
                    {loading ? <Skeleton /> : domains.length === 0 ? <EmptyChart /> : (
                        <ResponsiveContainer width="100%" height={200}>
                            <BarChart data={hourlyData} barSize={12}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={2} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                <Tooltip
                                    formatter={(v?: number) => [`${v ?? 0} visits`, 'Count']}
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                />
                                <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Category Pie */}
                <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
                    <h2 className="text-sm font-semibold text-slate-500 mb-5 uppercase tracking-wider">By Category</h2>
                    {loading ? <Skeleton /> : pieData.length === 0 ? <EmptyChart /> : (
                        <ResponsiveContainer width="100%" height={200}>
                            <PieChart>
                                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Pie>
                                <Tooltip formatter={(v?: number) => [`${v ?? 0}`, 'Visits']} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Domain Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Top Domains</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input type="text" placeholder="Filter domains..." value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-56" />
                    </div>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Loading...</div>
                ) : filtered.length === 0 ? (
                    <div className="p-12 flex flex-col items-center gap-3 text-slate-400">
                        <Globe className="w-10 h-10 text-slate-200" />
                        <p className="font-medium">No URL data yet</p>
                        <p className="text-sm">URL tracking is captured from the <code className="bg-slate-100 px-1 rounded">domain</code> field in activity samples.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">#</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Domain</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Category</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Visits</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.slice(0, 50).map((d, i) => (
                                <tr key={d.domain} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-3.5 text-slate-400 font-mono text-xs">{i + 1}</td>
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-2.5">
                                            <img src={`https://www.google.com/s2/favicons?domain=${d.domain}&sz=16`}
                                                alt="" className="w-4 h-4 rounded" onError={e => (e.currentTarget.style.display = 'none')} />
                                            <span className="font-medium text-slate-700">{d.domain}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-3.5">
                                        <span className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded-full font-medium">{d.category}</span>
                                    </td>
                                    <td className="px-6 py-3.5 text-slate-600 font-medium">{d.count.toLocaleString()}</td>
                                    <td className="px-6 py-3.5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${d.percent}%` }} />
                                            </div>
                                            <span className="text-xs text-slate-500 w-8">{d.percent}%</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                <p className="text-xl font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
        </div>
    );
}
function Skeleton() { return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading...</div>; }
function EmptyChart() {
    return (
        <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
            <BarChart2 className="w-8 h-8 text-slate-200" />
            <span className="text-sm">No data for this period</span>
        </div>
    );
}
