import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, Activity, MousePointer2, Keyboard, Search, ArrowUpDown } from 'lucide-react';

interface MemberPerformance {
    id: string;
    name: string;
    totalMs: number;
    avgActivity: number;
    totalKeys: number;
    totalClicks: number;
}

type SortField = 'name' | 'totalMs' | 'avgActivity' | 'totalKeys' | 'totalClicks';
type SortDirection = 'asc' | 'desc';

export function Performance() {
    const [loading, setLoading] = useState(true);
    const [performanceData, setPerformanceData] = useState<MemberPerformance[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    // Sort state
    const [sortField, setSortField] = useState<SortField>('avgActivity');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

    // Default to this week
    const [selectedDate, setSelectedDate] = useState(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });

    useEffect(() => {
        fetchData();
    }, [selectedDate]);

    async function fetchData() {
        setLoading(true);

        const start = `${selectedDate}T00:00:00`;
        const end = `${selectedDate}T23:59:59`;

        // 1. Get all active members
        const { data: members } = await supabase.from('members').select('id, full_name, email').eq('status', 'Active');
        if (!members) {
            setLoading(false);
            return;
        }

        // 2. Get sessions for the day
        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, user_id, started_at, ended_at')
            .gte('started_at', start)
            .lte('started_at', end)
            .not('ended_at', 'is', null);

        const sessionIds = (sessions || []).map(s => s.id);

        // 3. Get activity samples
        let samples: any[] = [];
        if (sessionIds.length > 0) {
            const { data: acts } = await supabase
                .from('activity_samples')
                .select('session_id, activity_percent, key_presses, mouse_clicks')
                .in('session_id', sessionIds);
            if (acts) samples = acts;
        }

        // 4. Calculate member stats
        const memberStats: MemberPerformance[] = members.map(m => {
            const mSessions = (sessions || []).filter(s => s.user_id === m.id);
            const mSessionIds = new Set(mSessions.map(s => s.id));
            const mSamples = samples.filter(s => mSessionIds.has(s.session_id));

            // Time
            const totalMs = mSessions.reduce((acc, s) => {
                return acc + (new Date(s.ended_at!).getTime() - new Date(s.started_at).getTime());
            }, 0);

            // Averages and sums
            const totalKeys = mSamples.reduce((acc, s) => acc + (s.key_presses || 0), 0);
            const totalClicks = mSamples.reduce((acc, s) => acc + (s.mouse_clicks || 0), 0);

            const avgActivity = mSamples.length > 0
                ? mSamples.reduce((acc, s) => acc + (s.activity_percent || 0), 0) / mSamples.length
                : 0;

            return {
                id: m.id,
                name: m.full_name,
                totalMs,
                avgActivity,
                totalKeys,
                totalClicks
            };
        });

        // Filter out empty people unless we want to see everyone (for now, only those who tracked time)
        setPerformanceData(memberStats.filter(m => m.totalMs > 0 || m.totalKeys > 0));
        setLoading(false);
    }

    const formatHours = (ms: number) => {
        const h = Math.floor(ms / (1000 * 60 * 60));
        const m = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
        return `${h}h ${m}m`;
    };

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const filteredData = performanceData
        .filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase()))
        .sort((a, b) => {
            const valA = a[sortField];
            const valB = b[sortField];

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });

    return (
        <div className="p-8 max-w-[1200px] mx-auto w-full fade-in">
            <div className="flex justify-between items-end mb-8 relative z-20">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Performance</h1>
                    <p className="text-slate-500">Analyze and rank individual team productivity.</p>
                </div>

                <div className="flex items-center gap-4">
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="px-4 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm bg-white hover:bg-slate-50 transition-colors"
                    />
                </div>
            </div>

            {/* Detailed Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                    <h2 className="font-semibold text-slate-800">Team Rankings</h2>
                    <div className="relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Find member..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-white border border-slate-200 rounded-md pl-9 pr-4 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 w-64"
                        />
                    </div>
                </div>

                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                            <th className="px-6 py-4 font-medium cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-1.5"><ArrowUpDown className="w-3 h-3" /> Member</div>
                            </th>
                            <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('totalMs')}>
                                <div className="flex items-center justify-end gap-1.5"><ArrowUpDown className="w-3 h-3" /> Time Tracked</div>
                            </th>
                            <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('avgActivity')}>
                                <div className="flex items-center justify-end gap-1.5"><ArrowUpDown className="w-3 h-3" /> Avg Activity</div>
                            </th>
                            <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('totalClicks')}>
                                <div className="flex items-center justify-end gap-1.5"><ArrowUpDown className="w-3 h-3" /> Mouse Clicks</div>
                            </th>
                            <th className="px-6 py-4 font-medium text-right cursor-pointer hover:text-slate-700 transition-colors" onClick={() => handleSort('totalKeys')}>
                                <div className="flex items-center justify-end gap-1.5"><ArrowUpDown className="w-3 h-3" /> Keystrokes</div>
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    Calculating team performance...
                                </td>
                            </tr>
                        ) : filteredData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center gap-2">
                                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                                            <Activity className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <p>No performance data recorded for this date.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            filteredData.map((m, i) => (
                                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 font-bold text-xs shrink-0 ring-1 ring-slate-200">
                                                {i + 1}
                                            </div>
                                            <span className="font-semibold text-slate-800">{m.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <span className="inline-flex items-center justify-end gap-1.5 px-2.5 py-1 rounded bg-slate-100 text-slate-700 text-sm font-medium">
                                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                                            {formatHours(m.totalMs)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end justify-center">
                                            <span className={`text-sm font-bold ${m.avgActivity >= 75 ? 'text-emerald-600' :
                                                m.avgActivity >= 45 ? 'text-amber-600' :
                                                    'text-rose-600'
                                                }`}>
                                                {m.avgActivity.toFixed(0)}%
                                            </span>
                                            <div className="w-16 h-1 mt-1 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${m.avgActivity >= 75 ? 'bg-emerald-500' :
                                                        m.avgActivity >= 45 ? 'bg-amber-500' :
                                                            'bg-rose-500'
                                                        }`}
                                                    style={{ width: `${m.avgActivity}%` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 text-sm text-slate-600">
                                            <MousePointer2 className="w-3.5 h-3.5 text-slate-400" />
                                            {m.totalClicks.toLocaleString()}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-1.5 text-sm text-slate-600">
                                            <Keyboard className="w-3.5 h-3.5 text-slate-400" />
                                            {m.totalKeys.toLocaleString()}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
