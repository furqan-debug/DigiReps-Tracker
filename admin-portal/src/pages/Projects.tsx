import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Filter, MoreHorizontal,
    X, Check, Users, Info, CreditCard, Users2,
    ChevronDown, Trash2, Archive, Pencil,
    Building2, Square, AlertCircle
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type ProjectStatus = 'Active' | 'Archived';
type BudgetType = 'No budget' | 'Total hours' | 'Total amount' | 'Monthly hours' | 'Monthly amount';

interface Project {
    id: string;
    name: string;
    description: string;
    status: ProjectStatus;
    color: string;
    client_id?: string;
    client_name?: string;
    billable: boolean;
    disable_activity: boolean;
    allow_tracking: boolean;
    disable_idle_time: boolean;
    budget_type: BudgetType;
    budget_limit: number | null;
    budget_notifications: boolean;
    memberCount: number;
    teamCount: number;
    todoCount: number;
    memberIds: string[];
    teamIds: string[];
    created_at: string;
}

interface Client {
    id: string;
    name: string;
}

interface Member {
    id: string;
    full_name: string;
    email: string;
    role: string;
}

interface Team {
    id: string;
    name: string;
}

const API = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

// ─── Components ───────────────────────────────────────────────────────────────

export function Projects() {
    const { profile, session } = useAuth();
    const isViewer = profile?.role === 'Viewer';

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<ProjectStatus>('Active');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    // Modals
    const [showModal, setShowModal] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [modalInitialTab, setModalInitialTab] = useState<'GENERAL' | 'MEMBERS' | 'BUDGET & LIMITS' | 'TEAMS'>('GENERAL');

    useEffect(() => {
        fetchProjects();
    }, [activeTab]);

    async function fetchProjects() {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/projects?status=${activeTab}`, {
                headers: { 'Authorization': `Bearer ${session?.access_token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
            }
        } catch (err) {
            console.error('Fetch projects error:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    function toggleSelectAll() {
        if (selectedIds.size === filteredProjects.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredProjects.map(p => p.id)));
        }
    }

    function toggleSelect(id: string) {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
    }

    async function handleBulkArchive() {
        if (selectedIds.size === 0) return;
        const newStatus = activeTab === 'Active' ? 'Archived' : 'Active';
        setLoading(true);
        try {
            await Promise.all(Array.from(selectedIds).map(id =>
                fetch(`${API}/api/projects/${id}`, {
                    method: 'PUT',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ status: newStatus })
                })
            ));
            setSelectedIds(new Set());
            await fetchProjects();
        } catch (err) {
            console.error('Bulk archive error:', err);
            setLoading(false);
        }
    }

    return (
        <div className="flex flex-col h-full bg-[#f9fafb]">
            {/* Header */}
            <div className="px-8 py-6 bg-white border-b border-slate-200">
                <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>

                {/* Tabs */}
                <div className="flex gap-8 mt-6">
                    {(['Active', 'Archived'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
                            className={`pb-3 text-sm font-medium transition-all relative ${activeTab === tab ? 'text-blue-600' : 'text-slate-500 hover:text-slate-700'
                                }`}
                        >
                            {tab.toUpperCase()} ({projects.filter(p => p.status === tab).length || (activeTab === tab ? projects.length : 0)})
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-8 flex-1 overflow-auto">
                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search projects"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50"
                                onClick={() => { }}
                            >
                                <Filter className="w-4 h-4" /> Filters
                            </button>

                            <div className="h-4 w-px bg-slate-200 mx-1" />

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={selectedIds.size === 0 || isViewer}
                                    onClick={handleBulkArchive}
                                    className={`px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2 transition-colors shadow-sm disabled:opacity-50 group ${isViewer ? 'cursor-not-allowed grayscale opacity-70' : ''}`}
                                >
                                    <Archive className="w-4 h-4 group-hover:text-blue-500 transition-colors" />
                                    {activeTab === 'Active' ? 'Archive' : 'Restore'}
                                </button>
                                <span className="text-xs text-slate-400 font-medium ml-1">
                                    {selectedIds.size} / {filteredProjects.length} selected
                                </span>
                            </div>
                        </div>
                    </div>

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { if (!isViewer) { setEditingProject(null); setShowModal(true); } }}
                                disabled={isViewer}
                                className={`px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm shadow-blue-200 ${isViewer ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
                            >
                                <Plus className="w-4 h-4" /> Add project
                            </button>
                        </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-200">
                                <th className="pl-6 py-4 w-10">
                                    <button
                                        onClick={toggleSelectAll}
                                        className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${selectedIds.size === filteredProjects.length && filteredProjects.length > 0
                                            ? 'bg-blue-600 border-blue-600 text-white'
                                            : 'bg-white border-slate-300'
                                            }`}
                                    >
                                        {selectedIds.size === filteredProjects.length && filteredProjects.length > 0 && <Check className="w-3.5 h-3.5" />}
                                    </button>
                                </th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Name</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Teams</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">Members</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">To-dos</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget</th>
                                <th className="px-4 py-4 text-xs font-semibold text-slate-500 uppercase tracking-wider">Member limits</th>
                                <th className="pr-6 py-4 w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                            <span className="text-sm font-medium text-slate-500">Loading projects...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-20 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="p-4 bg-slate-50 rounded-full">
                                                <Square className="w-8 h-8 text-slate-300" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-slate-600">No projects found</p>
                                                <p className="text-sm">Try adjusting your search or filters</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredProjects.map(p => (
                                    <ProjectRow
                                        key={p.id}
                                        project={p}
                                        isSelected={selectedIds.has(p.id)}
                                        onSelect={() => toggleSelect(p.id)}
                                        onEdit={(tab) => { 
                                            setEditingProject(p); 
                                            setModalInitialTab(tab || 'GENERAL');
                                            setShowModal(true); 
                                        }}
                                        isViewer={isViewer}
                                        onRefresh={fetchProjects}
                                    />
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 text-xs text-slate-500 font-medium ml-1">
                    Showing {filteredProjects.length} of {projects.length} project{projects.length !== 1 ? 's' : ''}
                </div>
            </div>

            {/* Project Modal */}
            {showModal && (
                <ProjectModal
                    project={editingProject}
                    initialTab={modalInitialTab}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); fetchProjects(); }}
                />
            )}
        </div>
    );
}

// ─── Subcomponents ────────────────────────────────────────────────────────────

function ProjectRow({
    project, isSelected, onSelect, onEdit, onRefresh, isViewer
}: {
    project: Project; isSelected: boolean; onSelect: () => void; onEdit: (tab?: 'GENERAL' | 'MEMBERS' | 'BUDGET & LIMITS' | 'TEAMS') => void; onRefresh: () => void; isViewer: boolean
}) {
    const [showMenu, setShowMenu] = useState(false);

    async function handleArchive() {
        try {
            const newStatus = project.status === 'Active' ? 'Archived' : 'Active';
            await fetch(`${API}/api/projects/${project.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            onRefresh();
        } catch { }
    }

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
        try {
            await fetch(`${API}/api/projects/${project.id}`, {
                method: 'DELETE'
            });
            onRefresh();
        } catch { }
    }

    return (
        <tr className={`group border-b border-slate-100 hover:bg-blue-50/30 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
            <td className="pl-6 py-4">
                <button
                    onClick={onSelect}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-300 group-hover:border-blue-400'
                        }`}
                >
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-3">
                    <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 shadow-sm"
                        style={{ backgroundColor: `${project.color}20`, color: project.color }}
                    >
                        {project.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <button onClick={() => onEdit('GENERAL')} className="text-sm font-semibold text-slate-700 hover:text-blue-600 transition-colors truncate block max-w-[240px]">
                            {project.name}
                        </button>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            {project.client_name ? (
                                <span className="text-[10px] font-bold text-slate-400 uppercase flex items-center gap-1">
                                    <Building2 className="w-3 h-3" /> {project.client_name}
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-300 uppercase italic">No client</span>
                            )}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-4">
                <div className="flex -space-x-2 overflow-hidden">
                    {project.teamCount > 0 ? (
                        Array.from({ length: Math.min(3, project.teamCount) }).map((_, i) => (
                            <div key={i} className="inline-block h-7 w-7 rounded-full ring-2 ring-white bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                T
                            </div>
                        ))
                    ) : (
                        <span className="text-xs text-slate-400 italic">None <Pencil className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-100" /></span>
                    )}
                    {project.teamCount > 3 && (
                        <div className="inline-block h-7 w-7 rounded-full ring-2 ring-white bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600">
                            +{project.teamCount - 3}
                        </div>
                    )}
                </div>
            </td>
            <td className="px-4 py-4 text-center">
                <div className="flex items-center justify-center">
                    <div className="flex items-center gap-1 px-2.5 py-1 bg-slate-50 rounded-full border border-slate-100">
                        <Users2 className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-medium text-slate-600">{project.memberCount}</span>
                        <Pencil className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />
                    </div>
                </div>
            </td>
            <td className="px-4 py-4">
                {project.todoCount > 0 ? (
                    <span className="text-sm text-slate-600 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> {project.todoCount} To-dos
                    </span>
                ) : (
                    <span className="text-sm text-slate-400">No to-dos</span>
                )}
            </td>
            <td className="px-4 py-4">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-slate-700">Budget: {project.budget_type === 'No budget' ? 'none' : project.budget_type}</span>
                    {project.budget_limit && (
                        <span className="text-xs text-slate-400 mt-0.5">Limit: {project.budget_limit}</span>
                    )}
                        <button 
                            onClick={() => onEdit('BUDGET & LIMITS')}
                            disabled={isViewer}
                            className={`text-[10px] font-bold uppercase mt-1 opacity-0 group-hover:opacity-100 transition-opacity text-left ${isViewer ? 'text-slate-400 cursor-default' : 'text-blue-500 hover:text-blue-600'}`}
                        >
                            {isViewer ? 'View budget' : 'Edit budget'}
                        </button>
                </div>
            </td>
            <td className="px-4 py-4">
                <span className="text-sm text-slate-400 italic">None <Pencil className="w-3 h-3 inline-block ml-1 opacity-0 group-hover:opacity-100" /></span>
            </td>
            <td className="pr-6 py-4 text-right">
                <div className="relative inline-block text-left">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl z-20 py-1.5 overflow-hidden animate-in fade-in zoom-in duration-200">
                                <button onClick={() => { setShowMenu(false); onEdit('GENERAL'); }} className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-3">
                                    <Pencil className="w-4 h-4 text-slate-400" /> {isViewer ? 'View details' : 'Edit project'}
                                </button>
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); onEdit('MEMBERS'); } }} 
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <Users className="w-4 h-4 text-slate-400" /> Manage members
                                </button>
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); onEdit('BUDGET & LIMITS'); } }} 
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <CreditCard className="w-4 h-4 text-slate-400" /> Edit budget
                                </button>
                                <div className="h-px bg-slate-100 my-1" />
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); handleArchive(); } }} 
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-slate-600 hover:bg-slate-50'}`}
                                >
                                    <Archive className="w-4 h-4 text-slate-400" /> {project.status === 'Active' ? 'Archive' : 'Restore'} project
                                </button>
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); handleDelete(); } }} 
                                    className={`w-full px-4 py-2 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-red-600 hover:bg-red-50'}`}
                                >
                                    <Trash2 className="w-4 h-4 text-red-400" /> Delete project
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}

function ProjectModal({ project, initialTab = 'GENERAL', onClose, onSuccess }: { 
    project: Project | null; 
    initialTab?: 'GENERAL' | 'MEMBERS' | 'BUDGET & LIMITS' | 'TEAMS';
    onClose: () => void; 
    onSuccess: () => void 
}) {
    const { profile } = useAuth();
    const isViewer = profile?.role === 'Viewer';
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'MEMBERS' | 'BUDGET & LIMITS' | 'TEAMS'>(initialTab);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Form Stats
    const [name, setName] = useState(project?.name || '');
    const [desc] = useState(project?.description || ''); // Kept value, removed unused setter
    const [billable, setBillable] = useState(project?.billable ?? true);
    const [disableActivity, setDisableActivity] = useState(project?.disable_activity ?? false);
    const [allowTracking, setAllowTracking] = useState(project?.allow_tracking ?? true);
    const [disableIdle, setDisableIdle] = useState(project?.disable_idle_time ?? false);
    const [clientId, setClientId] = useState(project?.client_id || '');
    const [clients, setClients] = useState<Client[]>([]);

    // Associations
    const [members, setMembers] = useState<Member[]>([]);
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set(project?.memberIds || []));
    const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set(project?.teamIds || []));

    // Budget
    const [budgetType, setBudgetType] = useState<BudgetType>(project?.budget_type || 'No budget');
    const [budgetLimit, setBudgetLimit] = useState(project?.budget_limit?.toString() || '');
    const [budgetNotify, setBudgetNotify] = useState(project?.budget_notifications ?? true);

    useEffect(() => {
        fetchInitialData();
    }, []);

    async function fetchInitialData() {
        try {
            const [cRes, mRes, tRes] = await Promise.all([
                supabase.from('clients').select('id, name').eq('status', 'Active'),
                fetch(`${API}/api/members`),
                supabase.from('teams').select('id, name')
            ]);

            if (cRes.data) setClients(cRes.data);
            if (mRes.ok) setMembers(await mRes.json());
            if (tRes.data) setTeams(tRes.data);
        } catch { }
    }

    async function handleSave() {
        if (!name.trim()) { setError('Project name is required'); return; }
        setLoading(true);
        setError(null);

        const payload = {
            name: name.trim(),
            description: desc.trim(),
            client_id: clientId || null,
            billable,
            disable_activity: disableActivity,
            allow_tracking: allowTracking,
            disable_idle_time: disableIdle,
            budget_type: budgetType,
            budget_limit: budgetLimit ? parseFloat(budgetLimit) : null,
            budget_notifications: budgetNotify,
            member_ids: Array.from(selectedMemberIds),
            team_ids: Array.from(selectedTeamIds),
            organization_id: profile?.organization_id
        };

        try {
            const res = await fetch(`${API}/api/projects${project ? `/${project.id}` : ''}`, {
                method: project ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save project');
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    const modalTabs = ['GENERAL', 'MEMBERS', 'BUDGET & LIMITS', 'TEAMS'] as const;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl flex flex-col my-auto animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="px-8 pt-8 pb-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-slate-800">{project ? 'Edit project' : 'New project'}</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>

                    {/* Modal Tabs */}
                    <div className="flex gap-6 mt-8 border-b border-slate-100">
                        {modalTabs.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`pb-3 text-xs font-bold transition-colors relative ${activeTab === tab ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {tab}
                                {activeTab === tab && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 rounded-full" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Body */}
                <div className="px-8 py-6 max-h-[60vh] overflow-y-auto">
                    {activeTab === 'GENERAL' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                                    Project Names* <Info className="w-3 h-3" />
                                </label>
                                <textarea
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="Add project names separated by new lines"
                                    className="w-full h-24 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none"
                                />
                            </div>

                            <div className="space-y-4">
                                <ToggleItem label="Billable" active={billable} onToggle={() => setBillable(!billable)} />
                                <ToggleItem
                                    label="Disable activity"
                                    active={disableActivity}
                                    onToggle={() => setDisableActivity(!disableActivity)}
                                    icon={<Info className="w-3.5 h-3.5 text-slate-400" />}
                                />
                                <ToggleItem
                                    label="Allow project tracking"
                                    active={allowTracking}
                                    onToggle={() => setAllowTracking(!allowTracking)}
                                    icon={<Info className="w-3.5 h-3.5 text-slate-400" />}
                                />
                                <ToggleItem
                                    label="Disable idle time"
                                    active={disableIdle}
                                    onToggle={() => setDisableIdle(!disableIdle)}
                                    icon={<Info className="w-3.5 h-3.5 text-slate-400" />}
                                />
                            </div>

                            <div className="pt-4">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Client</label>
                                <div className="relative">
                                    <select
                                        value={clientId}
                                        onChange={e => setClientId(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    >
                                        <option value="">Select a client</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'MEMBERS' && (
                        <div className="space-y-3">
                            {members.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 text-sm">No members found.</p>
                            ) : (
                                members.map(m => {
                                    const isSelected = selectedMemberIds.has(m.id);
                                    return (
                                        <button
                                            key={m.id}
                                            onClick={() => {
                                                const next = new Set(selectedMemberIds);
                                                if (next.has(m.id)) next.delete(m.id);
                                                else next.add(m.id);
                                                setSelectedMemberIds(next);
                                            }}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                                                    {m.full_name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm font-semibold text-slate-700">{m.full_name}</p>
                                                    <p className="text-[10px] text-slate-400 font-medium">{m.email}</p>
                                                </div>
                                            </div>
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'
                                                }`}>
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {activeTab === 'BUDGET & LIMITS' && (
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Budget Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {(['No budget', 'Total hours', 'Total amount', 'Monthly hours', 'Monthly amount'] as BudgetType[]).map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setBudgetType(type)}
                                            className={`px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${budgetType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-100 bg-slate-50 text-slate-600'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {budgetType !== 'No budget' && (
                                <>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Limit</label>
                                        <input
                                            type="number"
                                            value={budgetLimit}
                                            onChange={e => setBudgetLimit(e.target.value)}
                                            placeholder="Enter limit"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                        />
                                    </div>
                                    <ToggleItem
                                        label="Enable notifications when limit reached"
                                        active={budgetNotify}
                                        onToggle={() => setBudgetNotify(!budgetNotify)}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'TEAMS' && (
                        <div className="space-y-3">
                            {teams.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 text-sm">No teams found.</p>
                            ) : (
                                teams.map(t => {
                                    const isSelected = selectedTeamIds.has(t.id);
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                const next = new Set(selectedTeamIds);
                                                if (next.has(t.id)) next.delete(t.id);
                                                else next.add(t.id);
                                                setSelectedTeamIds(next);
                                            }}
                                            className={`w-full flex items-center justify-between p-3 rounded-xl border transition-all ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-slate-200 bg-slate-50/50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3 text-left">
                                                <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center font-bold text-purple-600 text-xs">
                                                    {t.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                <p className="text-sm font-semibold text-slate-700">{t.name}</p>
                                            </div>
                                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-200 bg-white'
                                                }`}>
                                                {isSelected && <Check className="w-3.5 h-3.5" />}
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {error && (
                            <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium animate-in slide-in-from-left-2 duration-200">
                                <AlertCircle className="w-3.5 h-3.5" /> {error}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={loading || isViewer}
                            className={`px-8 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg flex items-center gap-2 ${isViewer ? 'bg-slate-400 cursor-not-allowed grayscale opacity-60' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200 disabled:opacity-50'}`}
                        >
                            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : null}
                            {isViewer ? 'Read-only' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ToggleItem({ label, active, onToggle, icon }: { label: string; active: boolean; onToggle: () => void; icon?: React.ReactNode }) {
    return (
        <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-600 flex items-center gap-1.5">
                {label} {icon}
            </span>
            <button
                onClick={onToggle}
                className={`w-10 h-5 rounded-full transition-colors relative ${active ? 'bg-blue-600' : 'bg-slate-200'}`}
            >
                <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${active ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
    );
}