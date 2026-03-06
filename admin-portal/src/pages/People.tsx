import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Search, Download, Filter,
    ChevronDown, CheckCircle, X, Mail, Copy,
    Pencil, Trash2, MoreHorizontal, Check,
    AlertCircle, RotateCcw, LayoutGrid, List,
    Square, ExternalLink, Settings
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


const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// ─── Main Component ───────────────────────────────────────────────────────────
export function People() {
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [activeTab, setActiveTab] = useState<'Members' | 'Invites'>('Members');
    const [statusFilter] = useState<Status | 'All'>('All');

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

function MemberRowItem({ m, isSelected, onToggle, onEdit, onToggleTracking, onStatusChange, onResendInvite }: any) {
    const [open, setOpen] = useState(false);
    const dropRef = useRef<HTMLTableDataCellElement>(null);
    const initials = m.full_name.split(' ').map((w: any) => w[0]).join('').slice(0, 2).toUpperCase();

    useEffect(() => {
        function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false); }
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

    const dateAdded = new Date(m.created_at).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

    return (
        <tr className={`hover:bg-slate-50/50 transition-all ${isSelected ? 'bg-blue-50/20' : ''}`}>
            <td className="pl-6 py-4">
                <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={onToggle}
                    className="w-4 h-4 rounded border-slate-300"
                />
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#2a85ff] flex items-center justify-center text-white text-[10px] font-bold">
                        {initials || <Users className="w-3 h-3" />}
                    </div>
                    <span className="text-sm font-medium text-[#2a85ff] hover:underline cursor-pointer">{m.full_name}</span>
                </div>
            </td>
            <td className="px-4 py-4 text-xs text-slate-600 font-medium">{m.status}</td>
            <td className="px-4 py-4 text-xs text-slate-600 font-medium">
                {m.role === 'Admin' ? 'Organization owner' : m.role}
            </td>
            <td className="px-4 py-4 text-xs text-slate-600 font-medium">{m.projectsCount}</td>
            <td className="px-4 py-4">
                <div className="text-[11px] text-slate-400 font-medium leading-tight">
                    <p>Pay rate: {m.pay_rate ? `$${m.pay_rate}` : 'No pay rate'}</p>
                    <p>Bill rate: {m.bill_rate ? `$${m.bill_rate}` : 'No bill rate'}</p>
                </div>
            </td>
            <td className="px-4 py-4">
                <div className="text-[11px] text-slate-400 font-medium leading-tight">
                    <p>{m.weekly_limit ? `${m.weekly_limit}h weekly limit` : 'No weekly limit'}</p>
                    <p>{m.daily_limit ? `${m.daily_limit}h daily limit` : 'No daily limit'}</p>
                </div>
            </td>
            <td className="px-4 py-4">
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${m.tracking_enabled ? 'bg-[#22c55e] text-white' : 'bg-slate-200 text-slate-500'}`}>
                    {m.tracking_enabled ? 'Enabled' : 'Disabled'}
                </span>
            </td>
            <td className="px-4 py-4 text-[11px] text-slate-500 font-medium">{dateAdded}</td>
            <td className="px-6 py-4 text-right relative" ref={dropRef}>
                <button
                    onClick={() => setOpen(!open)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                    Actions <ChevronDown className="w-3.5 h-3.5" />
                </button>
                {open && (
                    <div className="absolute right-6 top-14 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-2 w-48 animate-in fade-in zoom-in duration-200">
                        <DropItem icon={<Pencil className="w-3.5 h-3.5" />} label="Edit member" onClick={() => { onEdit(); setOpen(false); }} />
                        {m.status === 'Pending' && (
                            <DropItem icon={<RotateCcw className="w-3.5 h-3.5" />} label="Resend invite" onClick={() => { onResendInvite(); setOpen(false); }} />
                        )}
                        <div className="my-1 border-t border-slate-100" />
                        <DropItem icon={<ExternalLink className="w-3.5 h-3.5" />} label="View timeline" onClick={() => { }} />
                        <DropItem icon={<Settings className="w-3.5 h-3.5" />} label="Settings" onClick={() => { }} />
                        <div className="my-1 border-t border-slate-100" />
                        <DropItem icon={<Trash2 className="w-3.5 h-3.5 text-rose-500" />} label="Remove member" onClick={() => { }} danger />
                    </div>
                )}
            </td>
        </tr>
    );
}

function DropItem({ icon, label, onClick, danger }: any) {
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium hover:bg-slate-50 transition-all text-left ${danger ? 'text-rose-600' : 'text-slate-700'}`}>
            {icon}{label}
        </button>
    );
}

// ─── Modals (Re-using/Polishing from previous) ────────────────────────────────

function InviteModal({ onClose, onInvite, form }: any) {
    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Add members</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="p-8 space-y-6">
                    <FormField label="Email" value={form.addEmail} onChange={form.setAddEmail} type="email" placeholder="e.g. name@example.com" />
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                        <select value={form.addRole} onChange={e => form.setAddRole(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#2a85ff]/20 focus:border-[#2a85ff] transition-all">
                            {['User', 'Viewer', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    {form.addError && <div className="bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium p-3 rounded-lg">{form.addError}</div>}
                </div>
                <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
                    <button onClick={onInvite} disabled={form.adding || !form.addEmail.trim()}
                        className="bg-[#2a85ff] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-[#0052cc] disabled:opacity-50 transition-colors">
                        {form.adding ? 'Sending...' : 'Add members'}
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
            <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="text-xl font-bold text-slate-900">Member settings</h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-all"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="p-8 space-y-6 max-h-[70vh] overflow-y-auto">
                    <FormField label="Name" value={name} onChange={setName} />
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value)}
                            className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#2a85ff]/20 focus:border-[#2a85ff] transition-all">
                            {['User', 'Viewer', 'Manager', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Pay rate ($/hr)" value={payRate} onChange={setPayRate} type="number" />
                        <FormField label="Bill rate ($/hr)" value={billRate} onChange={setBillRate} type="number" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <FormField label="Weekly limit (h)" value={weekly} onChange={setWeekly} type="number" />
                        <FormField label="Daily limit (h)" value={daily} onChange={setDaily} type="number" />
                    </div>
                </div>
                <div className="px-8 py-6 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">Cancel</button>
                    <button
                        onClick={() => onSave({ full_name: name, role, pay_rate: payRate ? parseFloat(payRate) : null, bill_rate: billRate ? parseFloat(billRate) : null, weekly_limit: parseInt(weekly) || 40, daily_limit: parseInt(daily) || 8 })}
                        className="bg-[#2a85ff] text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-[#0052cc] transition-colors"
                    >
                        Save changes
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: any) {
    return (
        <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</label>
            <input
                type={type}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full px-4 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium text-slate-800 outline-none focus:ring-2 focus:ring-[#2a85ff]/20 focus:border-[#2a85ff] transition-all shadow-sm"
            />
        </div>
    );
}

function InviteSentPopup({ email, onClose }: any) {
    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md flex items-center justify-center z-[200] p-4 animate-in zoom-in duration-300">
            <div className="bg-white rounded-2xl w-full max-w-sm p-8 text-center shadow-2xl border border-slate-100">
                <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-8 h-8 text-blue-500" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Member added</h2>
                <p className="text-slate-500 text-sm mb-8">
                    An invitation was sent to <span className="text-blue-600 font-bold">{email}</span>.
                </p>
                <button
                    onClick={onClose}
                    className="w-full bg-[#2a85ff] text-white py-3 rounded-lg text-sm font-bold hover:bg-[#0052cc] transition-all"
                >
                    Close
                </button>
            </div>
        </div>
    );
}
