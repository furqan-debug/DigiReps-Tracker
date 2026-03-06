import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am – 8pm
const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface ActivityBlock {
    date: string; // YYYY-MM-DD
    hour: number;
    count: number; // samples in that hour
}

export function Schedules() {
    const [blocks, setBlocks] = useState<ActivityBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    useEffect(() => {
        fetchSchedules();
    }, [weekOffset]);

    async function fetchSchedules() {
        setLoading(true);

        const { data } = await supabase
            .from('activity_samples')
            .select('recorded_at, idle')
            .gte('recorded_at', weekStart.toISOString())
            .lte('recorded_at', weekEnd.toISOString());

        // Build activity blocks: { date, hour } → count of non-idle samples
        const blockMap: Record<string, number> = {};
        (data || []).forEach(a => {
            if (a.idle) return;
            const d = new Date(a.recorded_at);
            const key = `${d.toISOString().split('T')[0]}_${d.getHours()}`;
            blockMap[key] = (blockMap[key] || 0) + 1;
        });

        const result: ActivityBlock[] = Object.entries(blockMap).map(([key, count]) => {
            const [date, hourStr] = key.split('_');
            return { date: date!, hour: parseInt(hourStr!), count };
        });

        setBlocks(result);
        setLoading(false);
    }

    // Build week days array
    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    function getBlock(date: string, hour: number): ActivityBlock | undefined {
        return blocks.find(b => b.date === date && b.hour === hour);
    }

    function blockOpacity(count: number): number {
        // Scale: 1 sample = 0.15, 10+ = 1.0
        return Math.min(1, 0.15 + (count / 10) * 0.85);
    }

    const totalActiveHours = blocks.reduce((a, b) => a + b.count, 0);
    const peakDay = weekDays.reduce((best, d) => {
        const ds = d.toISOString().split('T')[0];
        const dayTotal = blocks.filter(b => b.date === ds).reduce((a, b) => a + b.count, 0);
        const bestTotal = blocks.filter(b => b.date === best.toISOString().split('T')[0]).reduce((a, b) => a + b.count, 0);
        return dayTotal > bestTotal ? d : best;
    }, weekDays[0]!);

    const formatHeader = (d: Date) =>
        `${d.toLocaleString('en-US', { month: 'short' })} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekStart.getFullYear()}`;

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Schedules</h1>
                    <p className="text-slate-500 text-sm mt-1">When your team is working</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={() => setWeekOffset(w => w - 1)}
                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <ChevronLeft className="w-4 h-4 text-slate-600" />
                    </button>
                    <span className="text-sm font-medium text-slate-700 min-w-[200px] text-center">
                        {formatHeader(weekStart)}
                    </span>
                    <button onClick={() => setWeekOffset(w => w + 1)}
                        className="p-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                        <ChevronRight className="w-4 h-4 text-slate-600" />
                    </button>
                    <button onClick={() => setWeekOffset(0)}
                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors text-slate-600">
                        Today
                    </button>
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <SummaryCard label="Active Samples This Week" value={totalActiveHours.toLocaleString()} color="text-blue-600" />
                <SummaryCard
                    label="Peak Day"
                    value={peakDay ? DAYS_SHORT[peakDay.getDay()] + ', ' + peakDay.getDate() : '—'}
                    color="text-purple-600"
                />
                <SummaryCard
                    label="Hours Covered"
                    value={`${new Set(blocks.map(b => b.hour)).size} unique hours`}
                    color="text-emerald-600"
                />
            </div>

            {/* Calendar Heatmap */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Activity Heatmap</h2>
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>Less</span>
                        {[0.15, 0.35, 0.6, 0.85, 1].map(o => (
                            <div key={o} className="w-3 h-3 rounded-sm bg-blue-500" style={{ opacity: o }} />
                        ))}
                        <span>More</span>
                    </div>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center h-48 text-slate-400">Building schedule...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-xs border-collapse">
                            <thead>
                                <tr>
                                    <th className="w-16 px-4 py-3 text-slate-400 font-medium text-right border-r border-slate-100">Time</th>
                                    {weekDays.map((d, i) => {
                                        const isToday = d.toDateString() === today.toDateString();
                                        return (
                                            <th key={i} className="py-3 text-center font-medium">
                                                <span className={`block ${isToday ? 'text-blue-600 font-bold' : 'text-slate-500'}`}>
                                                    {DAYS_SHORT[d.getDay()]}
                                                </span>
                                                <span className={`block text-sm mt-0.5 ${isToday ? 'text-blue-600 font-bold' : 'text-slate-400'}`}>
                                                    {d.getDate()}
                                                </span>
                                            </th>
                                        );
                                    })}
                                </tr>
                            </thead>
                            <tbody>
                                {HOURS.map(hour => (
                                    <tr key={hour} className="border-t border-slate-50">
                                        <td className="px-4 py-2 text-slate-400 text-right border-r border-slate-100 text-[11px]">
                                            {hour < 12 ? `${hour}am` : hour === 12 ? '12pm' : `${hour - 12}pm`}
                                        </td>
                                        {weekDays.map((d, di) => {
                                            const dateStr = d.toISOString().split('T')[0];
                                            const block = getBlock(dateStr!, hour);
                                            return (
                                                <td key={di} className="p-1 text-center">
                                                    {block ? (
                                                        <div
                                                            title={`${block.count} samples at ${hour}:00`}
                                                            className="mx-auto h-7 rounded-md cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                                                            style={{
                                                                backgroundColor: '#3b82f6',
                                                                opacity: blockOpacity(block.count),
                                                                width: '80%',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="mx-auto h-7 rounded-md bg-slate-50" style={{ width: '80%' }} />
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <CalendarDays className="w-8 h-8 text-slate-200 shrink-0" />
            <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
                <p className={`text-xl font-semibold mt-0.5 ${color}`}>{value}</p>
            </div>
        </div>
    );
}
