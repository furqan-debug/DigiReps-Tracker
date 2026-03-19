import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    Users, Search,
    Trash2, Shield, LayoutGrid, List, X,
    ChevronRight, UsersRound, Plus, Pencil, Check
} from 'lucide-react';
import clsx from 'clsx';

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

interface Team {
    id: string;
    name: string;
    description: string;
    manager_id: string | null;
    manager_name?: string;
    member_count: number;
    created_at: string;
}

interface Member {
    id: string;
    full_name: string;
    email: string;
}

export function Teams() {
    const { profile, session } = useAuth();
    const isViewer = profile?.role === 'Viewer';
    const [teams, setTeams] = useState<Team[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    // Modal states
    const [showModal, setShowModal] = useState(false);
    const [editingTeam, setEditingTeam] = useState<Team | null>(null);
    const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
    const [managingMembersTeam, setManagingMembersTeam] = useState<Team | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [managerId, setManagerId] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [tRes, mRes] = await Promise.all([
                fetch(`${API}/api/teams`, {
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                }),
                fetch(`${API}/api/members`, {
                    headers: { 'Authorization': `Bearer ${session?.access_token}` }
                })
            ]);
            if (tRes.ok) setTeams(await tRes.json());
            if (mRes.ok) setMembers(await mRes.json());
        } catch (e) {
            console.error('Fetch teams error:', e);
        } finally {
            setLoading(false);
        }
    }

    function openCreateModal() {
        setEditingTeam(null);
        setName('');
        setDescription('');
        setManagerId('');
        setShowModal(true);
    }

    function openEditModal(team: Team) {
        setEditingTeam(team);
        setName(team.name);
        setDescription(team.description);
        setManagerId(team.manager_id || '');
        setShowModal(true);
    }

    async function handleSave() {
        const payload = {
            name,
            description,
            manager_id: managerId || null,
            member_ids: [],
            organization_id: profile?.organization_id
        };

        try {
            const res = await fetch(`${API}/api/teams${editingTeam ? `/${editingTeam.id}` : ''}`, {
                method: editingTeam ? 'PUT' : 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                setShowModal(false);
                fetchData();
            }
        } catch (e) {
            console.error('Save team error:', e);
        }
    }

    async function handleDelete() {
        if (!deletingTeam) return;
        try {
            const res = await fetch(`${API}/api/teams/${deletingTeam.id}`, { 
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                setDeletingTeam(null);
                fetchData();
            }
        } catch (e) {
            console.error('Delete team error:', e);
        }
    }

    const filtered = teams.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="flex flex-col h-full bg-transparent">
            {/* Header section with Stats */}
            <div className="px-10 py-12 border-b border-black/[0.05] bg-white/[0.01]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                                <UsersRound className="w-6 h-6 text-primary" strokeWidth={2.5} />
                            </div>
                            <h1 className="text-3xl font-black text-text-primary tracking-tighter">Resource Clusters</h1>
                        </div>
                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed">Strategic workforce units and operational hierarchy matrix</p>
                    </div>

                    <div className="flex items-center gap-5">
                        <div className="flex glass border border-black/[0.05] p-1.5 rounded-2xl shadow-sm">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={clsx(
                                    "p-3 rounded-xl transition-all duration-300",
                                    viewMode === 'grid' ? "bg-primary text-white shadow-lg" : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                                )}
                            >
                                <LayoutGrid className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={clsx(
                                    "p-3 rounded-xl transition-all duration-300",
                                    viewMode === 'list' ? "bg-primary text-white shadow-lg" : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                                )}
                            >
                                <List className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            onClick={openCreateModal}
                            disabled={isViewer}
                            className={clsx(
                                "flex items-center gap-3 px-10 py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 font-mono",
                                isViewer ? "bg-black/5 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02]"
                            )}
                        >
                            <Plus className="w-4 h-4 stroke-[4]" />
                            Initialize Cluster
                        </button>
                    </div>
                </div>

                {/* Quick Stats Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <div className="glass p-8 rounded-[32px] border border-black/[0.03] hover:border-primary/20 transition-all group overflow-hidden relative shadow-sm hover:shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-125 transition-transform duration-1000" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3 font-mono">Total Units</p>
                        <h2 className="text-5xl font-black text-text-primary tracking-tighter leading-none">{teams.length}</h2>
                    </div>
                    <div className="glass p-8 rounded-[32px] border border-black/[0.03] hover:border-primary/20 transition-all group overflow-hidden relative shadow-sm hover:shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-125 transition-transform duration-1000" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3 font-mono">Active Workforce</p>
                        <h2 className="text-5xl font-black text-text-primary tracking-tighter leading-none">{teams.reduce((acc, t) => acc + (t.member_count || 0), 0)}</h2>
                        <Users className="absolute bottom-6 right-8 w-12 h-12 text-black/[0.02] group-hover:text-primary/5 transition-colors duration-500" />
                    </div>
                    <div className="glass p-8 rounded-[32px] border border-black/[0.03] hover:border-primary/20 transition-all group overflow-hidden relative shadow-sm hover:shadow-xl">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -translate-y-16 translate-x-16 group-hover:scale-125 transition-transform duration-1000" />
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-3 font-mono">Cluster Density</p>
                        <h2 className="text-5xl font-black text-text-primary tracking-tighter leading-none">
                            {teams.length > 0 ? (teams.reduce((acc, t) => acc + (t.member_count || 0), 0) / teams.length).toFixed(1) : '0'}
                        </h2>
                        <Shield className="absolute bottom-6 right-8 w-12 h-12 text-black/[0.02] group-hover:text-primary/5 transition-colors duration-500" />
                    </div>
                </div>
            </div>

            <div className="p-10 flex-1 overflow-auto custom-scrollbar">
                {/* Search Bar */}
                <div className="relative group max-w-2xl mb-12">
                    <Search className="w-5 h-5 text-text-muted absolute left-6 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" strokeWidth={2.5} />
                    <input
                        type="text"
                        placeholder="QUERY CLUSTER REGISTRY OR FACILITATOR..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full pl-15 pr-8 py-5 bg-white border border-black/[0.05] rounded-[24px] text-[13px] font-black text-text-primary placeholder:text-text-muted/40 outline-none focus:ring-8 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm font-mono uppercase"
                    />
                </div>

                {loading ? (
                    <div className="p-40 text-center">
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-16 h-16 border-[6px] border-primary/10 border-t-primary rounded-full animate-spin shadow-inner" />
                            <span className="text-[11px] font-black text-text-muted uppercase tracking-[0.5em] animate-pulse font-mono">Syncing Matrix Core...</span>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-40 text-center">
                        <div className="flex flex-col items-center gap-10">
                            <div className="w-32 h-32 bg-black/[0.02] border border-black/[0.05] rounded-[56px] flex items-center justify-center rotate-6 shadow-sm">
                                <UsersRound className="w-16 h-16 text-text-muted/20" strokeWidth={1.5} />
                            </div>
                            <div className="space-y-4">
                                <h3 className="text-2xl font-black text-text-primary tracking-tighter">No Cluster Detected</h3>
                                <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono italic">Operational sector remains void of workforce units</p>
                            </div>
                            <button
                                onClick={openCreateModal}
                                disabled={isViewer}
                                className={clsx(
                                    "font-black uppercase tracking-[0.3em] text-[10px] transition-all px-10 py-4 rounded-2xl font-mono",
                                    isViewer ? "text-text-muted cursor-default" : "bg-primary text-white hover:shadow-primary/30 hover:scale-105 active:scale-95 shadow-xl"
                                )}
                            >
                                Initialize Protocol
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={clsx(
                        viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10 pb-20" : "glass rounded-[40px] border border-black/[0.05] overflow-hidden divide-y divide-black/[0.03] shadow-2xl mb-20"
                    )}>
                        {filtered.map((team) => (
                            <TeamItem
                                key={team.id}
                                team={team}
                                mode={viewMode}
                                onEdit={() => openEditModal(team)}
                                onManage={() => setManagingMembersTeam(team)}
                                onDelete={() => setDeletingTeam(team)}
                                isViewer={isViewer}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* CREATE/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-primary/10 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] w-full max-w-[580px] shadow-[0_32px_120px_rgba(0,0,0,0.12)] flex flex-col border border-black/[0.05] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="px-10 pt-10 pb-0 bg-black/[0.01]">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                        <UsersRound className="w-7 h-7 text-primary" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-text-primary tracking-tighter leading-none mb-2">{editingTeam ? 'Reconfigure Cluster' : 'Initialize Cluster'}</h2>
                                        <p className="text-[11px] font-black text-text-muted uppercase tracking-[0.3em] font-mono">Resource unit metadata and authorization</p>
                                    </div>
                                </div>
                                <button onClick={() => setShowModal(false)} className="p-3 bg-black/[0.03] hover:bg-black/[0.08] rounded-2xl transition-all text-text-muted hover:text-text-primary shadow-sm hover:scale-110 active:scale-90"><X className="w-5 h-5" strokeWidth={3} /></button>
                            </div>
                        </div>

                        <div className="px-10 py-10 space-y-8 bg-white">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono mb-1">Cluster Identifier *</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="DESIGNATE CLUSTER NAME..."
                                    className="w-full bg-black/[0.02] border border-black/[0.05] rounded-2xl px-6 py-4 text-[13px] font-black text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all font-mono placeholder:text-text-muted/30 uppercase"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono mb-1">Operational Protocol</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="DEFINE PRIMARY CLUSTER OBJECTIVES..."
                                    rows={3}
                                    className="w-full bg-black/[0.02] border border-black/[0.05] rounded-2xl px-6 py-4 text-[13px] font-black text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all font-mono placeholder:text-text-muted/30 uppercase resize-none custom-scrollbar"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-black text-primary uppercase tracking-[0.3em] font-mono mb-1 flex items-center gap-2">
                                    <Shield className="w-3.5 h-3.5" strokeWidth={3} />
                                    Cluster Authority
                                </label>
                                <div className="relative group">
                                    <select
                                        value={managerId}
                                        onChange={e => setManagerId(e.target.value)}
                                        className="w-full pl-6 pr-12 py-4 bg-black/[0.02] border border-black/[0.05] rounded-2xl text-[13px] font-black text-text-primary appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-mono uppercase cursor-pointer"
                                    >
                                        <option value="" className="bg-white">NO AUTHORITY ASSIGNED</option>
                                        {members.map(m => (
                                            <option key={m.id} value={m.id} className="bg-white">{m.full_name.toUpperCase()}</option>
                                        ))}
                                    </select>
                                    <ChevronRight className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none group-hover:text-primary transition-colors rotate-90" strokeWidth={3} />
                                </div>
                            </div>
                        </div>

                        <div className="px-10 py-8 border-t border-black/[0.05] bg-black/[0.01] flex items-center justify-end gap-4">
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-8 py-4 rounded-2xl border border-black/[0.1] text-[11px] font-black text-text-muted hover:text-text-primary hover:bg-white transition-all uppercase tracking-[0.2em] font-mono active:scale-95 shadow-sm"
                            >
                                ABORT
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!name || isViewer}
                                className={clsx(
                                    "px-10 py-4 rounded-2xl text-[11px] font-black transition-all shadow-xl flex items-center gap-3 uppercase tracking-[0.3em] font-mono active:scale-95",
                                    isViewer || !name ? "bg-black/20 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02]"
                                )}
                            >
                                {editingTeam ? 'SYNCHRONIZE UNIT' : 'INITIALIZE UNIT'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingTeam && (
                <div className="fixed inset-0 z-[100] bg-text-primary/10 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="bg-white border border-rose-500/10 rounded-[48px] w-full max-w-md p-12 text-center shadow-[0_40px_120px_rgba(225,29,72,0.1)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="w-28 h-28 bg-rose-500/5 rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-inner border border-rose-500/10 rotate-6 group-hover:rotate-0 transition-transform duration-700">
                            <Trash2 className="w-12 h-12 text-rose-600" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-black text-text-primary tracking-tighter mb-4 uppercase">Purge Cluster?</h2>
                        <p className="text-text-muted font-black uppercase tracking-widest leading-relaxed mb-12 text-[11px] font-mono opacity-60">
                            Operation will permanently decommission <span className="text-rose-600">"{deletingTeam.name.toUpperCase()}"</span>.
                            Personnel assignments will be reset to standalone status.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setDeletingTeam(null)}
                                className="flex-1 py-5 text-[11px] font-black uppercase tracking-widest text-text-muted hover:text-text-primary transition-all font-mono"
                            >
                                ABORT
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-[1.8] bg-rose-600 hover:bg-rose-700 text-white py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.3em] transition-all shadow-xl shadow-rose-900/10 active:scale-95 font-mono"
                            >
                                CONFIRM PURGE
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* MANAGE MEMBERS MODAL */}
            {managingMembersTeam && (
                <ManageMembersModal
                    team={managingMembersTeam}
                    allMembers={members}
                    onClose={() => setManagingMembersTeam(null)}
                    onSuccess={() => { setManagingMembersTeam(null); fetchData(); }}
                    isViewer={isViewer}
                />
            )}
        </div>
    );
}

function ManageMembersModal({ team, allMembers, onClose, onSuccess, isViewer }: {
    team: Team;
    allMembers: Member[];
    onClose: () => void;
    onSuccess: () => void;
    isViewer?: boolean;
}) {
    // Note: team.memberIds is populated by our refined backend API
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set((team as any).memberIds || []));
    const [loading, setLoading] = useState(false);

    async function handleSave() {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/teams/${team.id}/members`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_ids: Array.from(selectedIds) })
            });
            if (res.ok) onSuccess();
        } catch (e) {
            console.error('Update members error:', e);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-primary/10 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[48px] w-full max-w-[620px] shadow-[0_32px_120px_rgba(0,0,0,0.12)] flex flex-col border border-black/[0.05] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                <div className="px-12 pt-12 pb-0 bg-black/[0.01]">
                    <div className="flex items-start justify-between mb-10">
                        <div className="flex items-center gap-6">
                            <div className="w-16 h-16 rounded-[24px] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm transform -rotate-6 hover:rotate-0 transition-transform duration-700">
                                <Users className="w-8 h-8 text-primary" strokeWidth={2.5} />
                            </div>
                            <div>
                                <h2 className="text-3xl font-black text-text-primary tracking-tighter leading-none mb-2 uppercase">Personnel Registry</h2>
                                <p className="text-[11px] font-black text-primary uppercase tracking-[0.3em] font-mono">{team.name.toUpperCase()} UNIT ROSTER</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-4 bg-black/[0.03] hover:bg-black/[0.08] rounded-2xl transition-all text-text-muted hover:text-text-primary shadow-sm hover:scale-110 active:scale-90"><X className="w-6 h-6" strokeWidth={3} /></button>
                    </div>
                </div>

                <div className="px-12 py-10 max-h-[55vh] overflow-y-auto space-y-4 custom-scrollbar bg-white">
                    <div className="space-y-4 mb-8">
                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] font-mono px-2">Sector Intelligence Mapping ({allMembers.length} Total Nodes)</p>
                        <div className="space-y-3">
                            {allMembers.map(m => {
                                const isSelected = selectedIds.has(m.id);
                                return (
                                    <button
                                        key={m.id}
                                        onClick={() => {
                                            if (isViewer) return;
                                            const next = new Set(selectedIds);
                                            if (next.has(m.id)) next.delete(m.id);
                                            else next.add(m.id);
                                            setSelectedIds(next);
                                        }}
                                        className={clsx(
                                            "w-full flex items-center justify-between p-6 rounded-[28px] border transition-all duration-500 group/item",
                                            isSelected 
                                                ? "border-primary/30 bg-primary/[0.03] shadow-lg shadow-primary/5" 
                                                : "border-black/[0.03] bg-white hover:bg-black/[0.01] hover:border-black/[0.1]",
                                            isViewer ? "cursor-default" : ""
                                        )}
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className={clsx(
                                                "w-14 h-14 rounded-[18px] flex items-center justify-center text-[13px] font-black transition-all shadow-sm border border-black/[0.03] group-hover/item:scale-110",
                                                isSelected ? "bg-primary text-white shadow-primary/20" : "bg-black/[0.03] text-text-primary"
                                            )}>
                                                {m.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                                            </div>
                                            <div className="text-left">
                                                <p className="text-base font-black text-text-primary tracking-tight leading-none mb-2">{m.full_name.toUpperCase()}</p>
                                                <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.1em] font-mono opacity-60 truncate max-w-[240px]">{m.email}</p>
                                            </div>
                                        </div>
                                        <div className={clsx(
                                            "w-7 h-7 rounded-xl border-[2.5px] flex items-center justify-center transition-all duration-500",
                                            isSelected ? "bg-primary border-primary shadow-lg shadow-primary/20 rotate-0" : "border-black/[0.1] rotate-45 opacity-20 group-hover/item:opacity-100 group-hover/item:rotate-0"
                                        )}>
                                            {isSelected && <Check className="w-4 h-4 text-white stroke-[4]" />}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="px-12 py-10 bg-black/[0.01] border-t border-black/[0.05] flex gap-6">
                    <button onClick={onClose} className="flex-1 px-8 py-5 rounded-[20px] text-[11px] font-black uppercase tracking-[0.3em] text-text-muted hover:text-text-primary hover:bg-white transition-all font-mono active:scale-95 shadow-sm">ABORT MISSION</button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading || isViewer} 
                        className={clsx(
                            "flex-[2.2] px-10 py-5 rounded-[24px] text-[11px] font-black uppercase tracking-[0.4em] transition-all shadow-2xl active:scale-95 disabled:opacity-30 font-mono",
                            isViewer ? "bg-black/10 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02]"
                        )}
                    >
                        {loading ? 'SYNCHRONIZING...' : (isViewer ? 'REGISTRY LOCKED' : 'COMMIT ROSTER')}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TeamItem({ team, mode, onEdit, onManage, onDelete, isViewer }: {
    team: Team;
    mode: 'grid' | 'list';
    onEdit: () => void;
    onManage: () => void;
    onDelete: () => void;
    isViewer: boolean;
}) {
    const initials = team.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    if (mode === 'list') {
        return (
            <div className="px-10 py-8 flex items-center group/row hover:bg-black/[0.01] transition-all duration-500">
                <div className="w-16 h-16 rounded-[24px] bg-primary/5 border border-primary/20 flex items-center justify-center text-primary font-black text-base mr-10 group-hover/row:scale-110 transition-transform duration-700 shadow-sm font-mono">
                    {initials}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-text-primary tracking-tight text-xl leading-tight group-hover/row:text-primary transition-colors duration-500 mb-1">{team.name}</h3>
                    <p className="text-[10px] text-text-muted font-black uppercase tracking-[0.2em] font-mono truncate max-w-md">{team.description || 'GLOBAL PROTOCOL UNDEFINED'}</p>
                </div>
                <div className="px-12 shrink-0">
                    <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-[0.3em] mb-3 font-mono">Authority</p>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                            <Shield className="w-4 h-4 text-primary" strokeWidth={2.5} />
                        </div>
                        <span className="text-[13px] font-black text-text-primary tracking-tight uppercase font-mono">{team.manager_name || 'AUTONOMOUS'}</span>
                    </div>
                </div>
                <div className="px-12 shrink-0 border-x border-black/[0.03]">
                    <p className="text-[9px] font-black text-text-muted/40 uppercase tracking-[0.3em] mb-3 font-mono">Registry Size</p>
                    <div className="flex items-center gap-3 text-primary font-black">
                        <div className="w-8 h-8 rounded-xl bg-black/[0.03] flex items-center justify-center border border-black/[0.05] shadow-sm">
                            <UsersRound className="w-4 h-4 text-primary" strokeWidth={2.5} />
                        </div>
                        <span className="text-[13px] font-black font-mono tracking-tighter">{team.member_count} UNITS</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 ml-auto opacity-0 group-hover/row:opacity-100 transition-all duration-500 pr-4">
                    <button 
                        onClick={() => { if (!isViewer) onEdit(); }} 
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all shadow-sm active:scale-90",
                            isViewer ? "opacity-20 cursor-not-allowed" : "glass border-black/[0.05] hover:border-primary/50 text-text-muted hover:text-primary hover:bg-primary/5"
                        )}
                    >
                        <Pencil className="w-4.5 h-4.5" />
                    </button>
                    <button 
                        onClick={() => { if (!isViewer) onManage(); }} 
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all shadow-sm active:scale-90",
                            isViewer ? "opacity-20 cursor-not-allowed" : "glass border-black/[0.05] hover:border-primary/50 text-text-muted hover:text-primary hover:bg-primary/5"
                        )}
                    >
                        <Users className="w-4.5 h-4.5" />
                    </button>
                    <button 
                        onClick={() => { if (!isViewer) onDelete(); }} 
                        className={clsx(
                            "p-3.5 rounded-2xl border transition-all shadow-sm active:scale-90",
                            isViewer ? "opacity-20 cursor-not-allowed" : "glass border-black/[0.05] hover:border-rose-500/50 text-text-muted hover:text-rose-600 hover:bg-rose-50"
                        )}
                    >
                        <Trash2 className="w-4.5 h-4.5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="glass border border-black/[0.05] rounded-[44px] p-10 hover:border-primary/30 hover:shadow-[0_40px_100px_rgba(0,0,0,0.08)] transition-all duration-700 group relative overflow-hidden flex flex-col h-full animate-in fade-in slide-in-from-bottom-6 group/card">
            
            {/* Action Bar */}
            <div className="absolute top-8 right-8 opacity-0 group-hover/card:opacity-100 transition-all duration-500 flex flex-col gap-3 z-10">
                <button 
                    onClick={() => { if (!isViewer) onEdit(); }} 
                    disabled={isViewer}
                    className="p-4 glass border border-black/[0.1] rounded-[20px] shadow-xl hover:bg-primary hover:text-white hover:border-primary transition-all duration-500 text-text-muted active:scale-90"
                >
                    <Pencil className="w-4.5 h-4.5" strokeWidth={2.5} />
                </button>
                <button 
                    onClick={() => { if (!isViewer) onDelete(); }} 
                    disabled={isViewer}
                    className="p-4 glass border border-black/[0.1] rounded-[20px] shadow-xl hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all duration-500 text-text-muted active:scale-90"
                >
                    <Trash2 className="w-4.5 h-4.5" strokeWidth={2.5} />
                </button>
            </div>

            <div className="mb-12 relative">
                <div className="w-24 h-24 rounded-[32px] bg-primary/5 border border-primary/10 flex items-center justify-center font-black text-primary text-3xl group-hover/card:scale-110 group-hover/card:rotate-6 transition-all duration-1000 mb-10 shadow-inner font-mono">
                    {initials}
                </div>
                <h3 className="text-3xl font-black text-text-primary tracking-tighter mb-4 group-hover/card:text-primary transition-colors duration-500">{team.name}</h3>
                <p className="text-[13px] text-text-muted font-black uppercase tracking-widest leading-relaxed line-clamp-2 min-h-[48px] font-mono opacity-60">
                    {team.description || "Operational protocol for this unit remains undefined."}
                </p>
            </div>

            <div className="mt-auto space-y-10">
                <div className="glass p-8 rounded-[36px] border border-black/[0.03] group-hover/card:border-primary/20 transition-all duration-700 shadow-lg bg-white/[0.01]">
                    <div className="flex items-center gap-6">
                        <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl group-hover/card:scale-110 transition-transform duration-700">
                            <Shield className="w-6 h-6 stroke-[3]" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] leading-none mb-2 font-mono">Authority Node</p>
                            <p className="text-base font-black text-text-primary tracking-tight uppercase font-mono">{team.manager_name || 'Autonomous'}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-6">
                        <div className="flex -space-x-4">
                            {[...Array(Math.min(3, team.member_count))].map((_, i) => (
                                <div key={i} className="w-12 h-12 rounded-[18px] bg-white border-2 border-primary/20 flex items-center justify-center text-[11px] font-black text-primary shadow-xl transition-transform hover:scale-110 hover:z-10 group-hover/card:animate-pulse" style={{ animationDelay: `${i * 200}ms` }}>
                                    <UsersRound className="w-5 h-5" strokeWidth={2.5} />
                                </div>
                            ))}
                            {team.member_count > 3 && (
                                <div className="w-12 h-12 rounded-[18px] bg-primary border-2 border-white flex items-center justify-center text-[11px] font-black text-white shadow-xl scale-110 z-10">
                                    +{team.member_count - 3}
                                </div>
                            )}
                        </div>
                        <div>
                            <span className="block text-[10px] font-black text-text-muted uppercase tracking-[0.2em] font-mono leading-none mb-1">Registry Units</span>
                            <span className="text-[15px] font-black text-text-primary font-mono tracking-tighter">{team.member_count} ACTIVE</span>
                        </div>
                    </div>
                    <button 
                        onClick={onManage}
                        disabled={isViewer}
                        className={clsx(
                            "flex items-center gap-2 font-black uppercase tracking-[0.3em] text-[10px] transition-all group/btn font-mono p-4 rounded-xl",
                            isViewer ? "text-text-muted cursor-default" : "text-primary hover:bg-primary/5 active:scale-95"
                        )}
                    >
                        {isViewer ? 'INSPECT' : 'MANAGE'}
                        <ChevronRight className="w-5 h-5 group-hover/btn:translate-x-2 transition-transform" strokeWidth={3} />
                    </button>
                </div>
            </div>
            
            {/* Decorative Pulse */}
            <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/5 rounded-full blur-[80px] group-hover/card:bg-primary/10 transition-colors duration-1000" />
        </div>
    );
}
