import { useEffect, useState } from 'react';
import React from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Filter, MoreHorizontal,
    X, Check, Users, Info, CreditCard,
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
    member_limit: number | null;
    memberCount: number;
    teamCount: number;
    todoCount: number;
    memberIds: string[];
    teamIds: string[];
    created_at: string;
    tracked_seconds?: number; // Added for budget progress
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
                setProjects(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Fetch projects error:', err);
        } finally {
            setLoading(false);
        }
    }

    const filteredProjects = projects.filter(p =>
        (p.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.client_name || '').toLowerCase().includes(searchQuery.toLowerCase())
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
            <div className="p-8 flex-1 overflow-auto shell-scrollbar">
                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-6 mb-8">
                    <div className="flex items-center gap-4">
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-all duration-300" />
                            <input
                                type="text"
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm w-72 focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all shadow-sm group-hover:border-slate-300"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                className="px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50"
                                onClick={() => { }}
                            >
                                <Filter className="w-4 h-4 text-slate-400" /> Filters
                            </button>

                            <div className="h-6 w-px bg-slate-200 mx-1" />

                            <div className="flex items-center gap-2">
                                <button
                                    disabled={selectedIds.size === 0 || isViewer}
                                    onClick={handleBulkArchive}
                                    className={`px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 transition-all shadow-sm disabled:opacity-50 group ${isViewer ? 'cursor-not-allowed hidden' : ''}`}
                                >
                                    <Archive className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                                    {activeTab === 'Active' ? 'Archive Selected' : 'Restore Selected'}
                                </button>
                                {selectedIds.size > 0 && (
                                    <span className="text-xs text-blue-600 font-bold bg-blue-50 px-3 py-1.5 rounded-full animate-in fade-in slide-in-from-left-2 transition-all">
                                        {selectedIds.size} selected
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => { if (!isViewer) { setEditingProject(null); setShowModal(true); } }}
                            disabled={isViewer}
                            className={`px-6 py-2.5 bg-blue-600 text-white rounded-2xl text-sm font-bold hover:bg-blue-700 flex items-center gap-2 transition-all shadow-lg shadow-blue-200 active:scale-[0.98] ${isViewer ? 'hidden' : ''}`}
                        >
                            <Plus className="w-4 h-4 stroke-[3]" /> Add Project
                        </button>
                    </div>
                </div>

                {/* Table Container */}
                <div className="bg-white rounded-[24px] border border-slate-200/60 shadow-xl shadow-slate-200/40 overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-100">
                                <th className="pl-6 py-5 w-12">
                                    <button
                                        onClick={toggleSelectAll}
                                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedIds.size === filteredProjects.length && filteredProjects.length > 0
                                            ? 'bg-blue-600 border-blue-600 text-white shadow-sm'
                                            : 'bg-white border-slate-300 hover:border-blue-400'
                                            }`}
                                    >
                                        {selectedIds.size === filteredProjects.length && filteredProjects.length > 0 && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    </button>
                                </th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Project Name</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Teams</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] text-center">Members</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">To-dos</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Budget Status</th>
                                <th className="px-4 py-5 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Member Limit</th>
                                <th className="pr-6 py-5 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="py-32 text-center">
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="w-10 h-10 border-[3px] border-blue-600 border-t-transparent rounded-full animate-spin shadow-inner" />
                                            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Loading...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredProjects.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-32 text-center text-slate-400">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="p-8 bg-slate-50 rounded-[32px]">
                                                <Square className="w-12 h-12 text-slate-200" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-slate-800 text-lg">No projects found</p>
                                                <p className="text-sm text-slate-500 mt-1.5">Try adjusting your search query or filters</p>
                                            </div>
                                            <button 
                                                onClick={() => { setSearchQuery(''); setShowModal(true); }}
                                                className="text-blue-600 font-bold text-sm hover:underline"
                                            >
                                                Create your first project
                                            </button>
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

                <div className="mt-8 flex items-center justify-between px-2">
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                        Page 1 of 1 • {filteredProjects.length} total projects
                    </p>
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
    const { session } = useAuth();
    const [showMenu, setShowMenu] = useState(false);

    async function handleArchive() {
        try {
            const newStatus = project.status === 'Active' ? 'Archived' : 'Active';
            await fetch(`${API}/api/projects/${project.id}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ status: newStatus })
            });
            onRefresh();
        } catch { }
    }

    async function handleDelete() {
        if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) return;
        try {
            await fetch(`${API}/api/projects/${project.id}`, {
                method: 'DELETE',
                headers: { 
                    'Authorization': `Bearer ${session?.access_token}`
                }
            });
            onRefresh();
        } catch { }
    }

    // Budget Progress logic
    const limit = project.budget_limit || 0;
    const trackedHours = (project.tracked_seconds || 0) / 3600;
    const progress = limit > 0 ? Math.min(100, (trackedHours / limit) * 100) : 0;
    const isOverBudget = limit > 0 && trackedHours > limit;

    return (
        <tr className={`group border-b border-slate-100/80 hover:bg-blue-50/40 transition-all duration-200 ${isSelected ? 'bg-blue-50/60' : ''}`}>
            <td className="pl-6 py-5">
                <button
                    onClick={onSelect}
                    className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${isSelected 
                        ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-200' 
                        : 'bg-white border-slate-300 group-hover:border-blue-400'
                        }`}
                >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                </button>
            </td>
            <td className="px-4 py-5">
                <div className="flex items-center gap-4">
                    <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base shrink-0 shadow-sm border border-white/50"
                        style={{ 
                            background: `linear-gradient(135deg, ${project.color}15 0%, ${project.color}30 100%)`, 
                            color: project.color 
                        }}
                    >
                        {(project.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <button onClick={() => onEdit('GENERAL')} className="text-sm font-bold text-slate-800 hover:text-blue-600 transition-colors truncate block max-w-[280px]">
                            {project.name}
                        </button>
                        <div className="flex items-center gap-1.5 mt-1">
                            {project.client_name ? (
                                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded">
                                    <Building2 className="w-3 h-3 text-slate-400" /> {project.client_name}
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-slate-400 uppercase italic">No client</span>
                            )}
                            {project.billable && (
                                <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-50 px-1.5 py-0.5 rounded">Billable</span>
                            )}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-4 py-5">
                <div className="flex flex-wrap gap-1.5">
                    {project.teamCount > 0 ? (
                        <div className="flex items-center gap-1.5 bg-purple-50 px-2 py-1 rounded-lg border border-purple-100/50">
                            <Building2 className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs font-semibold text-purple-700">{project.teamCount} Team{project.teamCount !== 1 ? 's' : ''}</span>
                        </div>
                    ) : (
                        <span className="text-xs text-slate-400 italic">None</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-5 text-center">
                <div className="flex items-center justify-center">
                    <div className="flex items-center -space-x-2">
                        {project.memberCount > 0 ? (
                            <>
                                {Array.from({ length: Math.min(3, project.memberCount) }).map((_, i) => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600 shadow-sm overflow-hidden">
                                        <Users className="w-4 h-4 text-slate-400" />
                                    </div>
                                ))}
                                {project.memberCount > 3 && (
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-50 flex items-center justify-center text-[10px] font-bold text-blue-600 shadow-sm">
                                        +{project.memberCount - 3}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-8 h-8 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center">
                                <Plus className="w-3 h-3 text-slate-300" />
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-4 py-5">
                <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${project.todoCount > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                        <Check className="w-4 h-4" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-700 leading-none">{project.todoCount}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">To-dos</p>
                    </div>
                </div>
            </td>
            <td className="px-4 py-5">
                <div className="flex flex-col gap-1.5 min-w-[120px]">
                    <div className="flex justify-between items-end">
                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                            {(project.budget_type || 'No budget') === 'No budget' ? 'No budget' : (project.budget_type || '').replace('Total ', '')}
                        </span>
                        {project.budget_limit && (
                            <span className={`text-[10px] font-bold ${isOverBudget ? 'text-red-600' : 'text-slate-700'}`}>
                                {trackedHours.toFixed(1)} / {project.budget_limit}
                            </span>
                        )}
                    </div>
                    {project.budget_limit ? (
                        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                            <div 
                                className={`h-full transition-all duration-500 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]'}`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    ) : (
                        <span className="text-xs text-slate-400 italic">None set</span>
                    )}
                </div>
            </td>
            <td className="px-4 py-5">
                {project.member_limit ? (
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 bg-amber-50 rounded border border-amber-100 text-[10px] font-bold text-amber-600 uppercase">
                            Limit: {project.member_limit}
                        </div>
                    </div>
                ) : (
                    <span className="text-xs text-slate-400 italic">Unlimited</span>
                )}
            </td>
            <td className="pr-6 py-5 text-right">
                <div className="relative inline-block text-left">
                    <button
                        onClick={() => setShowMenu(!showMenu)}
                        className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors group-hover:text-slate-600"
                    >
                        <MoreHorizontal className="w-5 h-5" />
                    </button>

                    {showMenu && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                            <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-white border border-slate-200 shadow-2xl z-20 py-2 overflow-hidden animate-in fade-in zoom-in duration-200">
                                <button onClick={() => { setShowMenu(false); onEdit('GENERAL'); }} className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-3">
                                    <Pencil className="w-4 h-4 text-slate-400" /> {isViewer ? 'View details' : 'Edit project'}
                                </button>
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); onEdit('MEMBERS'); } }} 
                                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <Users className="w-4 h-4 text-slate-400" /> Manage members
                                </button>
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); onEdit('BUDGET & LIMITS'); } }} 
                                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <CreditCard className="w-4 h-4 text-slate-400" /> Edit budget
                                </button>
                                <div className="h-px bg-slate-100 my-1.5 mx-2" />
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); handleArchive(); } }} 
                                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <Archive className="w-4 h-4 text-slate-400" /> {project.status === 'Active' ? 'Archive' : 'Restore'} project
                                </button>
                                <button 
                                    onClick={() => { if (!isViewer) { setShowMenu(false); handleDelete(); } }} 
                                    className={`w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 ${isViewer ? 'text-slate-400 cursor-not-allowed grayscale opacity-70' : 'text-red-600 hover:bg-red-50'}`}
                                >
                                    <Trash2 className="w-4 h-4 text-red-500" /> Delete project
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </td>
        </tr>
    );
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function ToggleItem({ label, active, onToggle, hint }: { label: string; active: boolean; onToggle: () => void; hint?: string }) {
    return (
        <div className="flex items-center justify-between py-2.5 px-1">
            <div>
                <span className="text-sm font-semibold text-slate-800">{label}</span>
                {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
            </div>
            <button type="button" onClick={onToggle}
                className={`relative w-11 h-6 rounded-full transition-all duration-300 focus:outline-none ${active ? 'bg-blue-600 shadow-inner shadow-blue-900/20' : 'bg-slate-200'}`}>
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300 ${active ? 'left-6' : 'left-1'}`} />
            </button>
        </div>
    );
}

function MemberPicker({ label, description, members, selectedIds, onToggle, memberSearch, color }: {
    label: string; description: string; members: Member[]; selectedIds: Set<string>;
    onToggle: (id: string) => void; memberSearch: string; color: string;
}) {
    const filtered = members.filter(m =>
        m.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
    );
    return (
        <div className="space-y-1.5">
            <div>
                <p className={`text-xs font-bold uppercase tracking-wider ${color}`}>{label}</p>
                <p className="text-[11px] text-slate-400">{description}</p>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
                {filtered.length === 0 ? (
                    <p className="text-center py-4 text-slate-400 text-xs italic">No members available</p>
                ) : (
                    <div className="divide-y divide-slate-100 max-h-[140px] overflow-y-auto">
                        {filtered.map(m => {
                            const isSelected = selectedIds.has(m.id);
                            const initials = m.full_name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                            return (
                                <button type="button" key={m.id} onClick={() => onToggle(m.id)}
                                    className={`w-full flex items-center justify-between px-4 py-2.5 transition-all ${isSelected ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'}`}>{initials}</div>
                                        <div className="text-left">
                                            <p className="text-xs font-semibold text-slate-800 leading-tight">{m.full_name}</p>
                                            <p className="text-[10px] text-slate-400">{m.email}</p>
                                        </div>
                                    </div>
                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                        {isSelected && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

function ProjectModal({ project, initialTab = 'GENERAL', onClose, onSuccess }: {
    project: Project | null;
    initialTab?: 'GENERAL' | 'MEMBERS' | 'BUDGET & LIMITS' | 'TEAMS';
    onClose: () => void;
    onSuccess: () => void;
}) {
    const { profile } = useAuth();
    const isViewer = profile?.role === 'Viewer';
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'MEMBERS' | 'BUDGET & LIMITS' | 'TEAMS'>(initialTab);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [name, setName] = useState(project?.name || '');
    const [color, setColor] = useState(project?.color || '#3b82f6');
    const [billable, setBillable] = useState(project?.billable ?? true);
    const [disableActivity, setDisableActivity] = useState(project?.disable_activity ?? false);
    const [allowTracking, setAllowTracking] = useState(project?.allow_tracking ?? true);
    const [disableIdle, setDisableIdle] = useState(project?.disable_idle_time ?? false);
    const [clientId, setClientId] = useState(project?.client_id || '');
    const [clients, setClients] = useState<Client[]>([]);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [managerIds, setManagerIds] = useState<Set<string>>(new Set());
    const [userIds, setUserIds] = useState<Set<string>>(new Set(project?.memberIds || []));
    const [viewerIds, setViewerIds] = useState<Set<string>>(new Set());
    const [memberSearch, setMemberSearch] = useState('');
    const [teams, setTeams] = useState<Team[]>([]);
    const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set(project?.teamIds || []));
    const [teamSearch, setTeamSearch] = useState('');
    const [budgetSubTab, setBudgetSubTab] = useState<'project' | 'member'>('project');
    const [budgetType, setBudgetType] = useState<BudgetType>(project?.budget_type || 'No budget');
    const [basedOn, setBasedOn] = useState('Pay rate');
    const [budgetCost, setBudgetCost] = useState(project?.budget_limit?.toString() || '');
    const [budgetNotify, setBudgetNotify] = useState(project?.budget_notifications ?? false);
    const [notifyAt, setNotifyAt] = useState('');
    const [notifyWho, setNotifyWho] = useState('Project members');
    const [stopTimers, setStopTimers] = useState(false);
    const [stopAt, setStopAt] = useState('');
    const [resets, setResets] = useState('Never');
    const [startDate, setStartDate] = useState('');
    const [includeNonBillable, setIncludeNonBillable] = useState(true);
    const [memberLimit, setMemberLimit] = useState(project?.member_limit?.toString() || '');

    const COLORS = ['#3b82f6','#8b5cf6','#ec4899','#f97316','#10b981','#14b8a6','#f59e0b','#ef4444','#6366f1','#84cc16'];

    useEffect(() => {
        async function load() {
            const [cRes, mRes, tRes] = await Promise.all([
                supabase.from('clients').select('id, name').eq('status', 'Active'),
                supabase.from('members').select('id, full_name, email, role').in('status', ['Active','Pending']),
                supabase.from('teams').select('id, name'),
            ]);
            if (cRes.data) setClients(cRes.data);
            if (mRes.data) setAllMembers(mRes.data as Member[]);
            if (tRes.data) setTeams(tRes.data);
        }
        load();
    }, []);

    function toggleId(set: Set<string>, setFn: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) {
        const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); setFn(next);
    }

    async function handleSave() {
        if (!name.trim()) { setError('Project name is required'); return; }
        setLoading(true); setError(null);
        try {
            const allMemberIds = [...new Set([...managerIds, ...userIds, ...viewerIds])];
            const payload = {
                name: name.trim(), color, client_id: clientId || null, billable,
                disable_activity: disableActivity, allow_tracking: allowTracking, disable_idle_time: disableIdle,
                budget_type: budgetType, budget_limit: budgetCost ? parseFloat(budgetCost) : null,
                budget_notifications: budgetNotify, member_limit: memberLimit ? parseInt(memberLimit) : null,
                organization_id: profile?.organization_id ?? null, status: 'Active',
            };
            let projectId = project?.id;
            if (project) {
                const { error: e } = await supabase.from('projects').update(payload).eq('id', project.id);
                if (e) throw new Error(e.message);
            } else {
                const { data, error: e } = await supabase.from('projects').insert(payload).select('id').single();
                if (e) throw new Error(e.message);
                projectId = data?.id;
            }
            if (projectId) {
                await supabase.from('project_members').delete().eq('project_id', projectId);
                if (allMemberIds.length > 0)
                    await supabase.from('project_members').insert(allMemberIds.map(mid => ({ project_id: projectId, member_id: mid })));
                await supabase.from('project_teams').delete().eq('project_id', projectId);
                if (selectedTeamIds.size > 0)
                    await supabase.from('project_teams').insert(Array.from(selectedTeamIds).map(tid => ({ project_id: projectId, team_id: tid })));
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message);
        } finally { setLoading(false); }
    }

    const managers = allMembers.filter(m => m.role === 'Manager' || m.role === 'Admin');
    const users    = allMembers.filter(m => m.role === 'User');
    const viewers  = allMembers.filter(m => m.role === 'Viewer');
    const filteredTeams = teams.filter(t => t.name.toLowerCase().includes(teamSearch.toLowerCase()));
    const modalTabs = ['GENERAL', 'MEMBERS', 'BUDGET & LIMITS', 'TEAMS'] as const;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto"
            style={{ background: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(8px)' }}>
            <div className="bg-white rounded-3xl w-full max-w-[560px] shadow-2xl flex flex-col my-auto border border-slate-200/60 overflow-hidden"
                style={{ animation: 'modalIn 0.2s ease-out' }}>
                <style>{`@keyframes modalIn{from{opacity:0;transform:scale(0.96) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}`}</style>

                <div className="px-7 pt-6 pb-0 bg-gradient-to-br from-slate-50 to-white">
                    <div className="flex items-start justify-between mb-5">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/60 shadow"
                                style={{ background: `linear-gradient(135deg,${color}25 0%,${color}45 100%)`, color }}>
                                <span className="font-black text-base">{(name || 'P').charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 leading-tight">{project ? 'Edit project' : 'New project'}</h2>
                                <p className="text-[11px] text-slate-400">Fill in the details to {project ? 'update' : 'create'} this project</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-0.5">
                        {modalTabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2.5 text-[10px] font-bold tracking-wide relative transition-all rounded-t-lg ${activeTab === tab ? 'text-blue-600 bg-white shadow-sm border-t border-l border-r border-slate-200/70' : 'text-slate-400 hover:text-slate-600 hover:bg-white/60'}`}>
                                {tab}
                                {activeTab === tab && <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-blue-600 rounded-t" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-7 py-5 max-h-[58vh] overflow-y-auto">
                    {activeTab === 'GENERAL' && (
                        <div className="space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Project Name *</label>
                                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Website Redesign"
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-300" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Project Color</label>
                                <div className="flex gap-2 flex-wrap">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setColor(c)}
                                            className={`w-7 h-7 rounded-full shadow-sm transition-all ${color===c ? 'ring-2 ring-offset-2 scale-110 shadow-md':'hover:scale-110'}`}
                                            style={{ background: c }} />
                                    ))}
                                </div>
                            </div>
                            <div className="bg-slate-50/80 rounded-2xl px-4 py-1 border border-slate-100 divide-y divide-slate-100">
                                <ToggleItem label="Billable" active={billable} onToggle={() => setBillable(!billable)} />
                                <ToggleItem label="Disable activity" active={disableActivity} onToggle={() => setDisableActivity(!disableActivity)} hint="Disables keyboard + mouse activity tracking" />
                                <ToggleItem label="Allow project tracking" active={allowTracking} onToggle={() => setAllowTracking(!allowTracking)} hint="Members can log time to this project" />
                                <ToggleItem label="Disable idle time" active={disableIdle} onToggle={() => setDisableIdle(!disableIdle)} hint="Idle time will not be tracked" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Client</label>
                                <div className="relative">
                                    <select value={clientId} onChange={e => setClientId(e.target.value)}
                                        className="w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-xl text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-700 font-medium">
                                        <option value="">Select a client</option>
                                        {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'MEMBERS' && (
                        <div className="space-y-5">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search members…"
                                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                            </div>
                            <MemberPicker label="Managers" description="Oversees and manages the project" color="text-purple-600"
                                members={managers} selectedIds={managerIds} onToggle={id => toggleId(managerIds, setManagerIds, id)} memberSearch={memberSearch} />
                            <MemberPicker label="Users" description="Works on the project (most common)" color="text-blue-600"
                                members={users} selectedIds={userIds} onToggle={id => toggleId(userIds, setUserIds, id)} memberSearch={memberSearch} />
                            <MemberPicker label="Viewers" description="Can view team reports for this project" color="text-emerald-600"
                                members={viewers} selectedIds={viewerIds} onToggle={id => toggleId(viewerIds, setViewerIds, id)} memberSearch={memberSearch} />
                        </div>
                    )}

                    {activeTab === 'BUDGET & LIMITS' && (
                        <div className="space-y-5">
                            <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                                {(['project','member'] as const).map(s => (
                                    <button key={s} onClick={() => setBudgetSubTab(s)}
                                        className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${budgetSubTab===s?'bg-white text-slate-800 shadow-sm':'text-slate-400 hover:text-slate-600'}`}>
                                        {s === 'project' ? 'Project budget' : 'Member limits'}
                                    </button>
                                ))}
                            </div>
                            {budgetSubTab === 'project' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Type *</label>
                                            <div className="relative">
                                                <select value={budgetType} onChange={e => setBudgetType(e.target.value as BudgetType)}
                                                    className="w-full pl-3 pr-7 py-2.5 bg-white border border-slate-200 rounded-xl text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700">
                                                    {['No budget','Total hours','Total amount','Monthly hours','Monthly amount'].map(t => <option key={t}>{t}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Based On *</label>
                                            <div className="relative">
                                                <select value={basedOn} onChange={e => setBasedOn(e.target.value)}
                                                    className="w-full pl-3 pr-7 py-2.5 bg-white border border-slate-200 rounded-xl text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700">
                                                    {['Pay rate','Bill rate','Custom'].map(r => <option key={r}>{r}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Cost *</label>
                                            <div className="flex border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20">
                                                <span className="px-2.5 py-2.5 bg-slate-50 text-xs font-bold text-slate-500 border-r border-slate-200">$</span>
                                                <input type="number" value={budgetCost} onChange={e => setBudgetCost(e.target.value)} placeholder="0.0" className="flex-1 px-2.5 py-2.5 text-sm focus:outline-none" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl px-4 py-1 border border-slate-100 divide-y divide-slate-100">
                                        <ToggleItem label="Notify project members" active={budgetNotify} onToggle={() => setBudgetNotify(!budgetNotify)} />
                                    </div>
                                    {budgetNotify && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notify At</label>
                                                <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                                                    <input type="number" value={notifyAt} onChange={e => setNotifyAt(e.target.value)} placeholder="80" className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
                                                    <span className="px-2.5 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-400 border-l border-slate-200">% of budget</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Who to Notify</label>
                                                <div className="relative">
                                                    <select value={notifyWho} onChange={e => setNotifyWho(e.target.value)}
                                                        className="w-full pl-3 pr-7 py-2.5 bg-white border border-slate-200 rounded-xl text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700">
                                                        {['Project members','Managers only','Admins only'].map(t => <option key={t}>{t}</option>)}
                                                    </select>
                                                    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="bg-slate-50 rounded-2xl px-4 py-1 border border-slate-100 divide-y divide-slate-100">
                                        <ToggleItem label="Stop timers when budget is reached" active={stopTimers} onToggle={() => setStopTimers(!stopTimers)} />
                                    </div>
                                    {stopTimers && (
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Stop Timers At</label>
                                            <div className="flex border border-slate-200 rounded-xl overflow-hidden">
                                                <input type="number" value={stopAt} onChange={e => setStopAt(e.target.value)} placeholder="100" className="flex-1 px-3 py-2.5 text-sm focus:outline-none" />
                                                <span className="px-3 py-2.5 bg-slate-50 text-[10px] font-bold text-slate-400 border-l border-slate-200">% of budget</span>
                                            </div>
                                        </div>
                                    )}
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Resets *</label>
                                            <div className="relative">
                                                <select value={resets} onChange={e => setResets(e.target.value)}
                                                    className="w-full pl-3 pr-7 py-2.5 bg-white border border-slate-200 rounded-xl text-xs appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700">
                                                    {['Never','Weekly','Monthly','Yearly'].map(r => <option key={r}>{r}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Start Date</label>
                                            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                                className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700 transition-all" />
                                        </div>
                                    </div>
                                    <div className="bg-slate-50 rounded-2xl px-4 py-1 border border-slate-100 divide-y divide-slate-100">
                                        <ToggleItem label="Include non-billable time" active={includeNonBillable} onToggle={() => setIncludeNonBillable(!includeNonBillable)} />
                                    </div>
                                </div>
                            )}
                            {budgetSubTab === 'member' && (
                                <div className="space-y-4">
                                    <p className="text-xs text-slate-500 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">Set a weekly hour limit that applies to all members on this project.</p>
                                    <div>
                                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Weekly Hour Limit per Member</label>
                                        <input type="number" value={memberLimit} onChange={e => setMemberLimit(e.target.value)} placeholder="Leave empty for unlimited"
                                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'TEAMS' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                                    <input value={teamSearch} onChange={e => setTeamSearch(e.target.value)} placeholder="Search teams…"
                                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" />
                                </div>
                                {filteredTeams.length > 0 && (
                                    <button onClick={() => setSelectedTeamIds(selectedTeamIds.size===filteredTeams.length ? new Set() : new Set(filteredTeams.map(t => t.id)))}
                                        className="text-xs font-bold text-blue-600 hover:underline whitespace-nowrap">
                                        {selectedTeamIds.size===filteredTeams.length ? 'Deselect all' : 'Select all'}
                                    </button>
                                )}
                            </div>
                            {filteredTeams.length === 0 ? (
                                <p className="text-center py-10 text-slate-400 text-xs italic">No teams found</p>
                            ) : (
                                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                    {filteredTeams.map(t => {
                                        const isSel = selectedTeamIds.has(t.id);
                                        return (
                                            <button key={t.id} onClick={() => toggleId(selectedTeamIds, setSelectedTeamIds, t.id)}
                                                className={`w-full flex items-center justify-between px-5 py-3.5 transition-all ${isSel ? 'bg-blue-50' : 'bg-white hover:bg-slate-50'}`}>
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-[11px] ${isSel ? 'bg-blue-600 text-white' : 'bg-purple-100 text-purple-700'}`}>
                                                        {t.name.slice(0,2).toUpperCase()}
                                                    </div>
                                                    <span className="text-sm font-semibold text-slate-800">{t.name}</span>
                                                </div>
                                                <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${isSel ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`}>
                                                    {isSel && <Check className="w-2.5 h-2.5 text-white stroke-[3]" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-7 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                        {error && (
                            <div className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" /><span className="truncate">{error}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 shrink-0">
                        <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500 hover:bg-white hover:border-slate-300 transition-all">Cancel</button>
                        <button onClick={handleSave} disabled={loading || isViewer}
                            className={`px-7 py-2.5 rounded-xl text-white text-sm font-bold transition-all shadow-lg flex items-center gap-2 ${isViewer ? 'bg-slate-400 cursor-not-allowed opacity-60' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-200/60 disabled:opacity-50 active:scale-[0.98]'}`}>
                            {loading && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                            {isViewer ? 'Read-only' : loading ? 'Saving…' : 'Save'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Projects;
