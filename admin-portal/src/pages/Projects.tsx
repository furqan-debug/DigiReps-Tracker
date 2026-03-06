import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { FolderKanban, Plus, Clock, Users, MoreVertical, CheckCircle2, Circle, Loader2, UserPlus, X, Check } from 'lucide-react';

interface Project {
    id: string;
    name: string;
    sessionCount: number;
    memberCount: number;
    totalMinutes: number;
    status: 'active' | 'paused' | 'completed';
    color: string;
}

interface Member {
    id: string;
    email: string;
    full_name: string;
    role: string;
}

const STATUS_COLORS = {
    active: 'bg-emerald-100 text-emerald-700',
    paused: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-slate-100 text-slate-500',
};

const STATUS_ICONS = {
    active: <Loader2 className="w-3 h-3 animate-spin" />,
    paused: <Circle className="w-3 h-3" />,
    completed: <CheckCircle2 className="w-3 h-3" />,
};

const PROJECT_CARD_COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export function Projects() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [showNew, setShowNew] = useState(false);
    const [newName, setNewName] = useState('');
    const [newDesc, setNewDesc] = useState('');
    const [newColor, setNewColor] = useState(PROJECT_CARD_COLORS[0] as string);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);

    // Assign members state
    const [assignProject, setAssignProject] = useState<Project | null>(null);
    const [allMembers, setAllMembers] = useState<Member[]>([]);
    const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState<string | null>(null);

    useEffect(() => {
        fetchProjects();
    }, []);

    async function openAssign(project: Project) {
        setAssignProject(project);
        setAssignError(null);

        // Load all members from backend
        try {
            const r = await fetch(`${API_BASE}/api/members`);
            if (r.ok) setAllMembers(await r.json());
        } catch { }

        // Load current assignments from Supabase
        const { data } = await supabase
            .from('project_members')
            .select('member_id')
            .eq('project_id', project.id);

        setSelectedMemberIds(new Set((data || []).map((r: any) => r.member_id)));
    }

    async function saveAssignments() {
        if (!assignProject) return;
        setAssigning(true);
        setAssignError(null);
        try {
            const res = await fetch(`${API_BASE}/api/projects/${assignProject.id}/members`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ member_ids: Array.from(selectedMemberIds) }),
            });
            if (!res.ok) throw new Error((await res.json()).error || 'Failed to save');

            // Update member count on the project card
            setProjects(prev => prev.map(p =>
                p.id === assignProject.id ? { ...p, memberCount: selectedMemberIds.size } : p
            ));
            setAssignProject(null);
        } catch (e: any) {
            setAssignError(e.message);
        } finally {
            setAssigning(false);
        }
    }

    function toggleMember(id: string) {
        setSelectedMemberIds(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    async function fetchProjects() {
        setLoading(true);

        // Load real projects from backend
        let dbProjects: { id: string; name: string; description: string; color: string; status: string }[] = [];
        try {
            const r = await fetch(`${API_BASE}/api/projects`);
            if (r.ok) dbProjects = await r.json();
        } catch { }

        // Also pull session stats from Supabase
        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, project_id, user_id, started_at, ended_at');

        const statsMap: Record<string, { sessions: number; members: Set<string>; minutes: number }> = {};
        (sessions || []).forEach(s => {
            const pid = s.project_id || 'general';
            if (!statsMap[pid]) statsMap[pid] = { sessions: 0, members: new Set(), minutes: 0 };
            statsMap[pid].sessions++;
            statsMap[pid].members.add(s.user_id);
            const startMs = new Date(s.started_at).getTime();
            const endMs = s.ended_at ? new Date(s.ended_at).getTime() : Date.now();
            statsMap[pid].minutes += Math.max(0, Math.round((endMs - startMs) / 60000));
        });

        // Merge DB projects with stats
        const result: Project[] = dbProjects.map((p, idx) => ({
            id: p.id,
            name: p.name,
            sessionCount: statsMap[p.id]?.sessions || 0,
            memberCount: statsMap[p.id]?.members.size || 0,
            totalMinutes: statsMap[p.id]?.minutes || 0,
            status: (p.status?.toLowerCase() || 'active') as 'active' | 'paused' | 'completed',
            color: p.color || (PROJECT_CARD_COLORS[idx % PROJECT_CARD_COLORS.length] as string),
        }));

        // Also add any session projects not tracked in DB yet
        Object.entries(statsMap).forEach(([pid, stats]) => {
            if (!result.find(p => p.id === pid)) {
                result.push({
                    id: pid,
                    name: pid === 'general' ? 'General' : capitalizeId(pid),
                    sessionCount: stats.sessions,
                    memberCount: stats.members.size,
                    totalMinutes: stats.minutes,
                    status: 'active',
                    color: PROJECT_CARD_COLORS[result.length % PROJECT_CARD_COLORS.length] as string,
                });
            }
        });

        setProjects(result.sort((a, b) => b.totalMinutes - a.totalMinutes));
        setLoading(false);
    }

    async function createProject() {
        if (!newName.trim()) return;
        setCreating(true);
        setCreateError(null);
        try {
            const res = await fetch(`${API_BASE}/api/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), description: newDesc.trim(), color: newColor }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Failed to create project');

            const newProject: Project = {
                id: data.id,
                name: data.name,
                sessionCount: 0, memberCount: 0, totalMinutes: 0,
                status: 'active',
                color: data.color || newColor,
            };
            setProjects(p => [newProject, ...p]);
            setShowNew(false);
            setNewName('');
            setNewDesc('');
            setNewColor(PROJECT_CARD_COLORS[0] as string);
        } catch (e: any) {
            setCreateError(e.message);
        } finally {
            setCreating(false);
        }
    }

    const totalTracked = projects.reduce((a, b) => a + b.totalMinutes, 0);

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900">Project Management</h1>
                    <p className="text-slate-500 text-sm mt-1">Track time across your projects</p>
                </div>
                <button onClick={() => setShowNew(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm">
                    <Plus className="w-4 h-4" /> New Project
                </button>
            </div>

            {/* Summary Row */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-2 mb-3">
                        <FolderKanban className="w-4 h-4 text-blue-500" /> Projects
                    </p>
                    <p className="text-3xl font-light text-slate-800">{projects.length}</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-2 mb-3">
                        <Clock className="w-4 h-4 text-purple-500" /> Total Tracked
                    </p>
                    <p className="text-3xl font-light text-slate-800">{Math.floor(totalTracked / 60)}h {totalTracked % 60}m</p>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-2 mb-3">
                        <Users className="w-4 h-4 text-emerald-500" /> Active Members
                    </p>
                    <p className="text-3xl font-light text-slate-800">
                        {new Set(projects.flatMap(p => p.memberCount)).size || projects.reduce((a, b) => Math.max(a, b.memberCount), 0)}
                    </p>
                </div>
            </div>

            {/* Project Cards Grid */}
            {loading ? (
                <div className="flex items-center justify-center h-48 text-slate-400">Loading projects...</div>
            ) : projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-4">
                    <FolderKanban className="w-12 h-12 text-slate-200" />
                    <p className="font-medium">No projects yet</p>
                    <p className="text-sm">Create a project or start a tracking session with a project ID.</p>
                    <button onClick={() => setShowNew(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors">
                        Create First Project
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                    {projects.map(p => (
                        <ProjectCard key={p.id} project={p} maxMinutes={projects[0]?.totalMinutes || 1}
                            onAssign={() => openAssign(p)} />
                    ))}
                </div>
            )}

            {/* Assign Members Modal */}
            {assignProject && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={e => { if (e.target === e.currentTarget) setAssignProject(null); }}>
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                            <div>
                                <h2 className="text-base font-semibold text-slate-900">Assign Members</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Project: <span className="font-medium text-slate-700">{assignProject.name}</span></p>
                            </div>
                            <button onClick={() => setAssignProject(null)} className="p-1 hover:bg-slate-100 rounded-lg">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                        </div>
                        <div className="px-6 py-4 max-h-80 overflow-y-auto">
                            {allMembers.length === 0 ? (
                                <div className="text-center text-slate-400 py-8">
                                    <UserPlus className="w-8 h-8 mx-auto mb-2 text-slate-200" />
                                    <p className="text-sm">No members yet.</p>
                                    <p className="text-xs mt-1">Add members in the People page first.</p>
                                </div>
                            ) : (
                                <div className="space-y-1.5">
                                    {allMembers.map(m => {
                                        const checked = selectedMemberIds.has(m.id);
                                        return (
                                            <button key={m.id} onClick={() => toggleMember(m.id)}
                                                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${checked ? 'border-blue-300 bg-blue-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                                    }`}>
                                                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-blue-600 border-blue-600' : 'border-slate-300'
                                                    }`}>
                                                    {checked && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{m.full_name}</p>
                                                    <p className="text-xs text-slate-400 truncate">{m.email}</p>
                                                </div>
                                                <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{m.role}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        {assignError && (
                            <div className="mx-6 mb-3 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{assignError}</div>
                        )}
                        <div className="px-6 pb-5 flex gap-3 border-t border-slate-100 pt-4">
                            <button onClick={() => setAssignProject(null)}
                                className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
                            <button onClick={saveAssignments} disabled={assigning}
                                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
                                {assigning ? 'Saving…' : `Save (${selectedMemberIds.size} selected)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showNew && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-2xl">
                        <h2 className="text-lg font-semibold text-slate-900 mb-1">New Project</h2>
                        <p className="text-sm text-slate-500 mb-5">Create a project that team members can track time against.</p>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Project Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Mobile App, Client Work..."
                                    value={newName}
                                    onChange={e => setNewName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && createProject()}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Description</label>
                                <input
                                    type="text"
                                    placeholder="Optional description"
                                    value={newDesc}
                                    onChange={e => setNewDesc(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1.5">Color</label>
                                <div className="flex gap-2">
                                    {PROJECT_CARD_COLORS.map(c => (
                                        <button key={c} onClick={() => setNewColor(c)}
                                            className={`w-7 h-7 rounded-full border-2 transition-transform ${newColor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                                            style={{ backgroundColor: c as string }} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {createError && (
                            <div className="mt-3 bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{createError}</div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowNew(false); setNewName(''); setCreateError(null); }}
                                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                                Cancel
                            </button>
                            <button onClick={createProject} disabled={!newName.trim() || creating}
                                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                                Create Project
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function ProjectCard({ project, maxMinutes, onAssign }: { project: Project; maxMinutes: number; onAssign: () => void }) {
    const [menuOpen, setMenuOpen] = useState(false);
    const barPercent = maxMinutes > 0 ? (project.totalMinutes / maxMinutes) * 100 : 0;

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden group">
            {/* Color bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: project.color }} />

            <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                            style={{ backgroundColor: project.color + '22', color: project.color }}>
                            {project.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h3 className="font-semibold text-slate-800">{project.name}</h3>
                            <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full mt-0.5 ${STATUS_COLORS[project.status]}`}>
                                {STATUS_ICONS[project.status]} {project.status}
                            </span>
                        </div>
                    </div>
                    <div className="relative">
                        <button onClick={() => setMenuOpen(!menuOpen)}
                            className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                            <MoreVertical className="w-4 h-4 text-slate-400" />
                        </button>
                        {menuOpen && (
                            <div className="absolute right-0 top-8 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-10 w-44">
                                {['Edit', 'Pause', 'Archive'].map(action => (
                                    <button key={action} onClick={() => setMenuOpen(false)}
                                        className="w-full px-4 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                                        {action}
                                    </button>
                                ))}
                                <div className="my-1 border-t border-slate-100" />
                                <button onClick={() => { setMenuOpen(false); onAssign(); }}
                                    className="w-full px-4 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 transition-colors font-medium flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" /> Assign Members
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    <Stat label="Sessions" value={project.sessionCount.toString()} />
                    <Stat label="Members" value={project.memberCount.toString()} />
                    <Stat label="Hours" value={project.totalMinutes > 0 ? `${Math.floor(project.totalMinutes / 60)}h` : '—'} />
                </div>

                {/* Time bar */}
                <div>
                    <div className="flex justify-between items-center text-xs text-slate-400 mb-1.5">
                        <span>Time share</span>
                        <span>{Math.round(barPercent)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${barPercent}%`, backgroundColor: project.color }} />
                    </div>
                </div>
            </div>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-slate-50 rounded-lg p-2.5 text-center">
            <p className="text-base font-semibold text-slate-700">{value}</p>
            <p className="text-[10px] text-slate-400 uppercase font-medium">{label}</p>
        </div>
    );
}

function capitalizeId(id: string): string {
    return id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
