import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import {
    Users, Search, UserPlus, Download, Filter,
    ChevronDown, CheckCircle, X, Mail, Copy,
    Pencil, Trash2, Power, PowerOff
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
}

const ROLE_COLORS: Record<Role, string> = {
    Admin: 'bg-purple-100 text-purple-700',
    Manager: 'bg-blue-100 text-blue-700',
    User: 'bg-slate-100 text-slate-600',
    Viewer: 'bg-green-100 text-green-700',
};

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// ─── Main Component ───────────────────────────────────────────────────────────
export function People() {
    const [tab, setTab] = useState<'members' | 'invites'>('members');
    const [members, setMembers] = useState<MemberRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [openActions, setOpenActions] = useState<string | null>(null);
    const [editMember, setEditMember] = useState<MemberRow | null>(null);

    // Add member / invite form
    const [addEmail, setAddEmail] = useState('');
    const [addRole, setAddRole] = useState<Role>('User');
    const [addPayRate, setAddPayRate] = useState('');
    const [addBillRate, setAddBillRate] = useState('');
    const [addWeekly, setAddWeekly] = useState('40');
    const [addDaily, setAddDaily] = useState('8');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    // Invite sent confirmation
    const [inviteSentTo, setInviteSentTo] = useState<string | null>(null);

    const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

    useEffect(() => { fetchMembers(); }, []);

    async function fetchMembers() {
        setLoading(true);

        // 1. Load real members from backend (members table)
        let dbMembers: DbMember[] = [];
        try {
            const r = await fetch(`${API}/api/members`);
            if (r.ok) dbMembers = await r.json();
        } catch { }

        // 2. Load session stats from Supabase to show activity
        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, user_id, started_at, ended_at')
            .order('started_at', { ascending: false });

        const { data: activityData } = await supabase
            .from('activity_samples')
            .select('session_id, idle');

        // Build stats map keyed by user email (best we have to cross-reference)
        //  session user_id is usually the member's email or name
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
            // Try to match stats by email (tracker sends email as user_id after auth)
            const stats = statsMap[m.email] || statsMap[m.full_name] || null;
            return {
                ...m,
                totalMinutes: stats?.min || 0,
                activityPercent: stats && stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0,
                lastSeen: stats?.last || null,
                sessionCount: stats?.count || 0,
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

            // Show invite-sent confirmation
            setInviteSentTo(data.member.email);

            // Close add form, reset
            setShowAddModal(false);
            resetAddForm();

            // Refresh member list
            await fetchMembers();
        } catch (e: any) {
            setAddError(e.message);
        } finally {
            setAdding(false);
        }
    }

    async function handleToggleTracking(m: MemberRow) {
        handleUpdateMeta(m.id, { tracking_enabled: !m.tracking_enabled });
    }

    async function handleRemove(m: MemberRow) {
        handleUpdateMeta(m.id, { status: 'Inactive' });
    }

    async function handleUpdateMeta(id: string, patch: Partial<DbMember>) {
        try {
            await fetch(`${API}/api/members/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(patch),
            });
            setMembers(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m));
        } catch { }
        setOpenActions(null);
        setEditMember(null);
    }

    function resetAddForm() {
        setAddEmail(''); setAddRole('User');
        setAddPayRate(''); setAddBillRate(''); setAddWeekly('40'); setAddDaily('8');
        setAddError(null);
    }

    function copyLink() {
        navigator.clipboard.writeText('https://digireps.app/download');
        setInviteLinkCopied(true);
        setTimeout(() => setInviteLinkCopied(false), 2000);
    }

    const filtered = members.filter(m =>
        m.full_name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
    );

    const activeCount = members.filter(m => m.status === 'Active').length;

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Members</h1>
                    <p className="text-slate-500 text-sm mt-1">{activeCount} active members</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => exportCSV(members)}
                        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <Download className="w-4 h-4" /> Export
                    </button>
                    <button
                        className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                        <Filter className="w-4 h-4" /> Filters
                    </button>
                    <button onClick={() => { resetAddForm(); setShowAddModal(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                        <UserPlus className="w-4 h-4" /> Add member
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
                {(['members', 'invites'] as const).map(t => (
                    <button key={t} onClick={() => setTab(t)}
                        className={`pb-3 text-sm font-medium capitalize border-b-2 transition-colors -mb-px ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                        {t === 'members' ? `Members (${activeCount})` : 'Invite via link'}
                    </button>
                ))}
            </div>

            {/* Search */}
            <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Search members..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
            </div>

            {/* Members tab */}
            {tab === 'members' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    {loading ? (
                        <div className="p-12 text-center text-slate-400">Loading members…</div>
                    ) : filtered.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
                            <Users className="w-10 h-10 text-slate-200" />
                            <p className="font-medium">No members yet</p>
                            <p className="text-sm">Click "Add member" to create the first team member.</p>
                        </div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-100 bg-slate-50/60">
                                    {['Member', 'Status', 'Role', 'Payment', 'Limits', 'Time tracking', 'Date added', ''].map(h => (
                                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(m => (
                                    <MemberTableRow
                                        key={m.id}
                                        m={m}
                                        openActions={openActions}
                                        setOpenActions={setOpenActions}
                                        onEdit={() => setEditMember(m)}
                                        onToggleTracking={() => handleToggleTracking(m)}
                                        onRemove={() => handleRemove(m)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {/* Invite link tab */}
            {tab === 'invites' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 max-w-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <UserPlus className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-800">Invite via link</p>
                            <p className="text-sm text-slate-500">Share this link — once they sign up, add them as a member.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs text-slate-500 font-mono truncate">https://digireps.app/download</div>
                        <button onClick={copyLink}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${inviteLinkCopied ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                            {inviteLinkCopied ? <><CheckCircle className="w-3.5 h-3.5" /> Copied</> : <><Copy className="w-3.5 h-3.5" /> Copy</>}
                        </button>
                    </div>
                </div>
            )}

            {/* ── INVITE MEMBER MODAL ── */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={e => { if (e.target === e.currentTarget) { setShowAddModal(false); } }}>
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <h2 className="text-base font-semibold text-slate-900">Invite member</h2>
                            <button onClick={() => setShowAddModal(false)} className="p-1 hover:bg-slate-100 rounded-lg">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
                                <Mail className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>An <strong>invite email</strong> will be sent to the member. They'll click the link to set their own name and password — no temporary credentials needed.</span>
                            </div>

                            <FormField label="Email *" value={addEmail} onChange={setAddEmail} type="email" placeholder="jane@company.com" />

                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Role</label>
                                <div className="relative">
                                    <select value={addRole} onChange={e => setAddRole(e.target.value as Role)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                                        {(['User', 'Viewer', 'Manager', 'Admin'] as Role[]).map(r => <option key={r}>{r}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Pay Rate ($/hr)" value={addPayRate} onChange={setAddPayRate} type="number" placeholder="25" />
                                <FormField label="Bill Rate ($/hr)" value={addBillRate} onChange={setAddBillRate} type="number" placeholder="—" />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <FormField label="Weekly Limit (hrs)" value={addWeekly} onChange={setAddWeekly} type="number" placeholder="40" />
                                <FormField label="Daily Limit (hrs)" value={addDaily} onChange={setAddDaily} type="number" placeholder="8" />
                            </div>

                            {addError && (
                                <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{addError}</div>
                            )}
                        </div>
                        <div className="px-6 pb-5 flex gap-3">
                            <button onClick={() => setShowAddModal(false)}
                                className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                                Cancel
                            </button>
                            <button onClick={handleAddMember} disabled={adding || !addEmail.trim()}
                                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                <Mail className="w-4 h-4" />
                                {adding ? 'Sending invite…' : 'Send invite'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── INVITE SENT CONFIRMATION MODAL ── */}
            {inviteSentTo && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
                        <div className="bg-emerald-50 border-b border-emerald-100 px-6 py-5 flex flex-col items-center text-center gap-3">
                            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
                                <CheckCircle className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <p className="font-bold text-emerald-900 text-base">Invite sent!</p>
                                <p className="text-xs text-emerald-700 mt-0.5">An email has been sent to</p>
                                <p className="text-sm font-semibold text-emerald-800 mt-1">{inviteSentTo}</p>
                            </div>
                        </div>
                        <div className="px-6 py-4 text-xs text-slate-500 text-center space-y-1">
                            <p>The member will receive a link to set their name and password.</p>
                            <p>Once they complete setup, their status will change to <strong>Active</strong>.</p>
                        </div>
                        <div className="px-6 pb-5">
                            <button onClick={() => setInviteSentTo(null)}
                                className="w-full bg-slate-900 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-slate-800 transition-colors">
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── EDIT MEMBER MODAL ── */}
            {editMember && (
                <EditMemberModal
                    member={editMember}
                    onClose={() => setEditMember(null)}
                    onSave={(patch) => handleUpdateMeta(editMember.id, patch)}
                />
            )}
        </div>
    );
}

// ─── Member Table Row ─────────────────────────────────────────────────────────
function MemberTableRow({ m, openActions, setOpenActions, onEdit, onToggleTracking, onRemove }: {
    m: MemberRow;
    openActions: string | null;
    setOpenActions: (id: string | null) => void;
    onEdit: () => void;
    onToggleTracking: () => void;
    onRemove: () => void;
}) {
    const dropRef = useRef<HTMLDivElement>(null);
    const initials = m.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    const color = stringToColor(m.id);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
                setOpenActions(null);
            }
        }
        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, []);

    return (
        <tr className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${m.status === 'Inactive' ? 'opacity-50' : ''}`}>
            {/* Member */}
            <td className="px-4 py-3.5">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: color }}>
                        {initials}
                    </div>
                    <div>
                        <p className="font-medium text-slate-800 text-sm">{m.full_name}</p>
                        <p className="text-xs text-slate-400">{m.email}</p>
                    </div>
                </div>
            </td>
            {/* Status */}
            <td className="px-4 py-3.5">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${m.status === 'Active' ? 'bg-emerald-100 text-emerald-700'
                    : m.status === 'Pending' ? 'bg-amber-100 text-amber-700'
                        : 'bg-slate-100 text-slate-500'}`}>
                    {m.status}
                </span>
            </td>
            {/* Role */}
            <td className="px-4 py-3.5">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>{m.role}</span>
            </td>
            {/* Payment */}
            <td className="px-4 py-3.5">
                <div className="text-xs text-slate-600">
                    <p>Pay: {m.pay_rate != null ? `$${m.pay_rate}/hr` : <span className="text-slate-400">No pay rate</span>}</p>
                    <p>Bill: {m.bill_rate != null ? `$${m.bill_rate}/hr` : <span className="text-slate-400">No bill rate</span>}</p>
                </div>
            </td>
            {/* Limits */}
            <td className="px-4 py-3.5">
                <div className="text-xs text-slate-600">
                    <p>{m.weekly_limit}:00 / week</p>
                    <p>{m.daily_limit}:00 / day</p>
                </div>
            </td>
            {/* Time tracking */}
            <td className="px-4 py-3.5">
                {m.tracking_enabled
                    ? <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">Enabled</span>
                    : <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">Disabled</span>}
            </td>
            {/* Date added */}
            <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap">
                {new Date(m.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </td>
            {/* Actions */}
            <td className="px-4 py-3.5">
                <div className="relative" ref={dropRef}>
                    <button onClick={() => setOpenActions(openActions === m.id ? null : m.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50 transition-colors">
                        Actions <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    {openActions === m.id && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-20 py-1.5 w-48">
                            <DropItem icon={<Pencil className="w-3.5 h-3.5" />} label="Edit member" onClick={onEdit} />
                            <DropItem
                                icon={m.tracking_enabled ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                                label={m.tracking_enabled ? 'Disable tracking' : 'Enable tracking'}
                                onClick={onToggleTracking} />
                            <div className="my-1 border-t border-slate-100" />
                            <DropItem icon={<Trash2 className="w-3.5 h-3.5 text-rose-400" />} label="Remove member" onClick={onRemove} danger />
                        </div>
                    )}
                </div>
            </td>
        </tr>
    );
}

function DropItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
    return (
        <button onClick={onClick}
            className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-sm hover:bg-slate-50 transition-colors text-left ${danger ? 'text-rose-500' : 'text-slate-700'}`}>
            {icon}{label}
        </button>
    );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────
function EditMemberModal({ member, onClose, onSave }: { member: MemberRow; onClose: () => void; onSave: (p: Partial<DbMember>) => void }) {
    const [name, setName] = useState(member.full_name);
    const [email, setEmail] = useState(member.email);
    const [role, setRole] = useState(member.role);
    const [payRate, setPayRate] = useState(member.pay_rate?.toString() || '');
    const [billRate, setBillRate] = useState(member.bill_rate?.toString() || '');
    const [weekly, setWeekly] = useState(member.weekly_limit.toString());
    const [daily, setDaily] = useState(member.daily_limit.toString());

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <h2 className="text-base font-semibold text-slate-900">Edit member</h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg"><X className="w-5 h-5 text-slate-400" /></button>
                </div>
                <div className="px-6 py-5 space-y-4">
                    <FormField label="Display Name" value={name} onChange={setName} placeholder="Full name" />
                    <FormField label="Email" value={email} onChange={setEmail} type="email" placeholder="email@company.com" />
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Role</label>
                        <select value={role} onChange={e => setRole(e.target.value as Role)}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                            {(['User', 'Viewer', 'Manager', 'Admin'] as Role[]).map(r => <option key={r}>{r}</option>)}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Pay Rate ($/hr)" value={payRate} onChange={setPayRate} type="number" placeholder="25" />
                        <FormField label="Bill Rate ($/hr)" value={billRate} onChange={setBillRate} type="number" placeholder="—" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <FormField label="Weekly Limit (hrs)" value={weekly} onChange={setWeekly} type="number" placeholder="40" />
                        <FormField label="Daily Limit (hrs)" value={daily} onChange={setDaily} type="number" placeholder="8" />
                    </div>
                </div>
                <div className="px-6 pb-5 flex gap-3">
                    <button onClick={onClose} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                    <button onClick={() => onSave({ full_name: name, email, role, pay_rate: payRate ? parseFloat(payRate) : null, bill_rate: billRate ? parseFloat(billRate) : null, weekly_limit: parseInt(weekly) || 40, daily_limit: parseInt(daily) || 8 })}
                        className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700">
                        Save changes
                    </button>
                </div>
            </div>
        </div>
    );
}

function FormField({ label, value, onChange, type = 'text', placeholder }: { label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }) {
    return (
        <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
    );
}

function stringToColor(str: string): string {
    const colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length] as string;
}

function exportCSV(members: MemberRow[]) {
    const rows = [['Name', 'Email', 'Role', 'Status', 'Pay Rate', 'Bill Rate', 'Weekly Limit', 'Tracking', 'Date Added']];
    members.forEach(m => rows.push([
        m.full_name, m.email, m.role, m.status,
        m.pay_rate != null ? `$${m.pay_rate}/hr` : 'No pay rate',
        m.bill_rate != null ? `$${m.bill_rate}/hr` : 'No bill rate',
        `${m.weekly_limit}:00`, m.tracking_enabled ? 'Enabled' : 'Disabled',
        new Date(m.created_at).toLocaleDateString(),
    ]));
    const blob = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'members.csv'; a.click();
}
