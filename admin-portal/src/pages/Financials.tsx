import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CircleDollarSign, TrendingUp, Clock, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { PageLayout, Card, KpiCard, Button, EmptyState, LoadingState } from '../components/ui';

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

        try {
            // Fetch members with real pay/bill rates from the members table (include auth_user_id for legacy session fallback)
            const [{ data: membersData, error: memberErr }, { data: sessions, error: sessionErr }] = await Promise.all([
                supabase.from('members').select('id, full_name, pay_rate, bill_rate, auth_user_id'),
                supabase.from('sessions')
                    .select('id, user_id, started_at, ended_at')
                    .gte('started_at', start)
                    .lte('started_at', end),
            ]);

            if (memberErr) throw memberErr;
            if (sessionErr) throw sessionErr;

            // Map sessions.user_id → member info (supporting both member.id and legacy member.auth_user_id)
            const memberMap: Record<string, { name: string; pay_rate: number; bill_rate: number }> = {};
            (membersData || []).forEach(m => {
                const info = { name: m.full_name, pay_rate: m.pay_rate ?? 0, bill_rate: m.bill_rate ?? 0 };
                memberMap[m.id] = info;
                if (m.auth_user_id) {
                    memberMap[m.auth_user_id] = info;
                }
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
                // Find member data using the user_id from sessions
                const info = memberMap[uid];
                return {
                    member_id: uid,
                    full_name: info ? info.name : (uid.slice(0, 8) + '…'),
                    pay_rate: info ? info.pay_rate : 0,
                    bill_rate: info ? info.bill_rate : 0,
                    totalMinutes: data.minutes,
                    // calculate cost only if rate exists
                    totalCost: info ? Math.round((data.minutes / 60) * info.pay_rate * 100) / 100 : 0,
                    sessions: data.sessions,
                };
            }).sort((a, b) => b.totalCost - a.totalCost);

            setMembers(result);
        } catch (error) {
            console.error('Error fetching financials:', error);
            setMembers([]);
        } finally {
            setLoading(false);
        }
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
        <PageLayout
            title="Financials"
            description="Pay costs based on tracked hours and real member rates."
            maxWidth="full"
            actions={
                <div className="flex items-center gap-3">
                    <div className="flex items-center bg-surface border border-border rounded-shell-md p-1">
                        {(['This Week', 'This Month', 'All Time'] as const).map(r => (
                            <button key={r} onClick={() => setRange(r)}
                                className={`px-3 py-1.5 rounded-shell-sm text-sm font-medium transition-colors ${range === r ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-subtle'}`}>
                                {r}
                            </button>
                        ))}
                    </div>
                    <Button variant="secondary" leftIcon={<Download className="w-4 h-4" />} onClick={exportCsv}>
                        Export CSV
                    </Button>
                </div>
            }
        >
            <div className="grid grid-cols-3 gap-4 mb-8">
                <KpiCard icon={<CircleDollarSign className="w-5 h-5 text-primary" />}
                    label="Total Pay Cost" value={`$${totals.cost.toFixed(2)}`} sub={range} />
                <KpiCard icon={<Clock className="w-5 h-5 text-primary" />}
                    label="Total Hours" value={fmtTime(totals.minutes)} sub="all members" />
                <KpiCard icon={<TrendingUp className="w-5 h-5 text-primary" />}
                    label="Sessions" value={totals.sessions.toString()} sub="tracked sessions" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                <Card title="Cost by Member">
                    {loading ? (
                        <LoadingState className="min-h-[220px]" />
                    ) : members.length === 0 ? (
                        <EmptyState title="No tracked sessions yet" description="Once members start tracking time, costs will appear here based on their pay rate set in People." className="min-h-[220px]" />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <BarChart data={members.slice(0, 6)} layout="vertical" barSize={16}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} unit="$" />
                                <YAxis type="category" dataKey="full_name" tick={{ fontSize: 11, fill: 'var(--color-text-secondary)' }} width={90} />
                                <Tooltip
                                    formatter={(v?: number) => [`$${v ?? 0}`, 'Pay Cost']}
                                    contentStyle={{ borderRadius: 8, border: '1px solid var(--color-border)', fontSize: 12 }}
                                />
                                <Bar dataKey="totalCost" radius={[0, 4, 4, 0]}>
                                    {members.slice(0, 6).map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </Card>

                <Card noPadding className="lg:col-span-3">
                    <div className="px-6 py-4 border-b border-border">
                        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Member Breakdown</h2>
                    </div>
                    {loading ? (
                        <LoadingState message="Loading financial data…" className="py-12" />
                    ) : members.length === 0 ? (
                        <EmptyState
                            icon={<CircleDollarSign className="w-6 h-6" />}
                            title="No tracked sessions yet"
                            description="Once members start tracking time, costs will appear here based on their pay rate set in People."
                        />
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border bg-surface-subtle/60">
                                    <th className="text-left px-6 py-3 text-xs font-semibold text-text-muted uppercase">Member</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Pay Rate</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Hours</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Sessions</th>
                                    <th className="text-right px-6 py-3 text-xs font-semibold text-text-muted uppercase">Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((m, i) => (
                                    <tr key={m.member_id} className="border-b border-border-subtle hover:bg-surface-subtle/50 transition-colors">
                                        <td className="px-6 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                                                    style={{ backgroundColor: COLORS[i % COLORS.length] }}>
                                                    {m.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="font-medium text-text-primary">{m.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-3.5 text-right text-text-secondary">
                                            {m.pay_rate > 0 ? `$${m.pay_rate}/hr` : <span className="text-text-muted">—</span>}
                                        </td>
                                        <td className="px-6 py-3.5 text-right text-text-secondary font-medium">{fmtTime(m.totalMinutes)}</td>
                                        <td className="px-6 py-3.5 text-right text-text-muted">{m.sessions}</td>
                                        <td className="px-6 py-3.5 text-right">
                                            <span className="font-semibold text-text-primary">${m.totalCost.toFixed(2)}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </Card>
            </div>
        </PageLayout>
    );
}
