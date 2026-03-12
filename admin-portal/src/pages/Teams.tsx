import { useEffect, useState } from 'react';
import {
    Users, Search,
    Trash2, Shield, LayoutGrid, List, X,
    ChevronRight, UsersRound, Plus, Pencil
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

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
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        try {
            const [tRes, mRes] = await Promise.all([
                fetch(`${API}/api/teams`),
                fetch(`${API}/api/members`)
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
            member_ids: Array.from(selectedMemberIds)
        };

        try {
            const res = await fetch(`${API}/api/teams${editingTeam ? `/${editingTeam.id}` : ''}`, {
                method: editingTeam ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
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
            const res = await fetch(`${API}/api/teams/${deletingTeam.id}`, { method: 'DELETE' });
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
        <div className="p-8 max-w-[1600px] mx-auto w-full fade-in">
            {/* Header section with Stats */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-100 ring-4 ring-indigo-50">
                            <UsersRound className="w-8 h-8 text-white" />
                        </div>
                        Team Management
                    </h1>
                    <p className="text-slate-500 mt-3 font-medium text-lg">Organize your workforce into specialized teams and assign managers.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex bg-white border border-slate-200 p-1 rounded-xl shadow-sm mr-2">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-slate-100 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <LayoutGrid className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-slate-100 text-indigo-600 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            <List className="w-5 h-5" />
                        </button>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200 hover:shadow-indigo-200 active:scale-95"
                    >
                        <Plus className="w-5 h-5" />
                        Create Team
                    </button>
                </div>
            </div>

            {/* Quick Stats Banner */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div className="bg-indigo-600 p-8 rounded-[2.5rem] text-white shadow-2xl shadow-indigo-100 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16 group-hover:scale-110 transition-transform duration-500" />
                    <p className="text-indigo-100 font-bold uppercase tracking-widest text-[10px] mb-2">Total Teams</p>
                    <h2 className="text-5xl font-black tracking-tighter">{teams.length}</h2>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2">Total Managed</p>
                    <h2 className="text-5xl font-black tracking-tighter text-slate-900">{teams.reduce((acc, t) => acc + t.member_count, 0)}</h2>
                    <Users className="absolute bottom-6 right-6 w-12 h-12 text-slate-50 group-hover:text-indigo-50 transition-colors duration-300" />
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group hover:border-indigo-500/30 transition-all">
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px] mb-2">Average Team Size</p>
                    <h2 className="text-5xl font-black tracking-tighter text-slate-900">
                        {teams.length > 0 ? (teams.reduce((acc, t) => acc + t.member_count, 0) / teams.length).toFixed(1) : '0'}
                    </h2>
                    <Shield className="absolute bottom-6 right-6 w-12 h-12 text-slate-50 group-hover:text-indigo-50 transition-colors duration-300" />
                </div>
            </div>

            {/* Controls Bar */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-sm mb-8 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-[400px]">
                        <Search className="w-5 h-5 text-slate-400 absolute left-5 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search by team name or manager..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all shadow-sm"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="p-24 text-center">
                        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Loading Teams...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-24 text-center">
                        <UsersRound className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">No Teams Found</h3>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2">Get started by creating your first team to organize your members.</p>
                        <button
                            onClick={openCreateModal}
                            className="mt-8 text-indigo-600 font-black uppercase tracking-widest text-xs hover:text-indigo-700 underline underline-offset-8"
                        >
                            Create standard team
                        </button>
                    </div>
                ) : (
                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-8" : "divide-y divide-slate-100"}>
                        {filtered.map((team) => (
                            <TeamItem
                                key={team.id}
                                team={team}
                                mode={viewMode}
                                onEdit={() => openEditModal(team)}
                                onManage={() => setManagingMembersTeam(team)}
                                onDelete={() => setDeletingTeam(team)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* CREATE/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl shadow-indigo-900/20 overflow-hidden border border-slate-200">
                        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">{editingTeam ? 'Edit Team' : 'New Team'}</h2>
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Basic Information</p>
                            </div>
                            <button onClick={() => setShowModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Team Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Quality Assurance"
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Description</label>
                                <textarea
                                    value={description}
                                    onChange={e => setDescription(e.target.value)}
                                    placeholder="What does this team focus on?"
                                    rows={3}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all resize-none"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-indigo-600 flex items-center gap-2">
                                    <Shield className="w-3 h-3" />
                                    Team Manager
                                </label>
                                <select
                                    value={managerId}
                                    onChange={e => setManagerId(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:bg-white focus:border-indigo-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">No manager assigned</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.full_name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                            <button
                                onClick={() => setShowModal(false)}
                                className="flex-1 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={!name}
                                className="flex-[2] bg-indigo-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95"
                            >
                                {editingTeam ? 'Update Team' : 'Create Team'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {deletingTeam && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in zoom-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-md p-12 text-center shadow-2xl shadow-rose-900/20 border border-slate-100">
                        <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner shadow-rose-100">
                            <Trash2 className="w-8 h-8 text-rose-500" />
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-4">Delete Team?</h2>
                        <p className="text-slate-500 font-medium leading-relaxed mb-10">
                            Are you sure you want to delete <span className="text-rose-600 font-black">"{deletingTeam.name}"</span>?
                            Members will not be deleted, they will just be removed from this team.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setDeletingTeam(null)}
                                className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all"
                            >
                                Nevermind
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-[1.5] bg-rose-500 text-white py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-rose-600 transition-all shadow-xl shadow-rose-100 active:scale-95"
                            >
                                Yes, Delete
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
                />
            )}
        </div>
    );
}

function ManageMembersModal({ team, allMembers, onClose, onSuccess }: {
    team: Team;
    allMembers: Member[];
    onClose: () => void;
    onSuccess: () => void;
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
            <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl overflow-hidden border border-slate-200">
                <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 tracking-tight">Manage Members</h2>
                        <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">{team.name}</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                        <X className="w-6 h-6 text-slate-400" />
                    </button>
                </div>
                <div className="p-8 max-h-[50vh] overflow-y-auto space-y-4">
                    {allMembers.map(m => {
                        const isSelected = selectedIds.has(m.id);
                        return (
                            <button
                                key={m.id}
                                onClick={() => {
                                    const next = new Set(selectedIds);
                                    if (next.has(m.id)) next.delete(m.id);
                                    else next.add(m.id);
                                    setSelectedIds(next);
                                }}
                                className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all ${isSelected ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-100 hover:bg-slate-50'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-black text-indigo-600">
                                        {m.full_name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div className="text-left">
                                        <p className="text-sm font-black text-slate-800 tracking-tight">{m.full_name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{m.email}</p>
                                    </div>
                                </div>
                                <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-slate-200'}`}>
                                    {isSelected && <X className="w-4 h-4 text-white" style={{ transform: 'rotate(45deg)' }} />}
                                </div>
                            </button>
                        );
                    })}
                </div>
                <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                    <button onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                    <button onClick={handleSave} disabled={loading} className="flex-[2] bg-indigo-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50">
                        {loading ? 'Saving...' : 'Update Members'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function TeamItem({ team, mode, onEdit, onManage, onDelete }: {
    team: Team;
    mode: 'grid' | 'list';
    onEdit: () => void;
    onManage: () => void;
    onDelete: () => void;
}) {
    const initials = team.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

    if (mode === 'list') {
        return (
            <div className="px-8 py-5 flex items-center group hover:bg-slate-50/50 transition-all cursor-pointer">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-black text-sm mr-6 group-hover:scale-110 transition-transform">
                    {initials}
                </div>
                <div className="flex-1">
                    <h3 className="font-black text-slate-800 tracking-tight text-lg leading-tight">{team.name}</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5 truncate max-w-md">{team.description || 'No description provided'}</p>
                </div>
                <div className="px-12">
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">Manager</p>
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
                            <Shield className="w-3 h-3 text-white" />
                        </div>
                        <span className="text-sm font-bold text-slate-700">{team.manager_name}</span>
                    </div>
                </div>
                <div className="px-12">
                    <p className="text-xs font-black text-slate-300 uppercase tracking-widest mb-1">Members</p>
                    <div className="flex items-center gap-2 text-indigo-600 font-black">
                        <UsersRound className="w-4 h-4" />
                        <span className="text-sm">{team.member_count}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 ml-auto opacity-0 group-hover:opacity-100 transition-all">
                    <button onClick={onEdit} className="p-3 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-indigo-600 shadow-sm">
                        <Pencil className="w-5 h-5" />
                    </button>
                    <button onClick={onManage} className="p-3 hover:bg-white rounded-xl border border-transparent hover:border-slate-200 transition-all text-slate-400 hover:text-indigo-600 shadow-sm">
                        <Users className="w-5 h-5" />
                    </button>
                    <button onClick={onDelete} className="p-3 hover:bg-rose-50 rounded-xl border border-transparent hover:border-rose-100 transition-all text-slate-300 hover:text-rose-500 shadow-sm">
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-slate-50 border border-slate-100 rounded-[2.5rem] p-10 hover:bg-white hover:border-indigo-500/20 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all duration-500 group relative overflow-hidden flex flex-col h-full">
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-all flex flex-col gap-2">
                <button onClick={onEdit} className="p-3 bg-white hover:bg-indigo-600 hover:text-white rounded-2xl shadow-xl shadow-slate-200/50 text-slate-400 transition-all border border-slate-100">
                    <Pencil className="w-5 h-5" />
                </button>
                <button onClick={onDelete} className="p-3 bg-white hover:bg-rose-500 hover:text-white rounded-2xl shadow-xl shadow-slate-200/50 text-slate-400 transition-all border border-slate-100">
                    <Trash2 className="w-5 h-5" />
                </button>
            </div>

            <div className="mb-8">
                <div className="w-20 h-20 rounded-[2rem] bg-indigo-600/5 border-2 border-indigo-600/10 flex items-center justify-center font-black text-indigo-600 text-2xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 mb-6">
                    {initials}
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-3 group-hover:text-indigo-600 transition-colors">{team.name}</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed line-clamp-2 min-h-[40px] italic">
                    {team.description || "No description provided for this team."}
                </p>
            </div>

            <div className="mt-auto space-y-6">
                <div className="flex items-center justify-between p-5 bg-white rounded-3xl border border-slate-100 group-hover:border-indigo-100 transition-all shadow-sm">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white ring-4 ring-slate-50">
                            <Shield className="w-6 h-6" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1.5">Manager</p>
                            <p className="text-sm font-black text-slate-800 tracking-tight">{team.manager_name}</p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between px-2 pt-2">
                    <div className="flex items-center gap-3">
                        <div className="flex -space-x-3">
                            {[...Array(Math.min(3, team.member_count))].map((_, i) => (
                                <div key={i} className="w-9 h-9 rounded-2xl bg-indigo-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-indigo-600 ring-4 ring-indigo-50/20 shadow-sm">
                                    <UsersRound className="w-4 h-4" />
                                </div>
                            ))}
                            {team.member_count > 3 && (
                                <div className="w-9 h-9 rounded-2xl bg-slate-100 border-2 border-white flex items-center justify-center text-[10px] font-black text-slate-500 ring-4 ring-slate-50/20 shadow-sm">
                                    +{team.member_count - 3}
                                </div>
                            )}
                        </div>
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{team.member_count} Members</span>
                    </div>
                    <button 
                        onClick={onManage}
                        className="flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-black uppercase tracking-widest text-[10px] transition-all group/btn"
                    >
                        Manage
                        <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </div>
    );
}
