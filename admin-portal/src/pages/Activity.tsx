import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Monitor, Keyboard, Mouse, Camera, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivitySample {
    id: number;
    session_id: string;
    recorded_at: string;
    mouse_clicks: number;
    key_presses: number;
    app_name: string;
    window_title: string;
    idle: boolean;
    activity_percent: number;
}

interface Screenshot {
    id: number;
    session_id: string;
    recorded_at: string;
    file_url: string;
}

export function Activity() {
    const [samples, setSamples] = useState<ActivitySample[]>([]);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]!);
    const [enlarged, setEnlarged] = useState<Screenshot | null>(null);

    useEffect(() => { fetchData(); }, [selectedDate]);

    async function fetchData() {
        setLoading(true);
        const start = `${selectedDate}T00:00:00`;
        const end = `${selectedDate}T23:59:59`;

        const [{ data: actData }, { data: ssData }] = await Promise.all([
            supabase.from('activity_samples').select('*').gte('recorded_at', start).lte('recorded_at', end).order('recorded_at', { ascending: true }),
            supabase.from('screenshots').select('*').gte('recorded_at', start).lte('recorded_at', end).order('recorded_at', { ascending: false }).limit(24),
        ]);

        setSamples(actData || []);
        setScreenshots(ssData || []);
        setLoading(false);
    }

    const chartData = Array.from({ length: 24 }, (_, hour) => {
        const hourSamples = samples.filter(s => new Date(s.recorded_at).getHours() === hour);
        const avg = hourSamples.length
            ? Math.round(hourSamples.reduce((a, b) => a + b.activity_percent, 0) / hourSamples.length)
            : 0;
        return { hour: `${hour}:00`, activity: avg };
    });

    const totalClicks = samples.reduce((a, b) => a + b.mouse_clicks, 0);
    const totalKeys = samples.reduce((a, b) => a + b.key_presses, 0);
    const avgActivity = samples.length ? Math.round(samples.reduce((a, b) => a + b.activity_percent, 0) / samples.length) : 0;
    const activeTime = samples.filter(s => !s.idle).length;

    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const dateLabel = isToday ? 'Today' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

    return (
        <div className="p-8 max-w-[1400px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Activity</h1>
                    <p className="text-slate-500 text-sm mt-1">{dateLabel} — keyboard, mouse & app usage</p>
                </div>
                <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
                    className="border border-slate-200 bg-white rounded-lg px-4 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <StatCard icon={<Mouse className="w-4 h-4 text-indigo-500" />} label="Mouse Clicks" value={totalClicks.toLocaleString()} />
                <StatCard icon={<Keyboard className="w-4 h-4 text-violet-500" />} label="Keystrokes" value={totalKeys.toLocaleString()} />
                <StatCard icon={<Clock className="w-4 h-4 text-emerald-500" />} label="Active Intervals" value={`${activeTime}`} />
                <StatCard icon={<Monitor className="w-4 h-4 text-amber-500" />} label="Avg Activity" value={`${avgActivity}%`} />
            </div>

            {/* Chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">Activity Level — Hourly</h2>
                {loading ? (
                    <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>
                ) : samples.length === 0 ? (
                    <EmptyChart message="No activity recorded for this day." />
                ) : (
                    <ResponsiveContainer width="100%" height={200}>
                        <AreaChart data={chartData}>
                            <defs>
                                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.15} />
                                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#94a3b8' }} interval={2} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} unit="%" />
                            <Tooltip
                                formatter={(v?: number) => [`${v ?? 0}%`, 'Activity']}
                                contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                            />
                            <Area type="monotone" dataKey="activity" stroke="#4f46e5" strokeWidth={2} fill="url(#actGrad)" />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* Two column */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* App Usage */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">App Usage</h2>
                    {loading ? (
                        <div className="text-slate-400 text-sm">Loading…</div>
                    ) : samples.length === 0 ? (
                        <EmptyChart message="No activity recorded for this day." />
                    ) : (
                        <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                            {groupByApp(samples).map(({ app, count, percent }) => (
                                <div key={app} className="flex items-center gap-3">
                                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 font-semibold text-xs shrink-0">
                                        {app.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1.5">
                                            <span className="text-sm font-medium text-slate-700 truncate">{app || 'Unknown'}</span>
                                            <span className="text-xs text-slate-400 ml-2 shrink-0">{count} samples</span>
                                        </div>
                                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${percent}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Screenshots */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Screenshots</h2>
                        <span className="text-xs text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">{screenshots.length} captured</span>
                    </div>
                    {loading ? (
                        <div className="text-slate-400 text-sm">Loading…</div>
                    ) : screenshots.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-48 gap-3 text-slate-400">
                            <Camera className="w-10 h-10 text-slate-200" />
                            <p className="text-sm font-medium">No screenshots yet</p>
                            <p className="text-xs text-center">Screenshots are captured 3× randomly per 10-minute window during tracking.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                            {screenshots.map(ss => (
                                <button key={ss.id}
                                    onClick={() => setEnlarged(ss)}
                                    className="group relative rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition-colors aspect-video">
                                    <img src={ss.file_url} alt="Screenshot"
                                        className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 text-white text-[9px] px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        {new Date(ss.recorded_at).toLocaleTimeString()}
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Lightbox */}
            {enlarged && (
                <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-6" onClick={() => setEnlarged(null)}>
                    <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
                        <img src={enlarged.file_url} alt="Screenshot" className="w-full rounded-xl shadow-2xl" />
                        <p className="text-white/70 text-sm text-center mt-3">
                            {new Date(enlarged.recorded_at).toLocaleString()} · Click outside to close
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">{label}</p>
                <p className="text-xl font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
        </div>
    );
}
function EmptyChart({ message }: { message: string }) {
    return (
        <div className="h-48 flex flex-col items-center justify-center text-slate-400 gap-2">
            <Monitor className="w-8 h-8 text-slate-200" />
            <span className="text-sm">{message}</span>
        </div>
    );
}
function groupByApp(samples: ActivitySample[]) {
    const map: Record<string, number> = {};
    samples.forEach(s => { const app = s.app_name || 'Unknown'; map[app] = (map[app] || 0) + 1; });
    const total = samples.length;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([app, count]) => ({ app, count, percent: Math.round((count / total) * 100) }));
}
