import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CircleDollarSign, TrendingUp, Clock, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface MemberFinancial {
    member_id: string;
    full_name: string;
    pay_rate: number;
    bill_rate: number;
    totalMinutes: number;
    totalCost: number;
    sessions: number;
}

const COLORS = ['#4f46e5', '#7c3aed', '#0891b2', '#059669', '#d97706'];

export function Financials() {
    const [members, setMembers] = useState<MemberFinancial[]>([]);
    const [loading, setLoading] = useState(true);
    const [range, setRange] = useState<'This Week' | 'This Month' | 'All Time'>('This Month');

    useEffect(() => { fetchFinancials(); }, [range]);

    function getDateRange() {
        const now = new Date();
        if (range === 'This Week') {
            const start = new Date(now);
            start.setDate(now.getDate() - now.getDay());
            start.setHours(0, 0, 0, 0);
            return { start: start.toISOString(), end: now.toISOString() };
        }
        if (range === 'This Month') {
            return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), end: now.toISOString() };
        }
        return { start: new Date(0).toISOString(), end: now.toISOString() };
    }

    async function fetchFinancials() {
        setLoading(true);
        const { start, end } = getDateRange();

        // Fetch members with real pay/bill rates from the members table
        const [{ data: membersData }, { data: sessions }] = await Promise.all([
            supabase.from('members').select('id, auth_user_id, full_name, pay_rate, bill_rate'),
            supabase.from('sessions')
                .select('id, user_id, started_at, ended_at')
                .gte('started_at', start)
                .lte('started_at', end),
        ]);

        // Map sessions.user_id → member info via members.auth_user_id
        const memberMap: Record<string, { name: string; pay_rate: number; bill_rate: number }> = {};
        (membersData || []).forEach(m => {
            const key = m.auth_user_id ?? m.id;
            memberMap[key] = { name: m.full_name, pay_rate: m.pay_rate ?? 0, bill_rate: m.bill_rate ?? 0 };
        });

        const statsMap: Record<string, { minutes: number; sessions: number }> = {};
        (sessions || []).forEach(s => {
            const mid = s.user_id;
            if (!mid) return;
            if (!statsMap[mid]) statsMap[mid] = { minutes: 0, sessions: 0 };
            statsMap[mid].sessions++;
            const startMs = new Date(s.started_at).getTime();
            const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
            statsMap[mid].minutes += Math.max(0, Math.round((endMs - startMs) / 60000));
        });

        const result: MemberFinancial[] = Object.entries(statsMap).map(([uid, data]) => {
            const info = memberMap[uid] ?? { name: uid.slice(0, 8) + '…', pay_rate: 0, bill_rate: 0 };
            return {
                member_id: uid,
                full_name: info.name,
                pay_rate: info.pay_rate,
                bill_rate: info.bill_rate,
                totalMinutes: data.minutes,
                totalCost: Math.round((data.minutes / 60) * info.pay_rate * 100) / 100,
                sessions: data.sessions,
            };
        }).sort((a, b) => b.totalCost - a.totalCost);

        setMembers(result);
        setLoading(false);
    }

    const totals = members.reduce((acc, m) => ({
        cost: acc.cost + m.totalCost,
        minutes: acc.minutes + m.totalMinutes,
        sessions: acc.sessions + m.sessions,
    }), { cost: 0, minutes: 0, sessions: 0 });

    const fmtTime = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    function exportCsv() {
        const rows = [
            ['Member', 'Pay Rate', 'Total Hours', 'Total Cost', 'Sessions'],
            ...members.map(m => [
                m.full_name,
                `$${m.pay_rate}/hr`,
                (m.totalMinutes / 60).toFixed(2),
                `$${m.totalCost}`,
                m.sessions,
            ]),
        ];
        const csv = rows.map(r => r.join(',')).join('\n');
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);
        a.download = `financials-${range.toLowerCase().replace(' ', '-')}.csv`;
        a.click();
    }

    return (
        <div className="p-8 max-w-[1400px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Financials</h1>
                    <p className="text-slate-500 text-sm mt-1">Pay costs based on tracked hours and real member rates</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-white border border-slate-200 rounded-lg p-1">
                        {(['This Week', 'This Month', 'All Time'] as const).map(r => (
                            <button key={r} onClick={() => setRange(r)}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${range === r ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                    <button onClick={exportCsv}
                        className="flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <KpiCard icon={<CircleDollarSign className="w-5 h-5 text-indigo-500" />}
                    label="Total Pay Cost" value={`$${totals.cost.toFixed(2)}`} sub={range} />
                <KpiCard icon={<Clock className="w-5 h-5 text-emerald-500" />}
                    label="Total Hours" value={fmtTime(totals.minutes)} sub="all members" />
                <KpiCard icon={<TrendingUp className="w-5 h-5 text-violet-500" />}
                    label="Sessions" value={totals.sessions.toString()} sub="tracked sessions" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Bar chart */}
                <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
                    <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-5">Cost by Member</h2>
                    {loading ? <Skeleton /> : members.length === 0 ? <EmptyState /> : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={members.slice(0, 6)} layout="vertical" barSize={16}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} unit="$" />
                                <YAxis type="category" dataKey="full_name" tick={{ fontSize: 11, fill: '#64748b' }} width={90} />
                                <Tooltip
                                    formatter={(v?: number) => [`$${v ?? 0}`, 'Pay Cost']}
                                    contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                                />
                                <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
                                    {members.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Table */}
                <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100">
                        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Member Breakdown</h2>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Loading financial data…</div>
                    ) : members.length === 0 ? (
                        <div className="p-12 flex flex-col items-center gap-3 text-slate-400">
                            <CircleDollarSign className="w-10 h-10 text-slate-200" />
                            <p className="text-sm font-medium">No tracked sessions yet</p>
                            <p className="text-xs text-center max-w-xs">Once members start tracking time, costs will appear here based on their pay rate set in People.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/60">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Member</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Pay Rate</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Hours</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Sessions</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m, i) => (
                                    <tr key={m.member_id} className="border-b border-slate-50 hover:bg-slate-50/40 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                                                    {m.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-slate-700">{m.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-right text-slate-500">
                                            {m.pay_rate > 0 ? `$${m.pay_rate}/hr` : <span className="text-slate-300">—</span>}
                                        </td>
                                        <td className="px-6 py-3.5 text-right text-slate-600 font-medium">{fmtTime(m.totalMinutes)}</td>
                                        <td className="px-6 py-3.5 text-right text-slate-400">{m.sessions}</td>
                                        <td className="px-6 py-3.5 text-right">
                                            <span className="font-semibold text-slate-800">${m.totalCost.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}

function KpiCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <div className="text-3xl font-light text-slate-800 tracking-tight">{value}</div>
            <div className="text-xs text-slate-400 mt-1">{sub}</div>
        </div>
    );
}
function Skeleton() { return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">Loading…</div>; }
function EmptyState() { return <div className="h-48 flex items-center justify-center text-slate-400 text-sm">No data yet</div>; }
