import { useEffect, useState, useRef } from 'react';
import React from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import {
    Search, Plus, Filter, MoreHorizontal,
    X, Check, Users, CreditCard,
    ChevronDown, Trash2, Archive, Pencil,
    Building2, AlertCircle
} from 'lucide-react';
import clsx from 'clsx';

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
        <div className="flex flex-col h-full bg-transparent">
            {/* Header */}
            <div className="px-10 py-10 border-b border-black/[0.03] bg-white/[0.01]">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-text-primary tracking-tighter leading-none">Projects</h1>
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.3em] mt-2 font-mono">Manage active projects and resource allocation</p>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-12 mt-10">
                    {(['Active', 'Archived'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => { setActiveTab(tab); setSelectedIds(new Set()); }}
                            className={clsx(
                                "pb-5 text-[11px] font-bold uppercase tracking-[0.2em] transition-all relative font-mono",
                                activeTab === tab ? "text-text-primary" : "text-text-muted hover:text-text-primary"
                            )}
                        >
                            {tab.toUpperCase()} PROJECTS ({projects.filter(p => p.status === tab).length || (activeTab === tab ? projects.length : 0)})
                            {activeTab === tab && (
                                <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full shadow-[0_0_12px_rgba(80,110,248,0.4)]" />
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Section */}
            <div className="p-10 flex-1 overflow-auto custom-scrollbar">
                {/* Action Bar */}
                <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-6 mb-10">
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-5 w-full lg:w-auto">
                        <div className="relative group lg:w-[400px]">
                            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-all duration-300" strokeWidth={2.5} />
                            <input
                                type="text"
                                placeholder="Search projects by name or client..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-12 pr-6 py-3.5 bg-black/[0.02] border border-black/[0.05] rounded-2xl text-[13px] font-bold text-text-primary placeholder:text-text-muted outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/30 transition-all shadow-sm font-mono"
                            />
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                className="px-6 py-3.5 bg-white border border-black/[0.05] rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] text-text-primary hover:bg-black/[0.02] flex items-center gap-3.5 transition-all shadow-sm active:scale-95 disabled:opacity-30 font-mono"
                                onClick={() => { }}
                            >
                                <Filter className="w-4 h-4 text-primary" strokeWidth={3} /> FILTERS
                            </button>

                            <div className="h-10 w-px bg-black/[0.03] mx-1" />

                            <div className="flex items-center gap-4">
                                <button
                                    disabled={selectedIds.size === 0 || isViewer}
                                    onClick={handleBulkArchive}
                                    className={clsx(
                                        "px-6 py-3.5 bg-white border border-black/[0.05] rounded-2xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-sm active:scale-95 group font-mono",
                                        (selectedIds.size === 0 || isViewer) ? "opacity-30 cursor-not-allowed text-text-muted" : "text-text-primary hover:bg-black/[0.02]"
                                    )}
                                >
                                    <Archive className="w-4 h-4 text-primary group-hover:scale-110 transition-transform inline-block mr-2" strokeWidth={2.5} />
                                    {activeTab === 'Active' ? 'ARCHIVE SELECTED' : 'RESTORE SELECTED'}
                                </button>
                                {selectedIds.size > 0 && (
                                    <span className="text-[10px] font-bold text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10 uppercase tracking-[0.2em] animate-in fade-in slide-in-from-left-2 transition-all font-mono">
                                        {selectedIds.size} SELECTED
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => { if (!isViewer) { setEditingProject(null); setShowModal(true); } }}
                            disabled={isViewer}
                            className={clsx(
                                "px-10 py-3.5 rounded-[20px] text-[10px] font-bold uppercase tracking-[0.3em] transition-all shadow-lg font-mono flex items-center gap-3",
                                isViewer ? "bg-black/5 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/20 hover:scale-[1.02] active:scale-95"
                            )}
                        >
                            <Plus className="w-5 h-5 stroke-[4]" /> CREATE PROJECT
                        </button>
                    </div>
                </div>

                {/* Table Container */}
                <div className="glass rounded-[40px] border border-black/[0.05] shadow-xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-black/[0.03] bg-black/[0.01]">
                                    <th className="pl-10 py-7 w-12">
                                        <button
                                            onClick={toggleSelectAll}
                                            className={clsx(
                                                "w-6 h-6 rounded-lg border flex items-center justify-center transition-all shadow-sm",
                                                selectedIds.size === filteredProjects.length && filteredProjects.length > 0
                                                    ? "bg-primary border-primary text-white shadow-primary/20"
                                                    : "bg-white border-black/[0.1] hover:border-primary"
                                            )}
                                        >
                                            {selectedIds.size === filteredProjects.length && filteredProjects.length > 0 && <Check className="w-4 h-4 stroke-[4]" />}
                                        </button>
                                    </th>
                                    <th className="px-8 py-7 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Project Name</th>
                                    <th className="px-8 py-7 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Teams</th>
                                    <th className="px-8 py-7 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono text-center">Members</th>
                                    <th className="px-8 py-7 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Tasks</th>
                                    <th className="px-8 py-7 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Budget</th>
                                    <th className="px-8 py-7 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Member Limits</th>
                                    <th className="pr-10 py-7 w-20"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-black/[0.03]">
                                {loading ? (
                                    <tr>
                                        <td colSpan={8} className="py-40 text-center">
                                            <div className="flex flex-col items-center gap-5">
                                                <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                                                <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] animate-pulse">Loading...</span>
                                            </div>
                                        </td>
                                    </tr>
                                ) : filteredProjects.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="py-56 text-center">
                                            <div className="flex flex-col items-center gap-10 opacity-60">
                                                <div className="p-12 bg-black/[0.02] border border-black/[0.05] rounded-[48px] shadow-inner">
                                                    <AlertCircle className="w-16 h-16 text-primary" strokeWidth={1} />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-text-primary text-2xl tracking-tighter">No projects found</p>
                                                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.4em] mt-3 font-mono">You haven't created any projects yet.</p>
                                                </div>
                                                <button 
                                                    onClick={() => { setSearchQuery(''); setShowModal(true); }}
                                                    className="text-primary font-bold text-xs uppercase tracking-[0.3em] hover:text-primary/70 transition-colors font-mono"
                                                >
                                                    CREATE PROJECT
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
                </div>

                <div className="mt-10 flex items-center justify-between px-6">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">
                        {filteredProjects.length} PROJECT{filteredProjects.length !== 1 ? 'S' : ''} FOUND
                    </p>
                    <div className="flex items-center gap-4">
                        <button className="px-6 py-2.5 glass border border-black/[0.05] rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] opacity-30 cursor-not-allowed font-mono">SECTOR ARC 1</button>
                    </div>
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
    const dropRef = useRef<HTMLTableCellElement>(null);

    useEffect(() => {
        function h(e: MouseEvent) { if (dropRef.current && !dropRef.current.contains(e.target as Node)) setShowMenu(false); }
        document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
    }, []);

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
        <tr className={clsx(
            "group/row border-b border-black/[0.02] transition-all duration-300",
            isSelected ? "bg-primary/[0.02]" : "hover:bg-black/[0.01]"
        )}>
            <td className="pl-10 py-8">
                <button
                    onClick={onSelect}
                    className={clsx(
                        "w-6 h-6 rounded-lg border flex items-center justify-center transition-all shadow-sm",
                        isSelected 
                            ? "bg-primary border-primary text-white shadow-primary/20" 
                            : "bg-white border-black/[0.1] group-hover/row:border-primary cursor-pointer"
                    )}
                >
                    {isSelected && <Check className="w-4 h-4 stroke-[4]" />}
                </button>
            </td>
            <td className="px-8 py-8">
                <div className="flex items-center gap-6">
                    <div
                        className="w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-xl shrink-0 shadow-lg border border-black/[0.05] group-hover/row:scale-110 transition-transform duration-500 font-mono"
                        style={{ 
                            background: `linear-gradient(135deg, ${project.color}15 0%, ${project.color}35 100%)`, 
                            color: project.color,
                            boxShadow: `0 10px 20px -5px ${project.color}20`
                        }}
                    >
                        {(project.name || 'P').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                        <button onClick={() => onEdit('GENERAL')} className="text-base font-bold text-text-primary hover:text-primary transition-colors truncate block max-w-[350px] tracking-tight leading-none mb-2">
                            {project.name}
                        </button>
                        <div className="flex items-center gap-3 mt-1">
                            {project.client_name ? (
                                <span className="text-[10px] font-bold text-text-muted uppercase flex items-center gap-2 bg-black/[0.03] px-3 py-1 rounded-lg border border-black/[0.05] font-mono">
                                    <Building2 className="w-3.5 h-3.5 text-primary" strokeWidth={2.5} /> {project.client_name}
                                </span>
                            ) : (
                                <span className="text-[10px] font-bold text-text-muted/40 uppercase italic tracking-[0.2em] font-mono">NO CLIENT</span>
                            )}
                            {project.billable && (
                                <span className="text-[10px] font-bold text-emerald-600 uppercase bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 tracking-[0.2em] font-mono">BILLABLE</span>
                            )}
                        </div>
                    </div>
                </div>
            </td>
            <td className="px-8 py-8 font-mono">
                <div className="flex flex-wrap gap-3">
                    {project.teamCount > 0 ? (
                        <div className="flex items-center gap-3 bg-primary/5 px-4 py-1.5 rounded-xl border border-primary/10 shadow-sm">
                            <Building2 className="w-4 h-4 text-primary" strokeWidth={2.5} />
                            <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">{project.teamCount} TEAMS</span>
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-text-muted/30 uppercase italic tracking-[0.3em]">STANDALONE</span>
                    )}
                </div>
            </td>
            <td className="px-8 py-8 text-center">
                <div className="flex items-center justify-center">
                    <div className="flex items-center -space-x-4">
                        {project.memberCount > 0 ? (
                            <>
                                {Array.from({ length: Math.min(3, project.memberCount) }).map((_, i) => (
                                    <div key={i} className="w-10 h-10 rounded-2xl border-[3px] border-white bg-primary/5 flex items-center justify-center text-[11px] font-bold text-primary shadow-md group-hover/row:translate-y-[-4px] transition-transform duration-300 font-mono">
                                        <Users className="w-5 h-5" strokeWidth={2.5} />
                                    </div>
                                ))}
                                {project.memberCount > 3 && (
                                    <div className="w-10 h-10 rounded-2xl border-[3px] border-white bg-primary flex items-center justify-center text-[10px] font-bold text-white shadow-lg shadow-primary/20 scale-110 font-mono">
                                        +{project.memberCount - 3}
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="w-10 h-10 rounded-2xl border-2 border-dashed border-black/[0.1] flex items-center justify-center group-hover/row:border-primary/50 transition-colors">
                                <Plus className="w-5 h-5 text-text-muted/40 group-hover/row:text-primary" strokeWidth={3} />
                            </div>
                        )}
                    </div>
                </div>
            </td>
            <td className="px-8 py-8 font-mono">
                <div className="flex items-center gap-4">
                    <div className={clsx(
                        "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm transition-all",
                        project.todoCount > 0 ? "bg-primary/10 text-primary border border-primary/20" : "bg-black/[0.03] text-text-muted/30 border border-black/[0.05]"
                    )}>
                        <Check className="w-5 h-5" strokeWidth={3} />
                    </div>
                    <div>
                        <p className="text-base font-bold text-text-primary leading-none mb-1">{project.todoCount}</p>
                        <p className="text-[9px] font-bold text-text-muted uppercase tracking-[0.2em]">TASKS</p>
                    </div>
                </div>
            </td>
            <td className="px-8 py-8 font-mono">
                <div className="flex flex-col gap-3.5 min-w-[160px]">
                    <div className="flex justify-between items-end">
                        <span className="text-[9px] font-bold text-text-muted uppercase tracking-[0.2em] font-mono">
                            {(project.budget_type || 'No budget') === 'No budget' ? 'NO BUDGET' : (project.budget_type || '').replace('Total ', '').toUpperCase()}
                        </span>
                        {project.budget_limit && (
                            <span className={clsx(
                                "text-[11px] font-bold",
                                isOverBudget ? "text-rose-500" : "text-text-primary"
                            )}>
                                {trackedHours.toFixed(1)} <span className="text-text-muted opacity-50">/</span> {project.budget_limit}H
                            </span>
                        )}
                    </div>
                    {project.budget_limit ? (
                        <div className="w-full h-2 bg-black/[0.03] rounded-full overflow-hidden p-[1px] shadow-inner">
                            <div 
                                className={clsx(
                                    "h-full transition-all duration-[1500ms] ease-out rounded-full shadow-sm",
                                    isOverBudget ? "bg-rose-500" : "bg-primary"
                                )}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-text-muted/30 uppercase italic tracking-[0.2em] font-mono">NO BUDGET LIMIT</span>
                    )}
                </div>
            </td>
            <td className="px-8 py-8 font-mono">
                {project.member_limit ? (
                    <div className="flex items-center gap-2">
                        <div className="px-4 py-1.5 bg-amber-500/5 rounded-xl border border-amber-500/10 text-[10px] font-bold text-amber-600 uppercase tracking-[0.2em] shadow-sm">
                            MAX: {project.member_limit}
                        </div>
                    </div>
                ) : (
                    <span className="text-[10px] font-bold text-text-muted/30 uppercase italic tracking-[0.3em] font-mono">NO LIMIT</span>
                )}
            </td>
            <td className="pr-10 py-8 text-right relative" ref={dropRef}>
                <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="p-3.5 bg-white/50 border border-black/[0.05] rounded-[18px] text-text-muted hover:text-text-primary transition-all shadow-sm active:scale-90 group-hover/row:border-primary/20"
                >
                    <MoreHorizontal className="w-6 h-6" strokeWidth={2.5} />
                </button>

                {showMenu && (
                    <div className="absolute right-10 top-20 w-64 bg-white/95 backdrop-blur-3xl border border-black/[0.08] shadow-2xl z-20 py-3 rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <button onClick={() => { setShowMenu(false); onEdit('GENERAL'); }} className="w-full px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted hover:text-text-primary hover:bg-black/[0.02] flex items-center gap-4 transition-colors font-mono">
                            <Pencil className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} /> {isViewer ? 'VIEW DETAILS' : 'EDIT PROJECT'}
                        </button>
                        <button 
                            onClick={() => { if (!isViewer) { setShowMenu(false); onEdit('MEMBERS'); } }} 
                            className={clsx(
                                "w-full px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-4 transition-colors font-mono",
                                isViewer ? "opacity-30 cursor-not-allowed" : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                            )}
                        >
                            <Users className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} /> MEMBERS
                        </button>
                        <button 
                            onClick={() => { if (!isViewer) { setShowMenu(false); onEdit('BUDGET & LIMITS'); } }} 
                            className={clsx(
                                "w-full px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-4 transition-colors font-mono",
                                isViewer ? "opacity-30 cursor-not-allowed" : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                            )}
                        >
                            <CreditCard className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} /> BUDGET & LIMITS
                        </button>
                        <div className="h-px bg-black/[0.03] my-3 mx-4" />
                        <button 
                            onClick={() => { if (!isViewer) { setShowMenu(false); handleArchive(); } }} 
                            className={clsx(
                                "w-full px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-4 transition-colors font-mono",
                                isViewer ? "opacity-30 cursor-not-allowed" : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                            )}
                        >
                            <Archive className="w-4.5 h-4.5 text-primary" strokeWidth={2.5} /> {project.status === 'Active' ? 'ARCHIVE PROJECT' : 'RESTORE PROJECT'}
                        </button>
                        <button 
                            onClick={() => { if (!isViewer) { setShowMenu(false); handleDelete(); } }} 
                            className={clsx(
                                "w-full px-6 py-4 text-left text-[11px] font-bold uppercase tracking-[0.2em] flex items-center gap-4 transition-colors font-mono",
                                isViewer ? "opacity-30 cursor-not-allowed" : "text-rose-500 hover:bg-rose-500/10"
                            )}
                        >
                            <Trash2 className="w-4.5 h-4.5 text-rose-600" strokeWidth={2.5} /> DELETE PROJECT
                        </button>
                    </div>
                )}
            </td>
        </tr>
    );
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

function ToggleItem({ label, active, onToggle, hint }: { label: string; active: boolean; onToggle: () => void; hint?: string }) {
    return (
        <div className="flex items-center justify-between py-4 px-2">
            <div className="flex-1">
                <span className="text-[13px] font-bold text-text-primary tracking-tight leading-none block mb-1">{label}</span>
                {hint && <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1 font-mono">{hint}</p>}
            </div>
            <button 
                type="button" 
                onClick={onToggle}
                className={clsx(
                    "relative w-12 h-6 rounded-full transition-all duration-300 focus:outline-none shadow-inner",
                    active ? 'bg-primary' : 'bg-black/[0.08]'
                )}
            >
                <span className={clsx(
                    "absolute top-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-300",
                    active ? 'left-7' : 'left-1'
                )} />
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
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className={clsx("text-[10px] font-bold uppercase tracking-[0.2em] font-mono", color)}>{label}</h4>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1 font-mono">{description}</p>
                </div>
                <span className="text-[10px] font-bold text-text-muted opacity-50 font-mono">{filtered.length} MEMBERS</span>
            </div>
            <div className="glass border border-black/[0.05] rounded-2xl overflow-hidden shadow-sm">
                {filtered.length === 0 ? (
                    <div className="py-12 text-center">
                        <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono italic">No members found</p>
                    </div>
                ) : (
                    <div className="divide-y divide-black/[0.03] max-h-[220px] overflow-y-auto custom-scrollbar">
                        {filtered.map(m => {
                            const isSelected = selectedIds.has(m.id);
                            const initials = m.full_name.split(' ').map((w: string) => w[0]).join('').slice(0,2).toUpperCase();
                            return (
                                <button 
                                    type="button" 
                                    key={m.id} 
                                    onClick={() => onToggle(m.id)}
                                    className={clsx(
                                        "w-full flex items-center justify-between px-5 py-4 transition-all group/member",
                                        isSelected ? "bg-primary/[0.03]" : "bg-white hover:bg-black/[0.01]"
                                    )}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={clsx(
                                            "w-10 h-10 rounded-xl flex items-center justify-center text-[11px] font-bold shrink-0 shadow-sm border border-black/[0.03] transition-all group-hover/member:scale-110",
                                            isSelected ? "bg-primary text-white" : "bg-black/[0.03] text-text-primary"
                                        )}>
                                            {initials}
                                        </div>
                                        <div className="text-left min-w-0">
                                            <p className="text-[13px] font-bold text-text-primary leading-none truncate mb-1">{m.full_name}</p>
                                            <p className="text-[10px] font-bold text-text-muted uppercase tracking-tight font-mono truncate">{m.email}</p>
                                        </div>
                                    </div>
                                    <div className={clsx(
                                        "w-5 h-5 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all",
                                        isSelected ? "bg-primary border-primary shadow-sm" : "border-black/[0.1] group-hover/member:border-primary/50"
                                    )}>
                                        {isSelected && <Check className="w-3.5 h-3.5 text-white stroke-[4]" />}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 overflow-y-auto bg-text-primary/10 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="bg-white rounded-[40px] w-full max-w-[620px] shadow-[0_32px_120px_rgba(0,0,0,0.12)] flex flex-col my-auto border border-black/[0.05] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                
                {/* Modal Header */}
                <div className="px-10 pt-10 pb-0 bg-black/[0.01]">
                    <div className="flex items-start justify-between mb-8">
                        <div className="flex items-center gap-5">
                            <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-black/[0.05] shadow-sm transform -rotate-3 hover:rotate-0 transition-transform duration-500"
                                style={{ background: `linear-gradient(135deg, ${color}15 0%, ${color}35 100%)`, color }}>
                                <span className="font-bold text-2xl font-mono">{(name || 'P').charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-text-primary tracking-tighter leading-none mb-2">{project ? 'Edit Project' : 'New Project'}</h2>
                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Configure project details and team access</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-3 bg-black/[0.03] hover:bg-black/[0.08] rounded-2xl transition-all text-text-muted hover:text-text-primary shadow-sm hover:scale-110 active:scale-90"><X className="w-5 h-5" strokeWidth={3} /></button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-2">
                        {modalTabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={clsx(
                                    "px-6 py-4 text-[10px] font-bold tracking-[0.2em] relative transition-all rounded-t-2xl font-mono overflow-hidden",
                                    activeTab === tab 
                                        ? "text-primary bg-white shadow-[0_-8px_20px_rgba(0,0,0,0.02)] border-t border-l border-r border-black/[0.03]" 
                                        : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                                )}
                            >
                                {tab}
                                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-full shadow-[0_0_12px_rgba(80,110,248,0.4)]" />}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-10 py-10 max-h-[65vh] overflow-y-auto custom-scrollbar bg-white">
                    {activeTab === 'GENERAL' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-3">Project Name *</label>
                                <input 
                                    value={name} 
                                    onChange={e => setName(e.target.value)} 
                                    placeholder="Enter project name..."
                                    className="w-full bg-white border border-black/[0.08] rounded-2xl px-6 py-4 text-[13px] font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all font-mono placeholder:text-text-muted/30 uppercase" 
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-4">Color Theme</label>
                                <div className="flex gap-3.5 flex-wrap">
                                    {COLORS.map(c => (
                                        <button key={c} type="button" onClick={() => setColor(c)}
                                            className={clsx(
                                                "w-9 h-9 rounded-[14px] shadow-sm transition-all relative overflow-hidden",
                                                color===c ? "ring-[3px] ring-primary/20 scale-110 shadow-lg" : "hover:scale-110 grayscale-[30%] hover:grayscale-0"
                                            )}
                                            style={{ background: c }}
                                        >
                                            {color === c && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-white/20">
                                                    <Check className="w-5 h-5 text-white stroke-[4]" />
                                                </div>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-1">Project Settings</label>
                                <div className="bg-white border border-black/[0.03] rounded-3xl px-3 py-2 divide-y divide-black/[0.03] overflow-hidden shadow-sm">
                                    <ToggleItem label="Billable Default" active={billable} onToggle={() => setBillable(!billable)} hint="SET PROJECT AS BILLABLE" />
                                    <ToggleItem label="Track Activity" active={!disableActivity} onToggle={() => setDisableActivity(!disableActivity)} hint="RECORD KEYBOARD & MOUSE ACTIVITY" />
                                    <ToggleItem label="Allow Manual Time" active={allowTracking} onToggle={() => setAllowTracking(!allowTracking)} hint="ALLOW USERS TO ADD TIME MANUALLY" />
                                    <ToggleItem label="Disable Idle Time" active={!disableIdle} onToggle={() => setDisableIdle(!disableIdle)} hint="DO NOT TRACK IDLE STATUS" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-3">Client Affiliation</label>
                                <div className="relative group">
                                    <select 
                                        value={clientId} 
                                        onChange={e => setClientId(e.target.value)}
                                        className="w-full pl-6 pr-12 py-4 bg-black/[0.02] border border-black/[0.05] rounded-2xl text-[13px] font-bold text-text-primary appearance-none focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-mono uppercase cursor-pointer"
                                    >
                                        <option value="" className="bg-white">NO CLIENT ASSIGNMENT</option>
                                        {clients.map(c => <option key={c.id} value={c.id} className="bg-white">{c.name.toUpperCase()}</option>)}
                                    </select>
                                    <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none group-hover:text-primary transition-colors" strokeWidth={3} />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'MEMBERS' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="relative group">
                                <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" strokeWidth={2.5} />
                                <input 
                                    value={memberSearch} 
                                    onChange={e => setMemberSearch(e.target.value)} 
                                    placeholder="Search members..."
                                    className="w-full pl-13 pr-6 py-4 bg-black/[0.02] border border-black/[0.05] rounded-[20px] text-[12px] font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-mono placeholder:text-text-muted/40 uppercase" 
                                />
                            </div>
                            <div className="space-y-10">
                                <MemberPicker label="EXECUTIVE COMMAND" description="Strategic oversight and admin rights" color="text-purple-600"
                                    members={managers} selectedIds={managerIds} onToggle={id => toggleId(managerIds, setManagerIds, id)} memberSearch={memberSearch} />
                                <MemberPicker label="MEMBERS" description="Core project members" color="text-primary"
                                    members={users} selectedIds={userIds} onToggle={id => toggleId(userIds, setUserIds, id)} memberSearch={memberSearch} />
                                <MemberPicker label="INTELLIGENCE OBSERVERS" description="Read-only analytic access" color="text-emerald-600"
                                    members={viewers} selectedIds={viewerIds} onToggle={id => toggleId(viewerIds, setViewerIds, id)} memberSearch={memberSearch} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'BUDGET & LIMITS' && (
                        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex p-1.5 bg-black/[0.03] rounded-2xl">
                                {(['project','member'] as const).map(s => (
                                    <button key={s} onClick={() => setBudgetSubTab(s)}
                                        className={clsx(
                                            "flex-1 py-3 rounded-[14px] text-[10px] font-bold uppercase tracking-[0.2em] transition-all font-mono",
                                            budgetSubTab===s ? "bg-white text-primary shadow-sm" : "text-text-muted hover:text-text-primary"
                                        )}
                                    >
                                        {s === 'project' ? 'TOTAL CAPACITY' : 'UNIT CONSTRAINTS'}
                                    </button>
                                ))}
                            </div>

                            {budgetSubTab === 'project' && (
                                <div className="space-y-8">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Metric Type</label>
                                            <div className="relative">
                                                <select 
                                                    value={budgetType} 
                                                    onChange={e => setBudgetType(e.target.value as BudgetType)}
                                                    className="w-full pl-4 pr-10 py-3.5 bg-black/[0.02] border border-black/[0.05] rounded-2xl text-[12px] font-bold text-text-primary appearance-none focus:outline-none transition-all font-mono uppercase"
                                                >
                                                    {['No budget','Total hours','Total amount','Monthly hours','Monthly amount'].map(t => <option key={t} value={t} className="bg-white">{t.toUpperCase()}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Reference Hub</label>
                                            <div className="relative">
                                                <select 
                                                    value={basedOn} 
                                                    onChange={e => setBasedOn(e.target.value)}
                                                    className="w-full pl-4 pr-10 py-3.5 bg-black/[0.02] border border-black/[0.05] rounded-2xl text-[12px] font-bold text-text-primary appearance-none focus:outline-none transition-all font-mono uppercase"
                                                >
                                                    {['Pay rate','Bill rate','Custom'].map(r => <option key={r} value={r} className="bg-white">{r.toUpperCase()}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Threshold *</label>
                                            <div className="flex bg-black/[0.02] border border-black/[0.05] rounded-2xl overflow-hidden focus-within:ring-4 focus-within:ring-primary/10 transition-all group">
                                                <span className="px-4 py-3.5 bg-black/[0.03] text-[11px] font-bold text-primary border-r border-black/[0.05] font-mono">$</span>
                                                <input 
                                                    type="number" 
                                                    value={budgetCost} 
                                                    onChange={e => setBudgetCost(e.target.value)} 
                                                    placeholder="0.00" 
                                                    className="flex-1 min-w-0 bg-transparent px-4 py-3.5 text-[13px] font-bold text-text-primary focus:outline-none font-mono placeholder:text-text-muted/30" 
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="glass border border-black/[0.03] rounded-[28px] overflow-hidden shadow-sm">
                                        <ToggleItem label="Automated Alerts" active={budgetNotify} onToggle={() => setBudgetNotify(!budgetNotify)} hint="TRANSMIT STATUS UPDATES" />
                                        {budgetNotify && (
                                            <div className="p-6 bg-black/[0.01] border-t border-black/[0.03] animate-in slide-in-from-top-4 duration-300">
                                                <div className="grid grid-cols-2 gap-6">
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Trigger Point</label>
                                                        <div className="flex bg-white border border-black/[0.1] rounded-xl overflow-hidden shadow-sm">
                                                            <input type="number" value={notifyAt} onChange={e => setNotifyAt(e.target.value)} placeholder="80" className="flex-1 min-w-0 px-4 py-3 text-[13px] font-bold font-mono focus:outline-none" />
                                                            <span className="px-4 py-3 bg-black/[0.03] text-[9px] font-bold text-text-muted border-l border-black/[0.05] font-mono uppercase">% LOAD</span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Transmission Target</label>
                                                        <div className="relative">
                                                            <select value={notifyWho} onChange={e => setNotifyWho(e.target.value)}
                                                                className="w-full pl-4 pr-10 py-3 bg-white border border-black/[0.1] rounded-xl text-[12px] font-bold text-text-primary appearance-none focus:outline-none font-mono uppercase shadow-sm">
                                                                {['Project members','Managers only','Admins only'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                                            </select>
                                                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" strokeWidth={3} />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        <div className="border-t border-black/[0.03]">
                                            <ToggleItem label="Automatic Termination" active={stopTimers} onToggle={() => setStopTimers(!stopTimers)} hint="CEASE OPS AT LIMIT" />
                                            {stopTimers && (
                                                <div className="p-6 bg-black/[0.01] border-t border-black/[0.03] animate-in slide-in-from-top-4 duration-300">
                                                    <div className="space-y-3">
                                                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Kill switch at</label>
                                                        <div className="flex bg-white border border-black/[0.1] rounded-xl overflow-hidden max-w-xs shadow-sm">
                                                            <input type="number" value={stopAt} onChange={e => setStopAt(e.target.value)} placeholder="100" className="flex-1 min-w-0 px-4 py-3 text-[13px] font-bold font-mono focus:outline-none" />
                                                            <span className="px-4 py-3 bg-black/[0.03] text-[9px] font-bold text-text-muted border-l border-black/[0.05] font-mono uppercase">% LOAD</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Reset Budget</label>
                                            <div className="relative">
                                                <select 
                                                    value={resets} 
                                                    onChange={e => setResets(e.target.value)}
                                                    className="w-full pl-6 pr-12 py-4 bg-black/[0.02] border border-black/[0.05] rounded-[20px] text-[12px] font-bold text-text-primary appearance-none focus:outline-none font-mono uppercase"
                                                >
                                                    {['Never','Weekly','Monthly','Yearly'].map(r => <option key={r} value={r} className="bg-white">{r.toUpperCase()}</option>)}
                                                </select>
                                                <ChevronDown className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none transition-colors" strokeWidth={3} />
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Initiation Pulse</label>
                                            <input 
                                                type="date" 
                                                value={startDate} 
                                                onChange={e => setStartDate(e.target.value)}
                                                className="w-full px-6 py-4 bg-black/[0.02] border border-black/[0.05] rounded-[20px] text-[12px] font-bold text-text-primary focus:outline-none font-mono text-center" 
                                            />
                                        </div>
                                    </div>
                                    <div className="glass border border-black/[0.03] rounded-3xl overflow-hidden shadow-sm">
                                        <ToggleItem label="Telemetry Inclusion" active={includeNonBillable} onToggle={() => setIncludeNonBillable(!includeNonBillable)} hint="INCLUDE NON-BILLABLE METRICS" />
                                    </div>
                                </div>
                            )}

                            {budgetSubTab === 'member' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="flex gap-4 p-6 bg-primary/5 border border-primary/10 rounded-3xl">
                                        <AlertCircle className="w-6 h-6 text-primary shrink-0" strokeWidth={2.5} />
                                        <p className="text-[12px] font-bold text-primary uppercase tracking-wider font-mono leading-relaxed">System-wide constraint: Set a weekly limit on hours tracked for each member in this project.</p>
                                    </div>
                                    <div className="space-y-4">
                                        <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Weekly Hour Ceiling</label>
                                        <div className="relative group">
                                            <input 
                                                type="number" 
                                                value={memberLimit} 
                                                onChange={e => setMemberLimit(e.target.value)} 
                                                placeholder="ZERO FOR UNCONSTRAINED"
                                                className="w-full bg-black/[0.02] border border-black/[0.05] rounded-3xl px-8 py-6 text-xl font-bold text-primary placeholder:text-text-muted/20 outline-none focus:ring-8 focus:ring-primary/5 focus:border-primary/30 transition-all font-mono text-center tracking-tighter" 
                                            />
                                            <div className="absolute right-8 top-1/2 -translate-y-1/2 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] pointer-events-none group-focus-within:text-primary opacity-50 font-mono">
                                                HOURS / WEEK
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'TEAMS' && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex items-center gap-6">
                                <div className="relative flex-1 group">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" strokeWidth={2.5} />
                                    <input 
                                        value={teamSearch} 
                                        onChange={e => setTeamSearch(e.target.value)} 
                                        placeholder="QUERY TEAM CLUSTERS..."
                                        className="w-full pl-13 pr-6 py-4 bg-black/[0.02] border border-black/[0.05] rounded-[20px] text-[12px] font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 transition-all font-mono placeholder:text-text-muted/40 uppercase" 
                                    />
                                </div>
                                {filteredTeams.length > 0 && (
                                    <button 
                                        onClick={() => setSelectedTeamIds(selectedTeamIds.size===filteredTeams.length ? new Set() : new Set(filteredTeams.map(t => t.id)))}
                                        className="text-[10px] font-bold text-primary hover:text-primary/70 uppercase tracking-[0.2em] font-mono whitespace-nowrap px-4 py-2 bg-primary/5 rounded-xl border border-primary/10 transition-all active:scale-95"
                                    >
                                        {selectedTeamIds.size===filteredTeams.length ? 'PURGE SELECTION' : 'SELECT ALL'}
                                    </button>
                                )}
                            </div>
                            {filteredTeams.length === 0 ? (
                                <div className="py-24 text-center">
                                    <div className="w-20 h-20 bg-black/[0.02] border border-black/[0.05] rounded-[40px] flex items-center justify-center mx-auto mb-6">
                                        <Users className="w-8 h-8 text-text-muted/30" />
                                    </div>
                                    <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">No cluster matches detected</p>
                                </div>
                            ) : (
                                <div className="glass border border-black/[0.08] rounded-[32px] overflow-hidden divide-y divide-black/[0.03] shadow-lg">
                                    {filteredTeams.map(t => {
                                        const isSel = selectedTeamIds.has(t.id);
                                        return (
                                            <button key={t.id} onClick={() => toggleId(selectedTeamIds, setSelectedTeamIds, t.id)}
                                                className={clsx(
                                                    "w-full flex items-center justify-between px-8 py-6 transition-all group/team",
                                                    isSel ? "bg-primary/[0.03]" : "bg-white hover:bg-black/[0.01]"
                                                )}
                                            >
                                                <div className="flex items-center gap-6">
                                                    <div className={clsx(
                                                        "w-12 h-12 rounded-[18px] flex items-center justify-center font-bold text-[13px] shadow-sm transform transition-all group-hover/team:scale-110 group-hover/team:-rotate-3 font-mono border border-black/[0.03]",
                                                        isSel ? "bg-primary text-white" : "bg-purple-50 text-purple-600"
                                                    )}>
                                                        {t.name.slice(0,2).toUpperCase()}
                                                    </div>
                                                    <div className="text-left">
                                                        <span className="text-base font-bold text-text-primary tracking-tight leading-none block mb-1">{t.name}</span>
                                                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono">TEAM</span>
                                                    </div>
                                                </div>
                                                <div className={clsx(
                                                    "w-6 h-6 rounded-lg border-[2.5px] flex items-center justify-center transition-all",
                                                    isSel ? "bg-primary border-primary shadow-sm" : "border-black/[0.1] group-hover/team:border-primary/50"
                                                )}>
                                                    {isSel && <Check className="w-4 h-4 text-white stroke-[4]" />}
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-10 py-8 border-t border-black/[0.05] bg-black/[0.01] flex items-center justify-between gap-10">
                    <div className="flex-1 min-w-0">
                        {error && (
                            <div className="flex items-center gap-3 text-rose-600 text-[11px] font-bold uppercase tracking-widest font-mono p-4 bg-rose-50 border border-rose-100 rounded-2xl animate-shake">
                                <AlertCircle className="w-5 h-5 shrink-0" strokeWidth={2.5} /><span className="truncate">{error}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-4 shrink-0">
                        <button onClick={onClose} className="px-8 py-4 rounded-2xl border border-black/[0.1] text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-white hover:border-black/[0.2] transition-all uppercase tracking-[0.2em] font-mono active:scale-95 shadow-sm">DISMISS</button>
                        <button onClick={handleSave} disabled={loading || isViewer}
                            className={clsx(
                                "px-12 py-4 rounded-2xl text-[11px] font-bold transition-all shadow-xl flex items-center gap-3 uppercase tracking-[0.3em] font-mono active:scale-95",
                                isViewer ? "bg-black/20 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02] disabled:opacity-50"
                            )}
                        >
                            {loading && <div className="w-4 h-4 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />}
                            {isViewer ? 'READ ONLY' : loading ? 'SAVING...' : 'SAVE PROJECT'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Projects;
