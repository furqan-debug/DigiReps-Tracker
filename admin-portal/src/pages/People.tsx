import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Search, UserPlus, Download, Filter,
    ChevronDown, CheckCircle, X, Mail, Copy,
    Pencil, Trash2, Power, PowerOff, Shield,
    Clock, Activity, MoreHorizontal, Check,
    AlertCircle, RotateCcw, LayoutGrid, List,
    ChevronRight, MoreVertical, ExternalLink,
    Upload, Settings, Square
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type Role = 'Admin' | 'Manager' | 'User' | 'Viewer';
type Status = 'Active' | 'Inactive' | 'Pending';

interface DbMember {
    id: string;
    email: string;
    full_name: string;
    role: Role;
    status: Status;
    pay_rate: number | null;
    bill_rate: number | null;
    weekly_limit: number;
    daily_limit: number;
    tracking_enabled: boolean;
    created_at: string;
}

interface MemberRow extends DbMember {
    totalMinutes: number;
    activityPercent: number;
    lastSeen: string | null;
    sessionCount: number;
    projectsCount: number;
}

const ROLE_COLORS: Record<Role, string> = {
    Admin: 'bg-purple-100 text-purple-700 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-purple-200',
    Manager: 'bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-indigo-200',
    User: 'bg-slate-100 text-slate-600 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-slate-200',
    Viewer: 'bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full text-[10px] uppercase tracking-wider border border-emerald-200',
};

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// ─── Main Component ───────────────────────────────────────────────────────────
export function People() {
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'Members' | 'Invites'>('Members');
    const [statusFilter, setStatusFilter] = useState<Status | 'All'>('All');

    // Selection state
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [editMember, setEditMember] = useState<MemberRow | null>(null);
    const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);

    // Form state
    const [addEmail, setAddEmail] = useState('');
    const [addRole, setAddRole] = useState<Role>('User');
    const [addPayRate, setAddPayRate] = useState('');
    const [addBillRate, setAddBillRate] = useState('');
    const [addWeekly, setAddWeekly] = useState('40');
    const [addDaily, setAddDaily] = useState('8');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    useEffect(() => { fetchMembers(); }, []);

    async function fetchMembers() {
        setLoading(true);
        let dbMembers: DbMember[] = [];
        try {
            const r = await fetch(`${API}/api/members`);
            if (r.ok) dbMembers = await r.json();
        } catch { }

        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, user_id, started_at, ended_at')
            .order('started_at', { ascending: false });

        const { data: activityData } = await supabase
            .from('activity_samples')
            .select('session_id, idle');

        const sessionToUser: Record<string, string> = {};
        (sessions || []).forEach(s => { sessionToUser[s.id] = s.user_id; });

        const statsMap: Record<string, { min: number; active: number; total: number; last: string | null; count: number }> = {};
        (sessions || []).forEach(s => {
            const uid = s.user_id;
            if (!statsMap[uid]) statsMap[uid] = { min: 0, active: 0, total: 0, last: s.started_at, count: 0 };
            statsMap[uid].count++;
            const startMs = new Date(s.started_at).getTime();
            const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
            statsMap[uid].min += Math.max(0, Math.round((endMs - startMs) / 60000));
            if (s.started_at > (statsMap[uid].last || '')) statsMap[uid].last = s.started_at;
        });

        (activityData || []).forEach(a => {
            const uid = sessionToUser[a.session_id];
            if (!uid || !statsMap[uid]) return;
            statsMap[uid].total++;
            if (!a.idle) statsMap[uid].active++;
        });

        const result: MemberRow[] = dbMembers.map(m => {
            const stats = statsMap[m.email] || statsMap[m.full_name] || null;
            return {
                ...m,
                totalMinutes: stats?.min || 0,
                activityPercent: stats && stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0,
                lastSeen: stats?.last || null,
                sessionCount: stats?.count || 0,
                projectsCount: m.status === 'Active' ? 1 : 0, // Mock for display
            };
        });

        setMembers(result);
        setLoading(false);
    }

    async function handleAddMember() {
        if (!addEmail.trim()) return;
        setAdding(true);
        setAddError(null);
        try {
            const res = await fetch(`${API}/api/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: addEmail.trim().toLowerCase(),
                    role: addRole,
                    pay_rate: addPayRate ? parseFloat(addPayRate) : null,
                    bill_rate: addBillRate ? parseFloat(addBillRate) : null,
                    weekly_limit: parseInt(addWeekly) || 40,
                    daily_limit: parseInt(addDaily) || 8,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to send invite');

            setInviteSentTo(data.member.email);
            setShowAddModal(false);
            resetAddForm();
            await fetchMembers();
        } catch (e: any) {
            setAddError(e.message);
        } finally {
            setAdding(false);
        }
    }

    async function handleResendInvite(email: string) {
        setAdding(true);
        try {
            await fetch(`${API}/api/members`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            setInviteSentTo(email);
        } catch (e) {
            console.error(e);
        } finally {
            setAdding(false);
        }
    }

    async function handleUpdateMeta(id: string, patch: Partial<DbMember>) {
        setEditMember(null);
        setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
        try {
            await fetch(`${API}/api/members/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
        } catch {
            fetchMembers();
        }
    }

    async function handleBulkAction(action: 'Active' | 'Inactive' | 'Role_User' | 'Role_Manager') {
        const ids = Array.from(selectedIds);
        if (ids.length === 0) return;

        setLoading(true);
        const patches: Record<string, any> = {
            Active: { status: 'Active' },
            Inactive: { status: 'Inactive' },
            Role_User: { role: 'User' },
            Role_Manager: { role: 'Manager' }
        };

        const patch = patches[action];

        try {
            await Promise.all(ids.map(id =>
                fetch(`${API}/api/members/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch),
                })
            ));
            setSelectedIds(new Set());
            await fetchMembers();
        } catch {
            setLoading(false);
        }
    }

    function toggleSelection(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    }

    function toggleSelectAll() {
        if (selectedIds.size === filtered.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filtered.map(m => m.id)));
        }
    }

    function resetAddForm() {
        setAddEmail(''); setAddRole('User');
        setAddPayRate(''); setAddBillRate(''); setAddWeekly('40'); setAddDaily('8');
        setAddError(null);
    }

    const filtered = members.filter(m => {
        const matchesSearch = m.full_name.toLowerCase().includes(search.toLowerCase()) ||
            m.email.toLowerCase().includes(search.toLowerCase());
        const isInvite = m.status === 'Pending';
        const matchesTab = activeTab === 'Invites' ? isInvite : !isInvite;
        const matchesStatus = statusFilter === 'All' || m.status === statusFilter;
        return matchesSearch && matchesTab && matchesStatus;
    });

    const membersCount = members.filter(m => m.status !== 'Pending').length;
    const invitesCount = members.filter(m => m.status === 'Pending').length;

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full fade-in font-sans">
            {/* Top Row: Title & Link */}
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-medium text-[#2d2d2d]">Members</h1>
                <button className="flex items-center gap-2 text-[#2a85ff] hover:underline text-sm font-medium">
                    <Users className="w-4 h-4" />
                    Onboarding status
                </button>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-8 border-b border-slate-200 mb-6">
                <button
                    onClick={() => setActiveTab('Members')}
                    className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'Members' ? 'border-[#2a85ff] text-[#2a85ff]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Members ({membersCount})
                </button>
                <button
                    onClick={() => setActiveTab('Invites')}
                    className={`pb-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 ${activeTab === 'Invites' ? 'border-[#2a85ff] text-[#2a85ff]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
                >
                    Invites ({invitesCount})
                </button>
            </div>

            {/* Pricing Info Shadow (Mock) */}
            <div className="mb-4 flex items-center gap-2 text-xs text-slate-400">
                <span>{membersCount} of 1 members count toward your pricing plan</span>
                <AlertCircle className="w-3.5 h-3.5" />
            </div>
            <button className="text-[#2a85ff] text-xs font-medium hover:underline mb-8 block">Add more seats</button>

            {/* Purple Info Banner */}
            <div className="bg-[#f0e7ff] border border-[#d8b4fe]/50 p-4 rounded-lg flex items-center justify-between mb-8">
                <p className="text-[#6b21a8] text-sm font-medium">Create teams to auto assign members to projects and delegate tasks to team leads</p>
                <div className="flex items-center gap-4">
                    <button className="text-[#6b21a8] hover:underline text-xs font-semibold uppercase tracking-wider">Don't show again</button>
                    <button className="bg-[#9333ea] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#7e22ce] transition-colors">Try it out now</button>
                    <button className="text-[#6b21a8] hover:text-[#7e22ce]"><X className="w-4 h-4" /></button>
                </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col lg:flex-row items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="relative flex-1 lg:w-80">
                        <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search members"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-[#2a85ff]/20 focus:border-[#2a85ff] outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                    <button className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Batch actions <ChevronDown className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex items-center gap-3 w-full lg:w-auto justify-end">
                    <button className="flex items-center gap-2 px-4 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button className="px-6 py-2 bg-white border border-[#2a85ff] text-[#2a85ff] rounded-lg text-sm font-medium hover:bg-[#2a85ff]/5 transition-colors">
                        Import members
                    </button>
                    <button onClick={() => { resetAddForm(); setShowAddModal(true); }}
                        className="px-6 py-2 bg-[#2a85ff] text-white rounded-lg text-sm font-semibold hover:bg-[#0052cc] transition-colors">
                        Add members
                    </button>
                    <button className="px-6 py-2 bg-white border border-[#2a85ff] text-[#2a85ff] rounded-lg text-sm font-medium hover:bg-[#2a85ff]/5 transition-colors flex items-center gap-2">
                        Filters
                    </button>
                    <button className="p-2 border border-slate-300 rounded-lg text-slate-400">
                        <Square className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-lg border border-slate-200 overflow-visible">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50/10">
                            <th className="pl-6 py-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                                    onChange={toggleSelectAll}
                                    className="w-4 h-4 rounded border-slate-300"
                                />
                            </th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Member <ChevronDown className="w-3 h-3 inline ml-1" /></th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Status</th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Role</th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Projects</th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Payment</th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Limits</th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Time tracking status</th>
                            <th className="px-4 py-4 text-[13px] font-bold text-slate-700">Date added</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading ? (
                            <tr>
                                <td colSpan={10} className="py-20 text-center text-slate-400">Loading members...</td>
                            </tr>
                        ) : filtered.length === 0 ? (
                            <tr>
                                <td colSpan={10} className="py-20 text-center text-slate-400">No members found.</td>
                            </tr>
                        ) : (
                            filtered.map(m => (
                                <MemberRowItem
                                    key={m.id}
                                    m={m}
                                    isSelected={selectedIds.has(m.id)}
                                    onToggle={() => toggleSelection(m.id)}
                                    onEdit={() => setEditMember(m)}
                                    onToggleTracking={() => handleUpdateMeta(m.id, { tracking_enabled: !m.tracking_enabled })}
                                    onStatusChange={(status: Status) => handleUpdateMeta(m.id, { status })}
                                    onResendInvite={() => handleResendInvite(m.email)}
                                />
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Mock */}
            <div className="mt-4 text-xs text-slate-500 font-medium">
                Showing {filtered.length} of {filtered.length} {activeTab === 'Members' ? 'member' : 'invite'}{filtered.length !== 1 ? 's' : ''}
            </div>

            {/* MODALS */}
            {showAddModal && <InviteModal onClose={() => setShowAddModal(false)} onInvite={handleAddMember} form={{ addEmail, setAddEmail, addRole, setAddRole, addPayRate, setAddPayRate, addBillRate, setAddBillRate, addWeekly, setAddWeekly, addDaily, setAddDaily, adding, addError }} />}
            {editMember && <EditModal member={editMember} onClose={() => setEditMember(null)} onSave={(patch: any) => handleUpdateMeta(editMember.id, patch)} />}
            {inviteSentTo && <InviteSentPopup email={inviteSentTo} onClose={() => setInviteSentTo(null)} />}
        </div>
    );
}

// ─── Sub-Components ───────────────────────────────────────────────────────────

function MemberListItem({ m, isSelected, onToggle, onEdit, onToggleTracking, onStatusChange, onResendInvite }: {
    m: MemberRow; isSelected: boolean; onToggle: () => void; onEdit: () => void;
    onToggleTracking: () => void; onStatusChange: (s: Status) => void; onResendInvite: () => void;
}) {
    const [open, setOpen] = useState(false);
    const dropRef = useRef<HTMLDivElement>(null);
    const initials = m.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

    useEffect(() => {
        function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <tr className={`group transition-all ${isSelected ? 'bg-emerald-50/30' : 'hover:bg-slate-50/50'} ${m.status === 'Inactive' ? 'opacity-60' : ''}`}>
            <td className="pl-8 py-5">
                <input type="checkbox" checked={isSelected} onChange={onToggle}
                    className="w-5 h-5 rounded-lg border-slate-300 text-emerald-600 focus:ring-emerald-500/20 cursor-pointer" />
            </td>
            <td className="px-6 py-5">
                <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-[1.25rem] bg-slate-900 flex items-center justify-center text-white text-xs font-black shadow-lg shadow-slate-200">
                        {initials || <Users className="w-4 h-4" />}
                    </div>
                    <div>
                        <p className="font-black text-slate-800 tracking-tight">{m.full_name || 'Anonymous User'}</p>
                        <p className="text-[10px] text-slate-400 font-bold tracking-wider mt-0.5">{m.email}</p>
                    </div>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${m.status === 'Active' ? 'bg-emerald-500' : m.status === 'Pending' ? 'bg-amber-500' : 'bg-slate-300'}`} />
                        <span className="text-xs font-black text-slate-700 tracking-tight uppercase">{m.status}</span>
                    </div>
                    {m.status === 'Active' && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-bold uppercase tracking-widest hover:text-indigo-600 transition-colors cursor-help">
                            <Activity className="w-3 h-3 text-emerald-400" />
                            {m.activityPercent}% Activity
                        </div>
                    )}
                </div>
            </td>
            <td className="px-6 py-5">
                <span className={ROLE_COLORS[m.role]}>{m.role}</span>
            </td>
            <td className="px-6 py-5">
                <div className="text-[11px] font-bold text-slate-600 space-y-1">
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-400 font-black tracking-widest uppercase text-[10px]">PAY:</span>
                        <span className="text-slate-800">${m.pay_rate || '0'}/hr</span>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-400 font-black tracking-widest uppercase text-[10px]">BILL:</span>
                        <span className="text-slate-800">${m.bill_rate || '—'}/hr</span>
                    </div>
                </div>
            </td>
            <td className="px-6 py-5">
                <div className="text-[11px] font-bold text-slate-600 space-y-1">
                    <p className="flex items-center gap-2 text-slate-800"><Clock className="w-3 h-3 text-indigo-400" /> {m.weekly_limit}h/wk</p>
                    <p className="flex items-center gap-2 text-slate-800"><AlertCircle className="w-3 h-3 text-amber-400" /> {m.daily_limit}h/day</p>
                </div>
            </td>
            <td className="px-6 py-5">
                <button onClick={onToggleTracking}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${m.tracking_enabled ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                    {m.tracking_enabled ? <><Check className="w-3 h-3" /> Tracking</> : <><PowerOff className="w-3 h-3" /> Paused</>}
                </button>
            </td>
            <td className="px-6 py-5 text-right relative" ref={dropRef}>
                <button onClick={() => setOpen(!open)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-all">
                    <MoreVertical className="w-5 h-5" />
                </button>
                {open && (
                    <div className="absolute right-6 top-14 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-50 py-3 w-56 animate-in fade-in zoom-in duration-200">
                        <DropItem icon={<Pencil className="w-4 h-4" />} label="Edit Member" onClick={() => { onEdit(); setOpen(false); }} />
                        {m.status === 'Pending' && (
                            <DropItem icon={<RotateCcw className="w-4 h-4" />} label="Resend Invite" onClick={() => { onResendInvite(); setOpen(false); }} />
                        )}
                        <div className="my-2 border-t border-slate-100" />
                        {m.status !== 'Active' && <DropItem icon={<CheckCircle className="w-4 h-4 text-emerald-500" />} label="Mark Active" onClick={() => { onStatusChange('Active'); setOpen(false); }} />}
                        {m.status !== 'Inactive' && <DropItem icon={<PowerOff className="w-4 h-4 text-rose-500" />} label="Deactivate" onClick={() => { onStatusChange('Inactive'); setOpen(false); }} danger />}
                    </div>
                )}
            </td>
        </tr>
    );
}

function DropItem({ icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-3 px-6 py-2.5 text-xs font-black uppercase tracking-widest hover:bg-slate-50 transition-all text-left ${danger ? 'text-rose-500' : 'text-slate-600'}`}>
            {icon}{label}
        </button>
    );
}

function BulkActionBtn({ icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button onClick={onClick}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${danger ? 'bg-rose-50 text-rose-600 border border-rose-100 hover:bg-rose-100' : 'bg-white border border-slate-200 text-slate-700 hover:border-emerald-500 hover:text-emerald-600 shadow-sm'}`}>
            {icon}{label}
        </button>
    );
}

// ─── Modals ───────────────────────────────────────────────────────────────────

function InviteModal({ onClose, onInvite, form }: any) {
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Invite Resource</h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Personnel Onboarding</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
                </div>
                <div className="p-10 space-y-6">
                    <FormField label="Email Address" value={form.addEmail} onChange={form.setAddEmail} type="email" placeholder="e.g. recruit@company.com" />
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Assigned Role</label>
                        <select value={form.addRole} onChange={e => form.setAddRole(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer">
                            {['User', 'Viewer', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Pay Rate ($/hr)" value={form.addPayRate} onChange={form.setAddPayRate} type="number" placeholder="25" />
                        <FormField label="Bill Rate ($/hr)" value={form.addBillRate} onChange={form.setAddBillRate} type="number" placeholder="—" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Weekly Limit" value={form.addWeekly} onChange={form.setAddWeekly} type="number" placeholder="40" />
                        <FormField label="Daily Limit" value={form.addDaily} onChange={form.setAddDaily} type="number" placeholder="8" />
                    </div>
                    {form.addError && <div className="bg-rose-50 border border-rose-100 text-rose-600 text-[10px] font-black uppercase tracking-widest p-4 rounded-2xl">{form.addError}</div>}
                </div>
                <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                    <button onClick={onInvite} disabled={form.adding || !form.addEmail.trim()}
                        className="flex-[2] bg-emerald-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-emerald-100 disabled:opacity-50 active:scale-95 flex items-center justify-center gap-3">
                        <Mail className="w-5 h-5" /> {form.adding ? 'Sending...' : 'Send Invitation'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function EditModal({ member, onClose, onSave }: any) {
    const [name, setName] = useState(member.full_name);
    const [role, setRole] = useState(member.role);
    const [payRate, setPayRate] = useState(member.pay_rate?.toString() || '');
    const [billRate, setBillRate] = useState(member.bill_rate?.toString() || '');
    const [weekly, setWeekly] = useState(member.weekly_limit.toString());
    const [daily, setDaily] = useState(member.daily_limit.toString());

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Edit Profile</h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">{member.email}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all"><X className="w-6 h-6 text-slate-400" /></button>
                </div>
                <div className="p-10 space-y-6">
                    <FormField label="Full Name" value={name} onChange={setName} placeholder="Account holder name" />
                    <div className="space-y-3">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Access Level</label>
                        <select value={role} onChange={e => setRole(e.target.value)}
                            className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:bg-white focus:border-emerald-500 transition-all appearance-none cursor-pointer">
                            {['User', 'Viewer', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Compensation ($/hr)" value={payRate} onChange={setPayRate} type="number" />
                        <FormField label="Chargeability ($/hr)" value={billRate} onChange={setBillRate} type="number" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Weekly Quota" value={weekly} onChange={setWeekly} type="number" />
                        <FormField label="Daily Quota" value={daily} onChange={setDaily} type="number" />
                    </div>
                </div>
                <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                    <button onClick={() => onSave({ full_name: name, role, pay_rate: payRate ? parseFloat(payRate) : null, bill_rate: billRate ? parseFloat(billRate) : null, weekly_limit: parseInt(weekly) || 40, daily_limit: parseInt(daily) || 8 })}
                        className="flex-[2] bg-slate-900 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl active:scale-95">
                        Verify & Save Updates
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: any) {
    return (
        <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-emerald-500/10 focus:bg-white focus:border-emerald-500 transition-all shadow-sm" />
        </div>
    );
}

function InviteSentPopup({ email, onClose }: any) {
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in zoom-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-sm p-12 text-center shadow-2xl border border-slate-100">
                <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-emerald-100 ring-8 ring-emerald-50/50">
                    <CheckCircle className="w-8 h-8 text-emerald-500" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Invite Dispatched</h2>
                <p className="text-slate-500 font-medium leading-relaxed mb-10 italic">
                    Successfully sent onboarding credentials to <span className="text-emerald-600 font-black">{email}</span>.
                </p>
                <button onClick={onClose}
                    className="w-full bg-slate-900 text-white py-5 rounded-[2rem] text-sm font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl shadow-slate-200 active:scale-95">
                    Acknowledged
                </button>
            </div>
        </div>
    );
}
