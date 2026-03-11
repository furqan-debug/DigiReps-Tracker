import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageLayout, Card, KpiCard, Button, LoadingState } from '../components/ui';

interface Session {
    id: string;
    user_id: string;
    member_id?: string | null;
    project_id?: string | null;
    started_at: string;
    ended_at: string | null;
}

interface DailyEntry {
    date: string;
    sessions: Session[];
    totalMinutes: number;
    activeMinutes: number;
    activityPercent: number;
}

interface MemberInfo {
    id: string;
    full_name: string;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function Timesheets() {
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [loading, setLoading] = useState(true);
    const [weekOffset, setWeekOffset] = useState(0);

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay() + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    useEffect(() => { fetchMembers(); }, []);
    useEffect(() => { fetchTimesheets(); }, [weekOffset, selectedMember]);

    async function fetchMembers() {
        const { data } = await supabase.from('members').select('id, full_name').order('full_name');
        setMembers(data || []);
    }

    async function fetchTimesheets() {
        setLoading(true);
        try {
            let query = supabase.from('sessions')
                .select('id, user_id, started_at, ended_at')
                .gte('started_at', weekStart.toISOString())
                .lte('started_at', weekEnd.toISOString())
                .order('started_at', { ascending: true });

            if (selectedMember !== 'all') {
                query = query.eq('user_id', selectedMember);
            }

            const { data: sessions, error: sessionErr } = await query;
            if (sessionErr) throw sessionErr;

            const { data: activityData, error: activityErr } = await supabase
                .from('activity_samples')
                .select('session_id, idle')
                .gte('recorded_at', weekStart.toISOString())
                .lte('recorded_at', weekEnd.toISOString());

            if (activityErr) throw activityErr;

            const dailyMap: Record<string, DailyEntry> = {};
            for (let i = 0; i < 7; i++) {
                const d = new Date(weekStart);
                d.setDate(weekStart.getDate() + i);
                const key = d.toISOString().split('T')[0]!;
                dailyMap[key] = { date: key, sessions: [], totalMinutes: 0, activeMinutes: 0, activityPercent: 0 };
            }

            (sessions || []).forEach(s => {
                const key = s.started_at.split('T')[0]!;
                if (!dailyMap[key]) return;
                dailyMap[key].sessions.push(s as Session);
                const startMs = new Date(s.started_at).getTime();
                const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
                dailyMap[key].totalMinutes += Math.max(0, Math.round((endMs - startMs) / 60000));
            });

            const sessionDay: Record<string, string> = {};
            (sessions || []).forEach(s => { sessionDay[s.id] = s.started_at.split('T')[0]!; });

            (activityData || []).forEach(a => {
                const day = sessionDay[a.session_id];
                if (!day || !dailyMap[day]) return;
                if (!a.idle) dailyMap[day].activeMinutes++;
            });

            const result = Object.values(dailyMap).map(d => ({
                ...d,
                activityPercent: d.totalMinutes > 0
                    ? Math.min(100, Math.round((d.activeMinutes / d.totalMinutes) * 100))
                    : 0,
            }));

            setEntries(result);
        } catch (error) {
            console.error('Error fetching timesheets:', error);
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }

    const weekDays = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    });

    const totalMins = entries.reduce((a, e) => a + e.totalMinutes, 0);
    const totalSessions = entries.reduce((a, e) => a + e.sessions.length, 0);
    const fmtTime = (min: number) => {
        const h = Math.floor(min / 60);
        const m = min % 60;
        return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };

    const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

    return (
        <PageLayout
            title="Timesheets"
            description="Weekly time tracked per member"
            maxWidth="full"
            actions={
                <div className="flex items-center gap-3">
                    <select value={selectedMember} onChange={e => setSelectedMember(e.target.value)}
                        className="border border-border bg-surface rounded-shell-md px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-primary">
                        <option value="all">All members</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                    </select>
                    <div className="flex items-center gap-1 bg-surface border border-border rounded-shell-md p-1">
                        <button onClick={() => setWeekOffset(w => w - 1)}
                            className="p-1.5 hover:bg-surface-subtle rounded-shell-sm transition-colors text-text-muted hover:text-text-primary">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-sm font-medium text-text-primary px-2 min-w-[180px] text-center">{weekLabel}</span>
                        <button onClick={() => setWeekOffset(w => w + 1)}
                            className="p-1.5 hover:bg-surface-subtle rounded-shell-sm transition-colors text-text-muted hover:text-text-primary">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                    {weekOffset !== 0 && (
                        <Button variant="secondary" onClick={() => setWeekOffset(0)}>Today</Button>
                    )}
                </div>
            }
        >
            <div className="grid grid-cols-3 gap-4 mb-8">
                <KpiCard icon={<Clock className="w-4 h-4 text-primary" />} label="Total Tracked" value={fmtTime(totalMins)} />
                <KpiCard icon={<Clock className="w-4 h-4 text-primary" />} label="Sessions" value={totalSessions.toString()} />
                <KpiCard icon={<Clock className="w-4 h-4 text-primary" />} label="Days Active"
                    value={entries.filter(e => e.totalMinutes > 0).length + ' / 7'} />
            </div>

            <Card noPadding>
                <div className="px-6 py-4 border-b border-border">
                    <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Daily Breakdown</h2>
                </div>

                {loading ? (
                    <LoadingState message="Loading timesheet…" className="py-12" />
                ) : (
                    <div className="grid grid-cols-7 divide-x divide-border-subtle">
                        {weekDays.map((d, i) => {
                            const entry = entries[i]!;
                            const isToday = d.toDateString() === today.toDateString();
                            const hasFuture = d > today;

                            return (
                                <div key={i} className={`p-4 min-h-[140px] flex flex-col ${isToday ? 'bg-primary/5' : ''}`}>
                                    <div className="mb-3">
                                        <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-text-muted'}`}>
                                            {DAYS_SHORT[d.getDay()]}
                                        </span>
                                        <div className={`text-lg font-semibold mt-0.5 ${isToday ? 'text-primary' : 'text-text-primary'}`}>
                                            {d.getDate()}
                                        </div>
                                    </div>

                                    {hasFuture ? (
                                        <span className="text-xs text-text-muted">—</span>
                                    ) : entry.totalMinutes === 0 ? (
                                        <span className="text-xs text-text-muted">No sessions</span>
                                    ) : (
                                        <div className="flex flex-col gap-2 flex-1">
                                            <div className="text-base font-semibold text-text-primary">
                                                {fmtTime(entry.totalMinutes)}
                                            </div>
                                            <div className="text-xs text-text-muted">
                                                {entry.sessions.length} session{entry.sessions.length !== 1 ? 's' : ''}
                                            </div>
                                            <div className="mt-auto">
                                                <div className="h-1.5 bg-surface-subtle rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full transition-all"
                                                        style={{
                                                            width: `${entry.activityPercent}%`,
                                                            backgroundColor: entry.activityPercent > 60 ? '#059669' : entry.activityPercent > 30 ? '#d97706' : '#ef4444',
                                                        }}
                                                    />
                                                </div>
                                                <span className="text-[10px] text-text-muted mt-1 block">{entry.activityPercent}% active</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>
        </PageLayout>
    );
}
