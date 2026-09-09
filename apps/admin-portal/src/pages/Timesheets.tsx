import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
    ChevronLeft, ChevronRight,
    Users,
    Plus, Filter,
    Clock, FolderOpen,
    MoreVertical, Edit2, Trash2
} from 'lucide-react';
import { LoadingState, Modal, EmptyState, FilterSelect, DatePicker } from '../components/ui';
import clsx from 'clsx';
import { getGroupingDateInTz, formatDuration, STALE_THRESHOLD_MS } from '../lib/dataUtils';
import { useAuth } from '../context/AuthContext';

interface Session {
    id: string;
    user_id: string;
    project_id?: string;
    project_name?: string;
    started_at: string;
    ended_at: string | null;
    manual?: boolean;
    activity_percent?: number;
    idle_percent?: number;
    manual_percent?: number;
    duration_mins?: number;
    offline_mins?: number;
    user_name?: string;
    display_timezone?: string;
    is_active?: boolean;
    effective_end?: string;
    original_started_at?: string;
    original_ended_at?: string | null;
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
    auth_user_id?: string;
    full_name: string;
    timezone?: string;
    idle_limit?: number | null;
}

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Module-level cache (cleared on unmount)
let timesheetsCache: any = null;
let timesheetsCacheKey: string | null = null;

export function Timesheets() {
    const { profile, managedMemberIds, managedProjectIds, displayTimezone, timezoneReady } = useAuth();
    const organizationId = profile?.organization_id;
    const navigate = useNavigate();

    const [viewMode, setViewMode] = useState<'daily' | 'weekly' | 'calendar'>('daily');
    const [entries, setEntries] = useState<DailyEntry[]>([]);
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [activeTimezone, setActiveTimezone] = useState<string>('Org Local');
    const [orgTimezone, setOrgTimezone] = useState<string>('UTC');
    // orgTimezone starts as a placeholder and is filled in by fetchOrgSettings().
    // The default activeTimezone is 'Org Local', so querying before this resolves
    // buckets every session into UTC days instead of the org's.
    const [orgSettingsLoaded, setOrgSettingsLoaded] = useState(false);
    const [projects, setProjects] = useState<any[]>([]);
    const [projectMembersMap, setProjectMembersMap] = useState<Record<string, string[]>>({}); // memberId -> projectId[]
    const [selectedMember, setSelectedMember] = useState<string>('all');
    const [filterProjectId, setFilterProjectId] = useState<string>('all');

    const toProperCase = (str: string) => {
        if (!str) return '';
        if (str.includes('@')) return str.toLowerCase();
        return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(() => {
        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: displayTimezone || 'UTC' });
        return new Date(tzDateStr + 'T12:00:00');
    });

    // The initializer above runs once at mount, while displayTimezone is still the
    // provisional 'UTC', and is never recomputed — so the page can open on the
    // wrong calendar day. Re-derive it once the real timezone is known. The ref
    // limits this to initialization: afterwards the date picker and arrows own
    // selectedDate and a later timezone switch must not move the user off it.
    const didInitDateRef = useRef(false);
    const [dateInitialized, setDateInitialized] = useState(false);
    useEffect(() => {
        if (didInitDateRef.current || !timezoneReady) return;
        didInitDateRef.current = true;
        const tzDateStr = new Date().toLocaleDateString('en-CA', { timeZone: displayTimezone || 'UTC' });
        const corrected = new Date(tzDateStr + 'T12:00:00');
        setSelectedDate(prev => (prev.getTime() === corrected.getTime() ? prev : corrected));
        setDateInitialized(true);
    }, [timezoneReady, displayTimezone]);

    // Monotonic id for timesheet fetches — only the newest may write entries or
    // the cache, so a slow earlier response cannot overwrite newer data.
    const fetchSeqRef = useRef(0);
    const [showFilters, setShowFilters] = useState(false);
    const [showAddTime, setShowAddTime] = useState(false);

    // Add Time Form State
    const [addTimeData, setAddTimeData] = useState({
        projectId: '',
        userId: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '17:00'
    });

    const [showEditTimeModal, setShowEditTimeModal] = useState(false);
    const [editingSession, setEditingSession] = useState<Session | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deletingSession, setDeletingSession] = useState<Session | null>(null);

    const range = useMemo(() => {
        const start = new Date(selectedDate);
        const end = new Date(selectedDate);
        if (viewMode === 'daily') {
            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);
        } else {
            const day = start.getDay();
            const diff = start.getDate() - day + (day === 0 ? -6 : 1);
            start.setDate(diff);
            start.setHours(0, 0, 0, 0);
            end.setDate(start.getDate() + 6);
            end.setHours(23, 59, 59, 999);
        }
        return { start, end };
    }, [selectedDate, viewMode]);

    // Timesheet se Report page par jump karne ke liye
    const openReportForMember = (userId: string) => {
        // Timesheet ka user_id ho sakta hai auth_user_id ho; usay members.id se match karo
        const member = members.find(m => m.id === userId || m.auth_user_id === userId);
        const memberId = member?.id || userId;

        // Current view ke hisaab se start aur end date
        const pad = (n: number) => String(n).padStart(2, '0');
        const toStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const startStr = toStr(range.start);
        const endStr = toStr(range.end);

        navigate(`/dashboard/reports?member=${memberId}&start=${startStr}&end=${endStr}`);
    };

    useEffect(() => {
        if (organizationId) {
            fetchMembers();
            fetchOrgSettings();
            fetchProjects();
        }
    }, [organizationId]);

    // Clear cache on unmount so stale data doesn't bleed across navigation
    useEffect(() => {
        return () => {
            timesheetsCache = null;
            timesheetsCacheKey = null;
        };
    }, []);

    useEffect(() => {
        // Wait until members have been fetched before running the query.
        // This prevents selectedMember filtering from firing with an empty members
        // array (which would cause members.find() to return undefined and send
        // an unfiltered query, returning everyone's data instead of the selected member).
        if (!organizationId) return;
        // Wait for the org timezone and the corrected date before querying.
        // Without this the first query ran with the 'UTC' placeholder, and since
        // orgTimezone was not a dependency the effect never re-ran once the real
        // zone arrived — so UTC-bucketed rows persisted for the whole visit.
        if (!orgSettingsLoaded || !dateInitialized) return;
        if (selectedMember !== 'all' && members.length === 0) return;
        fetchTimesheets();
    }, [range, selectedMember, filterProjectId, activeTimezone, orgTimezone, orgSettingsLoaded, dateInitialized, members, projects, organizationId]);

    async function fetchOrgSettings() {
        if (!organizationId) return;
        const { data } = await supabase.from('organizations').select('settings').eq('id', organizationId).single();
        if (data?.settings?.orgTimezone) setOrgTimezone(data.settings.orgTimezone);
        // Mark resolved either way — if the org has no orgTimezone configured, the
        // 'UTC' placeholder is the final answer and the query must not stay blocked.
        setOrgSettingsLoaded(true);
    }

    async function fetchMembers() {
        let query = supabase.from('members')
            .select('id, auth_user_id, full_name, timezone, idle_limit')
            .eq('organization_id', organizationId)
            .order('full_name');

        const isScoped = profile?.role === 'Manager' || profile?.role === 'Client';
        if (isScoped && managedMemberIds) {
            const memberIdsFilter = managedMemberIds.length > 0 ? managedMemberIds : ['00000000-0000-0000-0000-000000000000'];
            query = query.in('id', memberIdsFilter);
        }

        const { data } = await query;
        setMembers(data as MemberInfo[] || []);
    }

    async function fetchProjects() {
        let query = supabase.from('projects')
            .select('id, name, project_members(member_id)')
            .eq('organization_id', organizationId)
            .eq('status', 'Active')
            .order('name');

        const isScoped = profile?.role === 'Manager' || profile?.role === 'Client';
        if (isScoped && managedProjectIds) {
            const projectIdsFilter = managedProjectIds.length > 0 ? managedProjectIds : ['00000000-0000-0000-0000-000000000000'];
            query = query.in('id', projectIdsFilter);
        }

        const { data } = await query;
        const projectList = data || [];
        setProjects(projectList);

        // Build memberId -> projectId[] map for filtering
        const map: Record<string, string[]> = {};
        projectList.forEach((p: any) => {
            (p.project_members || []).forEach((pm: any) => {
                if (!map[pm.member_id]) map[pm.member_id] = [];
                map[pm.member_id].push(p.id);
            });
        });
        setProjectMembersMap(map);
    }

    async function fetchTimesheets(forceRefresh = false) {
        // orgTimezone is part of the key: with activeTimezone 'Org Local' the same
        // filters produce different day buckets under a different zone, so without
        // it a UTC-bucketed result could be served back after the zone resolved.
        const cacheKey = `${range.start.toISOString()}_${range.end.toISOString()}_${selectedMember}_${filterProjectId}_${activeTimezone}_${orgTimezone}_${viewMode}`;
        const mySeq = ++fetchSeqRef.current;

        if (!forceRefresh && timesheetsCache && timesheetsCacheKey === cacheKey) {
            setEntries(timesheetsCache.entries);
            setLoading(false);
            return;
        }

        setLoading(true);
        try {
            // Auto-terminate any ghost sessions in database based on Termination Grace Period
            if (organizationId) {
                await supabase.rpc('rpc_auto_terminate_inactive_sessions', { p_org_id: organizationId });
            }

            const fetchStart = new Date(range.start.getTime() - 24 * 60 * 60 * 1000);
            const fetchEnd = new Date(range.end.getTime() + 24 * 60 * 60 * 1000);

            let query = supabase.from('sessions')
                .select('id, user_id, project_id, started_at, ended_at, manual')
                .eq('organization_id', organizationId)
                .lt('started_at', fetchEnd.toISOString())
                .or(`ended_at.is.null,ended_at.gt.${fetchStart.toISOString()}`)
                .order('started_at', { ascending: false });

            if (selectedMember !== 'all' && selectedMember !== '') {
                const member = members.find(m => m.id === selectedMember);
                const userIds = Array.from(new Set([member?.id, member?.auth_user_id].filter(Boolean) as string[]));
                if (userIds.length > 0) {
                    query = query.in('user_id', userIds);
                } else {
                    query = query.in('user_id', ['none']);
                }
            } else if (profile?.role === 'Manager' || profile?.role === 'Client') {
                const userIds = Array.from(new Set(members.flatMap(m => [m.id, m.auth_user_id].filter(Boolean) as string[])));
                if (userIds.length > 0) {
                    query = query.in('user_id', userIds);
                } else {
                    query = query.in('user_id', ['none']);
                }
            }

            if (filterProjectId !== 'all' && filterProjectId !== '') {
                query = query.eq('project_id', filterProjectId);
            } else if ((profile?.role === 'Manager' || profile?.role === 'Client') && managedProjectIds) {
                if (managedProjectIds.length > 0) {
                    query = query.in('project_id', managedProjectIds);
                } else {
                    query = query.in('project_id', ['00000000-0000-0000-0000-000000000000']);
                }
            }

            const { data: rawSessions, error: sessionErr } = await query;
            if (sessionErr) throw sessionErr;

            const projectMap = new Map(projects.map(p => [p.id, p.name]));
            const memberMap = new Map();
            members.forEach(m => {
                memberMap.set(m.id, m);
                if (m.auth_user_id) memberMap.set(m.auth_user_id, m);
            });

            console.log(`[Timesheets] Loaded ${(rawSessions || []).length} session(s)`);
            const sessions = (rawSessions || []).map((s: any) => ({
                ...s,
                project_name: projectMap.get(s.project_id) || 'No Project'
            })) as Session[];

            const sessionIds = sessions.map((s: Session) => s.id);
            let sessionStats: any[] = [];

            if (sessionIds.length > 0) {
                try {
                    const { data: statsData, error: statsErr } = await supabase.rpc('get_sessions_activity_stats', {
                        p_session_ids: sessionIds
                    });
                    if (statsErr) throw statsErr;
                    sessionStats = statsData || [];
                } catch (actErr) {
                    console.error('Activity stats fetch failed:', actErr);
                }
            }

            const dailyMap: Record<string, DailyEntry> = {};
            const numDays = viewMode === 'daily' ? 1 : 7;
            for (let i = 0; i < numDays; i++) {
                const d = new Date(range.start);
                d.setDate(range.start.getDate() + i);
                const year = d.getFullYear();
                const month = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const key = `${year}-${month}-${day}`;
                dailyMap[key] = { date: key, sessions: [], totalMinutes: 0, activeMinutes: 0, activityPercent: 0 };
            }

            sessions.forEach((s: Session) => {
                const member = memberMap.get(s.user_id);
                let tz;
                if (activeTimezone === 'User Local') tz = member?.timezone || undefined;
                else if (activeTimezone === 'Admin Local') tz = undefined;
                else if (activeTimezone === 'Org Local') tz = orgTimezone;
                else tz = activeTimezone;

                const parseDbTimestamp = (ts: string | null | undefined) => {
                    if (!ts) return null;
                    const normalized = (ts.endsWith('Z') || ts.includes('+') || /-\d{2}:\d{2}$/.test(ts)) ? ts : ts + 'Z';
                    return new Date(normalized).getTime();
                };

                const stats = sessionStats.find((st: any) => st.session_id === s.id);
                const durationMins = stats && stats.duration_mins !== undefined ? Number(stats.duration_mins) : (stats ? parseInt(stats.sample_count || '0') : 0);
                const sampleCount = durationMins;
                const offlineMins = stats ? parseInt(stats.offline_count || '0') : 0;

                const startedAtMs = parseDbTimestamp(s.started_at) || new Date(s.started_at).getTime();
                const lastSampleTime = stats && stats.last_sample_at ? (parseDbTimestamp(stats.last_sample_at) || startedAtMs) : startedAtMs;
                const score = stats && stats.activity_percent !== undefined
                    ? Math.round(Number(stats.activity_percent))
                    : (stats && stats.sample_count ? Math.round(parseInt(stats.activity_sum) / parseInt(stats.sample_count)) : 0);
                const isManual = s.manual === true;

                const nowMs = new Date().getTime();
                const isTrulyActive = !isManual && !s.ended_at && (nowMs - lastSampleTime < STALE_THRESHOLD_MS);

                let effectiveEndMs = nowMs;
                if (s.ended_at) {
                    effectiveEndMs = parseDbTimestamp(s.ended_at) || new Date(s.ended_at).getTime();
                } else if (isTrulyActive) {
                    effectiveEndMs = nowMs;
                } else if (sampleCount > 0) {
                    effectiveEndMs = Math.max(lastSampleTime, startedAtMs);
                } else {
                    effectiveEndMs = Math.min(nowMs, startedAtMs + (10 * 60000));
                }

                // Convert to target timezone dates to measure local day bounds overlap
                const startLocalStr = new Date(startedAtMs).toLocaleString('en-US', { timeZone: tz });
                const endLocalStr = new Date(effectiveEndMs).toLocaleString('en-US', { timeZone: tz });
                const startLocal = new Date(startLocalStr);
                const endLocal = new Date(endLocalStr);

                // DEBUG LOG FOR FIRST SESSION
                if (s.id === sessions[0]?.id) {
                    console.log(`DEBUG: startedAtMs=${startedAtMs}, effectiveEndMs=${effectiveEndMs}, tz=${tz}`);
                }

                Object.keys(dailyMap).forEach(key => {
                    const dayStartLocal = new Date(`${key}T00:00:00`);
                    const dayEndLocal = new Date(`${key}T23:59:59.999`);

                    const overlapStartMs = Math.max(startLocal.getTime(), dayStartLocal.getTime());
                    const overlapEndMs = Math.min(endLocal.getTime(), dayEndLocal.getTime());

                    // Check if the session overlaps with this calendar day
                    if (overlapEndMs > overlapStartMs || (isTrulyActive && overlapEndMs >= overlapStartMs && overlapEndMs === dayEndLocal.getTime())) {

                        // Calculate absolute UTC timestamps for the segment
                        const segmentAbsoluteStartMs = startedAtMs + (overlapStartMs - startLocal.getTime());
                        const segmentAbsoluteEndMs = effectiveEndMs + (overlapEndMs - endLocal.getTime());

                        // The WINDOW this segment spans — used only for the times shown
                        // on the row, never for the hours credited.
                        let segmentSpanMins = (segmentAbsoluteEndMs - segmentAbsoluteStartMs) / 60000;
                        if (segmentSpanMins < 0) segmentSpanMins = 0;

                        const totalSpanMins = Math.max(1, (effectiveEndMs - startedAtMs) / 60000);
                        const durationRatio = segmentSpanMins / totalSpanMins;
                        const segmentOfflineMins = Math.round(offlineMins * durationRatio);

                        // The TIME CREDITED is one minute per recorded sample, which is
                        // what Reports, Amounts Owed and the desktop app all count. The
                        // wall-clock span is not the same number: a session keeps running
                        // while the machine sleeps or the tracker is paused, and those
                        // minutes produce no sample, so span always reads high.
                        // Manual entries have no samples by definition, so they are still
                        // credited by their span — that span IS the entry.
                        const segmentDurationMins = isManual
                            ? segmentSpanMins
                            : sampleCount * durationRatio;

                        dailyMap[key].sessions.push({
                            ...s,
                            original_started_at: s.started_at,
                            original_ended_at: s.ended_at,
                            started_at: new Date(segmentAbsoluteStartMs).toISOString(),
                            ended_at: isTrulyActive && overlapEndMs === endLocal.getTime() ? null : new Date(segmentAbsoluteEndMs).toISOString(),
                            activity_percent: isManual ? 0 : score,
                            idle_percent: isManual ? 0 : (100 - score),
                            manual_percent: isManual ? 100 : 0,
                            duration_mins: segmentDurationMins,
                            offline_mins: segmentOfflineMins,
                            user_name: member?.full_name || 'System User',
                            display_timezone: tz,
                            is_active: isTrulyActive && (overlapEndMs === endLocal.getTime()),
                            effective_end: isTrulyActive ? undefined : new Date(segmentAbsoluteEndMs).toISOString()
                        });
                    }
                });
            });

            const result = Object.values(dailyMap).map(d => {
                const totalMins = d.sessions.reduce((acc, s) => acc + (s.duration_mins || 0), 0);
                const avgActivity = d.sessions.length > 0
                    ? d.sessions.reduce((acc, s) => acc + (s.activity_percent || 0), 0) / d.sessions.length
                    : 0;
                return {
                    ...d,
                    totalMinutes: Math.round(totalMins),
                    activityPercent: Math.round(avgActivity)
                };
            });

            // A newer fetch superseded this one — discard rather than overwrite.
            if (mySeq !== fetchSeqRef.current) return;

            setEntries(result);

            // Update cache
            timesheetsCache = { entries: result };
            timesheetsCacheKey = cacheKey;
        } catch (error) {
            console.error('Error fetching timesheets:', error);
            if (mySeq === fetchSeqRef.current) setEntries([]);
        } finally {
            // Only the newest request may clear the spinner.
            if (mySeq === fetchSeqRef.current) setLoading(false);
        }
    }

    async function handleManualAddTime() {
        if (!addTimeData.projectId || !addTimeData.userId) {
            alert('Please select both a project and a member.');
            return;
        }
        try {
            const startStr = `${addTimeData.date}T${addTimeData.startTime}:00`;
            const endStr = `${addTimeData.date}T${addTimeData.endTime}:00`;
            const { error } = await supabase.from('sessions').insert({
                project_id: addTimeData.projectId,
                user_id: addTimeData.userId,
                organization_id: organizationId,
                started_at: new Date(startStr).toISOString(),
                ended_at: new Date(endStr).toISOString(),
                manual: true
            } as any);
            if (error) throw error;
            setShowAddTime(false);
            fetchTimesheets(true);
        } catch (err) {
            console.error('Failed to add manual time:', err);
            alert('Error adding manual time entry.');
        }
    }

    async function handleEditSubmit() {
        if (!editingSession || !addTimeData.projectId || !addTimeData.userId) return;
        try {
            const startStr = `${addTimeData.date}T${addTimeData.startTime}:00`;
            const endStr = `${addTimeData.date}T${addTimeData.endTime}:00`;
            const { error } = await supabase.from('sessions').update({
                project_id: addTimeData.projectId,
                user_id: addTimeData.userId,
                started_at: new Date(startStr).toISOString(),
                ended_at: new Date(endStr).toISOString()
            }).eq('id', editingSession.id);
            if (error) throw error;
            setShowEditTimeModal(false);
            setEditingSession(null);
            fetchTimesheets(true);
        } catch (err) {
            console.error('Failed to edit manual time:', err);
            alert('Error editing time entry.');
        }
    }

    async function handleDeleteSubmit() {
        if (!deletingSession) return;
        try {
            const { error } = await supabase.from('sessions').delete().eq('id', deletingSession.id);
            if (error) throw error;
            setShowDeleteConfirm(false);
            setDeletingSession(null);
            fetchTimesheets(true);
        } catch (err) {
            console.error('Failed to delete time:', err);
            alert('Error deleting time entry.');
        }
    }

    const openEditModal = (session: any) => {
        const start = new Date(session.original_started_at || session.started_at);
        const end = (session.original_ended_at || session.ended_at) ? new Date(session.original_ended_at || session.ended_at) : new Date(session.effective_end || new Date());

        const pad = (n: number) => n.toString().padStart(2, '0');
        const localDateStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}`;

        setAddTimeData({
            projectId: session.project_id || '',
            userId: session.user_id || '',
            date: localDateStr,
            startTime: pad(start.getHours()) + ':' + pad(start.getMinutes()),
            endTime: pad(end.getHours()) + ':' + pad(end.getMinutes())
        });
        setEditingSession(session);
        setShowEditTimeModal(true);
    };

    const openDeleteModal = (session: Session) => {
        setDeletingSession(session);
        setShowDeleteConfirm(true);
    };

    const navigateDate = (direction: number) => {
        const next = new Date(selectedDate);
        if (viewMode === 'daily') next.setDate(next.getDate() + direction);
        else next.setDate(next.getDate() + direction * 7);
        setSelectedDate(next);
    };

    return (
        <div className="flex flex-col min-h-screen bg-surface font-sans text-text-main">
            <header className="px-8 py-6 flex items-center justify-between border-b border-border shrink-0">
                <div className="space-y-2">
                    <h1 className="text-4xl font-bold heading-gradient tracking-tight font-heading">Timesheets</h1>
                    <p className="text-[14px] font-bold text-text-muted tracking-tight">Verify and refine team temporal records</p>
                </div>
            </header>

            <div className="px-3 py-3 min-[900px]:px-8 min-[900px]:py-4 flex flex-col min-[900px]:flex-row min-[900px]:flex-wrap items-stretch min-[900px]:items-center justify-between gap-3 min-[900px]:gap-4 border-b border-slate-50 sticky top-0 bg-surface/95 backdrop-blur-md z-30 w-full min-w-0">

                {/* Date + timezone */}
                <div className="flex flex-col min-[900px]:flex-row items-stretch min-[900px]:items-center gap-3 min-[900px]:gap-6 w-full min-[900px]:w-auto min-w-0">

                    {/* Date navigation */}
                    <div className="flex items-center bg-surface border border-border rounded-md p-1 shadow-shell-sm h-12 w-full min-[900px]:w-auto min-w-0">

                        <button
                            onClick={() => navigateDate(-1)}
                            className="p-3 shrink-0 hover:bg-surface-hover rounded-md transition-all text-text-muted hover:text-primary"
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex-1 min-w-0">
                            <DatePicker
                                value={getGroupingDateInTz(selectedDate, undefined)}
                                onChange={(val) => {
                                    if (val) {
                                        setSelectedDate(new Date(val + 'T12:00:00'));
                                    }
                                }}
                                className="w-full min-w-0"
                            />
                        </div>

                        <button
                            onClick={() => navigateDate(1)}
                            className="p-3 shrink-0 hover:bg-surface-hover rounded-md transition-all text-text-muted hover:text-primary"
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>

                    </div>

                    {/* Timezone */}
                    <div className="h-12 w-full min-[900px]:w-auto min-[900px]:min-w-[240px] min-w-0">
                        <FilterSelect
                            icon={<Clock className="w-4 h-4 shrink-0" />}
                            value={activeTimezone}
                            onChange={setActiveTimezone}
                            options={[
                                { id: 'Admin Local', name: 'Admin Local (Browser)' },
                                { id: 'Org Local', name: 'Organization Timezone' },
                                { id: 'User Local', name: 'User Local (Auto)' },
                                { id: 'UTC', name: 'UTC (Universal)' },
                                ...Array.from(
                                    new Set(
                                        members
                                            .map(m => m.timezone)
                                            .filter(tz => tz && tz !== 'UTC')
                                    )
                                )
                                    .sort()
                                    .map(tz => ({
                                        id: tz as string,
                                        name: tz as string
                                    }))
                            ]}
                        />
                    </div>
                </div>


                {/* View switcher */}
                <div className="flex bg-main/50 p-1 rounded-md border border-border/50 h-12 w-full min-[900px]:w-auto min-w-0">

                    {(['daily', 'weekly', 'calendar'] as const).map(mode => (
                        <button
                            key={mode}
                            onClick={() => setViewMode(mode)}
                            className={clsx(
                                "flex-1 min-[900px]:flex-none px-2 min-[900px]:px-8 rounded-md text-[11px] min-[900px]:text-[12px] font-bold transition-all h-full whitespace-nowrap",
                                viewMode === mode
                                    ? "bg-[#F2CB00] text-[#001B4D] shadow-shell-sm"
                                    : "text-text-muted hover:text-slate-600"
                            )}
                        >
                            {mode.charAt(0).toUpperCase() + mode.slice(1)}
                        </button>
                    ))}

                </div>


                {/* Member + actions */}
                <div className="flex flex-col min-[900px]:flex-row items-stretch min-[900px]:items-center gap-3 min-[900px]:gap-4 w-full min-[900px]:w-auto min-w-0">

                    {/* Member */}
                    <div className="h-12 w-full min-[900px]:w-auto min-[900px]:min-w-[220px] min-w-0">
                        <FilterSelect
                            icon={<Users className="w-4 h-4 shrink-0" />}
                            value={selectedMember}
                            onChange={setSelectedMember}
                            options={[
                                { id: 'all', name: 'All Members' },
                                ...members.map((m: MemberInfo) => ({
                                    id: m.id,
                                    name: m.full_name
                                }))
                            ]}
                        />
                    </div>

                    {/* Buttons */}
                    <div className="grid grid-cols-2 gap-3 w-full min-[900px]:w-auto min-[900px]:flex">

                        <button
                            onClick={() => setShowFilters(true)}
                            className="flex items-center justify-center gap-2 px-4 min-[900px]:px-6 h-12 bg-surface border border-border text-text-muted rounded-md text-[13px] font-bold shadow-shell-sm hover:bg-surface-hover transition-all whitespace-nowrap min-w-0"
                        >
                            <Filter className="w-4 h-4 shrink-0" />
                            <span>Filter</span>
                        </button>

                        <button
                            onClick={() => {
                                setAddTimeData({
                                    projectId: '',
                                    userId: '',
                                    date: new Date().toISOString().split('T')[0],
                                    startTime: '09:00',
                                    endTime: '17:00'
                                });
                                setShowAddTime(true);
                            }}
                            className="flex items-center justify-center gap-2 px-4 min-[900px]:px-8 h-12 bg-primary text-white rounded-md text-[13px] font-bold shadow-shell-sm hover:bg-primary/90 transition-all whitespace-nowrap min-w-0"
                        >
                            <Plus className="w-5 h-5 shrink-0" />
                            <span>Add time</span>
                        </button>

                    </div>
                </div>

            </div>

            <main className="flex-1 min-h-0 overflow-y-auto px-4 py-5 min-[900px]:px-10 min-[900px]:py-10 custom-scrollbar min-w-0">
                {loading ? (
                    <div className="flex items-center justify-center min-h-[420px]">
                        <LoadingState />
                    </div>
                ) : (
                    <div className="w-full max-w-[1600px] mx-auto min-w-0 animate-in fade-in slide-in-from-bottom-1 duration-400">
                        {viewMode === 'daily' && (
                            <DailyView
                                entries={entries}
                                selectedMember={selectedMember}
                                toProperCase={toProperCase}
                                onEditSession={openEditModal}
                                onDeleteSession={openDeleteModal}
                                onRowClick={openReportForMember}
                            />
                        )}

                        {viewMode === 'weekly' && (
                            <WeeklyView
                                entries={entries}
                                onDayClick={(d: string) => navigate(`/dashboard/reports?start=${d}&end=${d}`)}
                            />
                        )}

                        {viewMode === 'calendar' && (
                            <CalendarView
                                entries={entries}
                                onDayClick={(d: string) => navigate(`/dashboard/reports?start=${d}&end=${d}`)}
                            />
                        )}
                    </div>
                )}
            </main>


            <Modal isOpen={showFilters} onClose={() => setShowFilters(false)} title="Filters" allowOverflow={true}>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Project Scope</label>
                        <div className="h-11">
                            <FilterSelect
                                icon={<FolderOpen className="w-3.5 h-3.5" />}
                                value={filterProjectId}
                                onChange={setFilterProjectId}
                                options={[
                                    { id: 'all', name: 'All Projects' },
                                    ...projects.map(p => ({ id: p.id, name: p.name }))
                                ]}
                            />
                        </div>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showAddTime} onClose={() => setShowAddTime(false)} title="Manual Time Entry">
                <div className="space-y-5 py-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Team Member</label>
                        <div className="h-11">
                            <FilterSelect
                                icon={<Users className="w-3.5 h-3.5" />}
                                value={addTimeData.userId}
                                onChange={(val) => setAddTimeData({ ...addTimeData, userId: val, projectId: '' })}
                                options={[
                                    { id: '', name: 'Select member...' },
                                    ...members.map(m => ({ id: m.id, name: m.full_name }))
                                ]}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Project</label>
                        <div className="h-11">
                            <FilterSelect
                                icon={<FolderOpen className="w-3.5 h-3.5" />}
                                value={addTimeData.projectId}
                                onChange={(val) => setAddTimeData({ ...addTimeData, projectId: val })}
                                options={[
                                    { id: '', name: addTimeData.userId ? 'Select project...' : 'Select a member first...' },
                                    ...projects
                                        .filter(p => !addTimeData.userId || (projectMembersMap[addTimeData.userId] || []).includes(p.id))
                                        .map(p => ({ id: p.id, name: p.name }))
                                ]}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Date</label>
                        <DatePicker
                            value={addTimeData.date}
                            onChange={(val) => setAddTimeData({ ...addTimeData, date: val })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted ">Start</label>
                            <input type="time" className="w-full h-11 bg-surface-hover border border-border rounded-md px-4 text-[11px] font-bold text-text-main outline-none focus:border-primary transition-all" value={addTimeData.startTime} onChange={(e) => setAddTimeData({ ...addTimeData, startTime: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted ">End</label>
                            <input type="time" className="w-full h-11 bg-surface-hover border border-border rounded-md px-4 text-[11px] font-bold text-text-main outline-none focus:border-primary transition-all" value={addTimeData.endTime} onChange={(e) => setAddTimeData({ ...addTimeData, endTime: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button onClick={handleManualAddTime} className="px-8 h-11 bg-primary text-white rounded-md text-[11px] font-bold shadow-shell-sm hover:bg-primary/90 transition-all">Submit Entry</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showEditTimeModal} onClose={() => setShowEditTimeModal(false)} title="Edit Time Entry">
                <div className="space-y-5 py-4">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Team Member</label>
                        <div className="h-11">
                            <FilterSelect
                                icon={<Users className="w-3.5 h-3.5" />}
                                value={addTimeData.userId}
                                onChange={(val) => setAddTimeData({ ...addTimeData, userId: val, projectId: '' })}
                                options={[
                                    { id: '', name: 'Select member...' },
                                    ...members.map(m => ({ id: m.id, name: m.full_name }))
                                ]}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Project</label>
                        <div className="h-11">
                            <FilterSelect
                                icon={<FolderOpen className="w-3.5 h-3.5" />}
                                value={addTimeData.projectId}
                                onChange={(val) => setAddTimeData({ ...addTimeData, projectId: val })}
                                options={[
                                    { id: '', name: addTimeData.userId ? 'Select project...' : 'Select a member first...' },
                                    ...projects
                                        .filter(p => !addTimeData.userId || (projectMembersMap[addTimeData.userId] || []).includes(p.id))
                                        .map(p => ({ id: p.id, name: p.name }))
                                ]}
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-text-muted ">Date (Local Timezone)</label>
                        <DatePicker
                            value={addTimeData.date}
                            onChange={(val) => setAddTimeData({ ...addTimeData, date: val })}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted ">Start</label>
                            <input type="time" className="w-full h-11 bg-surface-hover border border-border rounded-md px-4 text-[11px] font-bold text-text-main outline-none focus:border-primary transition-all" value={addTimeData.startTime} onChange={(e) => setAddTimeData({ ...addTimeData, startTime: e.target.value })} />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold text-text-muted ">End</label>
                            <input type="time" className="w-full h-11 bg-surface-hover border border-border rounded-md px-4 text-[11px] font-bold text-text-main outline-none focus:border-primary transition-all" value={addTimeData.endTime} onChange={(e) => setAddTimeData({ ...addTimeData, endTime: e.target.value })} />
                        </div>
                    </div>
                    <div className="flex justify-end pt-2">
                        <button onClick={handleEditSubmit} className="px-8 h-11 bg-primary text-white rounded-md text-[11px] font-bold shadow-shell-sm hover:bg-primary/90 transition-all">Save Changes</button>
                    </div>
                </div>
            </Modal>

            <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Delete Time Entry">
                <div className="space-y-6 py-4">
                    <p className="text-[14px] text-text-muted">Are you sure you want to delete this time entry? This action cannot be undone.</p>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowDeleteConfirm(false)} className="px-6 h-11 bg-surface-hover border border-border text-text-muted rounded-md text-[11px] font-bold shadow-shell-sm hover:text-text-main transition-all">Cancel</button>
                        <button onClick={handleDeleteSubmit} className="px-8 h-11 bg-red-500 text-white rounded-md text-[11px] font-bold shadow-shell-sm hover:bg-red-600 transition-all">Delete Entry</button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function DailyView({ entries, selectedMember, toProperCase, onEditSession, onDeleteSession, onRowClick }: {
    entries: DailyEntry[],
    selectedMember: string,
    toProperCase: (s: string) => string,
    onEditSession: (s: any) => void,
    onDeleteSession: (s: any) => void,
    onRowClick: (userId: string) => void
}) {
    const day = entries[0];

    const displayRows = useMemo(() => {
        if (!day) return [];

        // For a specific member: sessions are already filtered by the server query.
        // Return them directly as individual session rows.
        if (selectedMember !== 'all') {
            return day.sessions;
        }

        // For "All Members" view: aggregate sessions per user so each member
        // appears as a single summarised row.
        const userMap: Record<string, any> = {};

        day.sessions.forEach(s => {
            const userId = s.user_id;

            if (!userMap[userId]) {
                userMap[userId] = {
                    ...s,
                    min_start: s.started_at,
                    max_end: s.ended_at,
                    total_duration: 0,
                    weighted_activity: 0,
                    weighted_idle: 0,
                    weighted_manual: 0,
                    offline_mins: 0,
                    is_active: false,
                    isAggregated: true
                };
            }
            const row = userMap[userId];
            const dur = s.duration_mins || 0;
            row.total_duration += dur;
            row.weighted_activity += (s.activity_percent || 0) * dur;
            row.weighted_idle += (s.idle_percent || 0) * dur;
            row.weighted_manual += (s.manual_percent || 0) * dur;
            row.offline_mins += (s.offline_mins || 0);

            if (new Date(s.started_at) < new Date(row.min_start)) row.min_start = s.started_at;

            if (s.is_active) {
                row.is_active = true;
            } else if (s.ended_at && (!row.max_end || new Date(s.ended_at) > new Date(row.max_end))) {
                row.max_end = s.ended_at;
            }

            if (row.project_id !== s.project_id) row.project_name = 'Multiple Projects';
        });

        return Object.values(userMap)
            .map(row => ({
                ...row,
                activity_percent: row.total_duration > 0 ? Math.round(row.weighted_activity / row.total_duration) : 0,
                idle_percent: row.total_duration > 0 ? Math.round(row.weighted_idle / row.total_duration) : 0,
                manual_percent: row.total_duration > 0 ? Math.round(row.weighted_manual / row.total_duration) : 0,
                duration_mins: row.total_duration
            }));
    }, [day, selectedMember]);

    if (!day) return <div className="flex flex-col items-center justify-center h-64"><EmptyState title="No entries found" /></div>;

    const renderTimeDisplay = (s: any) => {
        const startTime = s.isAggregated ? s.min_start : s.started_at;
        const endTime = s.isAggregated ? s.max_end : (s.effective_end || s.ended_at);

        const start = new Date(startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: s.display_timezone }).toLowerCase();

        if (s.is_active) {
            return (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span>{start} – ...</span>
                    <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                </span>
            );
        }

        const end = endTime ?
            new Date(endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: s.display_timezone }).toLowerCase() :
            '...';

        return `${start} – ${end}`;
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-4">
                    <span className="text-5xl font-bold text-text-main tabular-nums tracking-tight">{formatDuration(day.totalMinutes)}</span>
                    <span className="text-[13px] font-bold text-text-muted tracking-wide uppercase opacity-60">Total tracked today</span>
                </div>
            </div>

            <div className="relative h-2.5 bg-black/[0.03] dark:bg-white/[0.05] rounded-full my-12 overflow-hidden ring-1 ring-black/[0.03] dark:ring-white/[0.03]">
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <span className="absolute w-px h-full bg-black/[0.05] dark:bg-white/[0.05] left-1/4" />
                    <span className="absolute w-px h-full bg-black/[0.05] dark:bg-white/[0.05] left-1/2" />
                    <span className="absolute w-px h-full bg-black/[0.05] dark:bg-white/[0.05] left-3/4" />
                </div>
                {day.sessions.map((s, i) => {
                    const d = new Date(s.started_at);
                    const formattedDate = new Date(d.toLocaleString('en-US', { timeZone: s.display_timezone }));
                    const left = ((formattedDate.getHours() * 60 + formattedDate.getMinutes()) / 1440) * 100;
                    const duration = s.duration_mins || 0;
                    const width = (duration / 1440) * 100;
                    return (
                        <div key={i} className="absolute inset-y-0 rounded-full z-10 shadow-sm transition-all" style={{ left: `${left}%`, width: `${Math.max(width, 0.5)}%`, background: 'linear-gradient(90deg, var(--chart-gold-secondary) 0%, var(--gold-vibrant) 100%)' }} />
                    );
                })}
            </div>

            <div className="bg-surface rounded-md border border-border shadow-shell-sm overflow-visible">
                <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                        <tr className="bg-surface-hover/30">
                            <th className="py-6 px-10 text-[11px] font-bold text-text-muted border-b border-border uppercase tracking-widest w-1/3">Scope & Member</th>
                            <th className="py-6 px-6 text-[11px] font-bold text-text-muted border-b border-border text-center uppercase tracking-widest w-32">Active</th>
                            <th className="py-6 px-6 text-[11px] font-bold text-text-muted border-b border-border text-center uppercase tracking-widest w-32">Idle</th>
                            <th className="py-6 px-6 text-[11px] font-bold text-text-muted border-b border-border text-center uppercase tracking-widest w-32">Duration</th>
                            <th className="py-6 px-6 text-[11px] font-bold text-text-muted border-b border-border text-center uppercase tracking-widest w-40">Timezone</th>
                            <th className="py-6 px-6 text-[11px] font-bold text-text-muted border-b border-border text-right uppercase tracking-widest">Window</th>
                            <th className="py-6 px-4 border-b border-border w-12"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {displayRows.map((s, idx) => (
                            <tr key={idx} onClick={() => onRowClick(s.user_id)} className="group hover:bg-surface-hover/50 transition-all cursor-pointer">
                                <td className="py-8 px-10">
                                    <div className="flex flex-col gap-1.5">
                                        <span className="text-[16px] font-bold text-text-main tracking-tight">{s.project_name}</span>
                                        <span className="text-[14px] font-bold text-text-muted group-hover:text-primary transition-colors">
                                            {s.user_name ? toProperCase(s.user_name) : 'Unknown'}
                                        </span>
                                    </div>
                                </td>
                                <td className="py-8 px-6 text-center">
                                    <div className="flex flex-col items-center gap-2.5">
                                        <span className="text-[15px] font-bold text-text-main tabular-nums">{s.activity_percent}%</span>
                                        <div className="w-14 h-1.5 bg-main rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${s.activity_percent}%` }} />
                                        </div>
                                    </div>
                                </td>
                                <td className="py-8 px-6 text-center text-[15px] font-bold text-text-muted tabular-nums">{s.idle_percent}%</td>
                                <td className="py-8 px-6 text-center tabular-nums">
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-[18px] font-bold text-text-main">{formatDuration(s.duration_mins || 0)}</span>
                                        {((s.activity_percent === 0 && s.idle_percent === 0) || s.manual === true) && (
                                            <span className="text-[11px] text-[var(--chart-gold)] font-bold mt-0.5 tracking-tight">(manual)</span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-8 px-6 text-center text-[13px] font-bold text-text-muted">
                                    <span className="px-2.5 py-1 rounded bg-white/5 border border-white/5 font-mono text-[12px] opacity-80">
                                        {s.display_timezone || 'UTC'}
                                    </span>
                                </td>
                                <td className="py-8 px-6 text-right">
                                    <div className="flex flex-col items-end gap-1">
                                        <span className="text-[14px] font-bold text-text-muted tabular-nums">
                                            {renderTimeDisplay(s)}
                                        </span>
                                        {s.offline_mins > 0 && (
                                            <span className="text-[11px] text-[var(--chart-gold)] font-bold tracking-tight bg-primary/5 px-2 py-0.5 rounded-md border border-primary/10">
                                                +{s.offline_mins}m offline
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="py-8 px-4 text-center">
                                    {!s.isAggregated && (
                                        <div className="relative group/actions inline-block text-left">
                                            <button onClick={(e) => e.stopPropagation()} className="p-2 hover:bg-surface-hover rounded-md text-text-muted hover:text-text-main transition-colors">
                                                <MoreVertical className="w-5 h-5" />
                                            </button>
                                            <div className="absolute right-0 top-full mt-1 w-36 bg-surface border border-border rounded-lg shadow-shell-md opacity-0 invisible group-hover/actions:opacity-100 group-hover/actions:visible transition-all z-50 overflow-hidden">
                                                <button onClick={(e) => { e.stopPropagation(); onEditSession(s); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-text-main hover:bg-surface-hover flex items-center gap-2">
                                                    <Edit2 className="w-4 h-4 text-text-muted" /> Edit Time
                                                </button>
                                                <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s); }} className="w-full text-left px-4 py-2.5 text-xs font-semibold text-red-500 hover:bg-red-500/10 flex items-center gap-2 border-t border-border/50">
                                                    <Trash2 className="w-4 h-4" /> Delete Time
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function WeeklyView({ entries, onDayClick }: { entries: DailyEntry[], onDayClick: (d: string) => void }) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-6">
            {entries.map((day, i) => (
                <div key={i} className="bg-surface border border-border rounded-md p-6 flex flex-col items-center gap-4 hover:border-primary/30 hover:shadow-lg hover:shadow-slate-200/40 transition-all cursor-pointer group" onClick={() => onDayClick(day.date)}>
                    <span className="text-[10px] font-bold text-text-muted ">{DAYS_SHORT[new Date(day.date + 'T12:00:00').getDay()]}</span>
                    <span className="text-2xl font-bold text-text-main group-hover:text-primary transition-colors tabular-nums">{new Date(day.date + 'T12:00:00').getDate()}</span>
                    <div className="flex flex-col items-center gap-1">
                        <span className="text-[13px] font-bold text-text-main tabular-nums">{formatDuration(day.totalMinutes)}</span>
                        {day.totalMinutes > 0 && (
                            <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-2 py-0.5 rounded-md">{day.activityPercent}%</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );
}

function CalendarView({ entries, onDayClick }: { entries: DailyEntry[], onDayClick: (d: string) => void }) {
    return (
        <div className="w-full min-w-0">
            {/* Mobile: horizontal scroll
                Desktop: normal full-width calendar */}
            <div className="w-full overflow-x-auto custom-scrollbar ">
                <div className="bg-surface border border-border rounded-md shadow-shell-sm overflow-hidden min-w-[840px] min-[1200px]:min-w-0">


                    {/* Calendar header */}
                    <div className="grid grid-cols-7 border-b border-border">
                        {DAYS_SHORT.map((day) => (
                            <div
                                key={day}
                                className="bg-surface-hover/50 px-3 py-4 text-[10px] sm:text-[11px] font-bold text-text-muted text-center"
                            >
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar days */}
                    <div className="grid grid-cols-7 gap-px bg-main">
                        {entries.map((day, i) => (
                            <div
                                key={i}
                                onClick={() => onDayClick(day.date)}
                                className="
                                    bg-surface
                                    min-h-[150px]
                                    sm:min-h-[170px]
                                    px-2
                                    py-3
                                    sm:px-4
                                    sm:py-5
                                    flex
                                    flex-col
                                    gap-3
                                    hover:bg-surface-hover
                                    transition-all
                                    group
                                    cursor-pointer
                                "
                            >
                                {/* Date */}
                                <span className="text-[12px] sm:text-[13px] font-bold text-text-muted group-hover:text-slate-900 transition-colors">
                                    {new Date(day.date + 'T12:00:00').getDate()}
                                </span>

                                {/* Time summary */}
                                {day.totalMinutes > 0 && (
                                    <div className="bg-primary/5 border border-primary/10 text-[var(--chart-gold)] rounded-md px-2.5 py-3 flex flex-col gap-2.5 shadow-shell-sm">

                                        <span className="text-[12px] sm:text-[13px] font-bold tabular-nums whitespace-nowrap">
                                            {formatDuration(day.totalMinutes)}
                                        </span>

                                        <div className="w-full h-1.5 bg-primary/10 rounded-full overflow-hidden">
                                            <div
                                                className="h-full"
                                                style={{
                                                    width: `${day.activityPercent}%`,
                                                    background:
                                                        'linear-gradient(90deg, var(--chart-gold-secondary) 0%, var(--gold-vibrant) 100%)'
                                                }}
                                            />
                                        </div>

                                        <span className="text-[10px] sm:text-[11px] font-bold text-text-muted whitespace-nowrap">
                                            {day.activityPercent}% active
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                </div>
            </div>

            {/* Small mobile hint */}
            <div className="sm:hidden text-center mt-3 text-[10px] font-semibold text-text-muted">
                Swipe left or right to view the calendar
            </div>
        </div>
    );
}
