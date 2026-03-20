import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Search, Building2, Mail, 
    X, Loader2, Plus, Globe, 
    Trash2, ShieldCheck, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import clsx from 'clsx';

interface Client {
    id: string;
    name: string;
    email: string;
    company: string;
    status: 'Active' | 'Inactive';
    created_at: string;
}

export function Clients() {
    const { profile } = useAuth();
    const isViewer = profile?.role === 'Viewer';
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [editClient, setEditClient] = useState<Client | null>(null);
    const [deletingClient, setDeletingClient] = useState<Client | null>(null);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({ name: '', email: '', company: '' });

    useEffect(() => {
        fetchClients();
    }, []);

    async function fetchClients() {
        setLoading(true);
        const { data, error } = await supabase
            .from('clients')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setClients(data);
        }
        setLoading(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        
        const payload = {
            name: formData.name,
            email: formData.email,
            company: formData.company,
            organization_id: profile?.organization_id
        };

        if (editClient) {
            const { data, error } = await supabase
                .from('clients')
                .update(payload)
                .eq('id', editClient.id)
                .select()
                .single();

            if (!error && data) {
                setClients(clients.map(c => c.id === data.id ? data : c));
                handleCloseModal();
            }
        } else {
            const { data, error } = await supabase
                .from('clients')
                .insert({ ...payload, status: 'Active' })
                .select()
                .single();

            if (!error && data) {
                setClients([data, ...clients]);
                handleCloseModal();
            }
        }
        setSaving(false);
    }

    async function handleDelete() {
        if (!deletingClient) return;
        
        const { error } = await supabase
            .from('clients')
            .delete()
            .eq('id', deletingClient.id);

        if (!error) {
            setClients(clients.filter(c => c.id !== deletingClient.id));
            setDeletingClient(null);
        }
    }

    async function toggleStatus(client: Client) {
        if (isViewer) return;
        const newStatus = client.status === 'Active' ? 'Inactive' : 'Active';
        const { data, error } = await supabase
            .from('clients')
            .update({ status: newStatus })
            .eq('id', client.id)
            .select()
            .single();

        if (!error && data) {
            setClients(clients.map(c => c.id === data.id ? data : c));
        }
    }

    function handleOpenCreate() {
        setEditClient(null);
        setFormData({ name: '', email: '', company: '' });
        setShowModal(true);
    }

    function handleOpenEdit(client: Client) {
        setEditClient(client);
        setFormData({ name: client.name, email: client.email, company: client.company });
        setShowModal(true);
    }

    function handleCloseModal() {
        setShowModal(false);
        setEditClient(null);
        setFormData({ name: '', email: '', company: '' });
    }

    const filteredClients = clients.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.email.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || c.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="flex flex-col h-full bg-transparent animate-in fade-in duration-700">
            {/* Header section with Stats */}
            <div className="px-10 py-12 border-b border-black/[0.05] bg-white/[0.01]">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div className="space-y-2">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm">
                                <Building2 className="w-6 h-6 text-primary" strokeWidth={2.5} />
                            </div>
                            <h1 className="text-3xl font-bold text-text-primary tracking-tighter">Partner Ecosystem</h1>
                        </div>
                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono leading-relaxed">Strategic business alliances and jurisdictional entity registries</p>
                    </div>

                    <div className="flex items-center gap-5">
                        <button
                            onClick={handleOpenCreate}
                            disabled={isViewer}
                            className={clsx(
                                "flex items-center gap-3 px-10 py-4 rounded-2xl text-[11px] font-bold uppercase tracking-[0.2em] transition-all shadow-xl active:scale-95 font-mono",
                                isViewer ? "bg-black/5 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02]"
                            )}
                        >
                            <Plus className="w-4 h-4 stroke-[4]" />
                            Establish Alliance
                        </button>
                    </div>
                </div>

                {/* KPI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    <StatsCard 
                        label="Strategic Partners" 
                        value={clients.length} 
                        icon={<Building2 className="w-5 h-5" strokeWidth={2.5} />} 
                        color="indigo" 
                    />
                    <StatsCard 
                        label="Active Channels" 
                        value={clients.filter(c => c.status === 'Active').length} 
                        icon={<Activity className="w-5 h-5" strokeWidth={2.5} />} 
                        color="emerald" 
                    />
                    <StatsCard 
                        label="Registry Expansion" 
                        value={clients.filter(c => {
                            const created = new Date(c.created_at).getTime();
                            const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
                            return created > thirtyDaysAgo;
                        }).length} 
                        icon={<Globe className="w-5 h-5" strokeWidth={2.5} />} 
                        color="violet" 
                    />
                </div>
            </div>

            {/* Content Area */}
            <div className="p-10 flex-1 overflow-auto custom-scrollbar bg-white/[0.01]">
                {/* Search & Filters */}
                <div className="flex flex-col md:flex-row gap-8 mb-12 items-stretch">
                    <div className="relative group flex-1">
                        <Search className="w-5 h-5 text-text-muted absolute left-6 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" strokeWidth={2.5} />
                        <input
                            type="text"
                            placeholder="QUERY PARTNER REGISTRY OR CORPORATE ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-15 pr-8 py-5 bg-white border border-black/[0.05] rounded-[24px] text-[13px] font-bold text-text-primary placeholder:text-text-muted/40 outline-none focus:ring-8 focus:ring-primary/5 focus:border-primary/20 transition-all shadow-sm font-mono uppercase"
                        />
                    </div>
                    <div className="flex items-center bg-black/[0.02] border border-black/[0.05] rounded-[24px] p-1.5 shadow-inner">
                        {['All', 'Active', 'Inactive'].map((s) => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={clsx(
                                    "px-8 py-3.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-300 font-mono",
                                    statusFilter === s ? "bg-white text-primary shadow-lg ring-1 ring-black/[0.05]" : "text-text-muted hover:text-text-primary hover:bg-black/[0.02]"
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="glass border border-black/[0.05] rounded-[48px] overflow-hidden shadow-2xl bg-white mb-20">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-black/[0.03] bg-black/[0.01]">
                                <th className="px-10 py-8 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Affiliate / Corporation</th>
                                <th className="px-10 py-8 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Secure Contact</th>
                                <th className="px-10 py-8 text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Status Status</th>
                                <th className="px-10 py-8 w-20"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-black/[0.03]">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="py-40 text-center">
                                        <div className="flex flex-col items-center gap-6">
                                            <Loader2 className="w-12 h-12 text-primary animate-spin" strokeWidth={3} />
                                            <span className="text-[11px] font-bold text-text-muted uppercase tracking-[0.5em] animate-pulse font-mono">Loading clients...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredClients.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-40 text-center">
                                        <div className="flex flex-col items-center gap-10">
                                            <div className="w-32 h-32 bg-black/[0.02] border border-black/[0.05] rounded-[56px] flex items-center justify-center rotate-6 shadow-sm">
                                                <Building2 className="w-16 h-16 text-text-muted/20" strokeWidth={1.5} />
                                            </div>
                                            <div className="space-y-4">
                                                <h3 className="text-2xl font-bold text-text-primary tracking-tighter">No Entities Found</h3>
                                                <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono italic">Strategic registry remains void of affiliate data</p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredClients.map((client) => (
                                    <tr key={client.id} className="hover:bg-black/[0.01] transition-all group/row group duration-500">
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-6">
                                                <div className="w-16 h-16 rounded-[24px] bg-primary/5 border border-primary/20 flex items-center justify-center shrink-0 group-hover/row:scale-110 group-hover/row:rotate-3 transition-all duration-700 shadow-sm">
                                                    <Building2 className="w-7 h-7 text-primary" strokeWidth={2.5} />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-text-primary text-xl tracking-tighter group-hover/row:text-primary transition-colors duration-500 mb-1">{client.name}</div>
                                                    <div className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] font-mono opacity-60">{client.company.toUpperCase()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <div className="flex items-center gap-4 text-[13px] font-bold text-text-muted group-hover/row:text-text-primary transition-colors duration-500 font-mono uppercase">
                                                <div className="w-10 h-10 rounded-[14px] bg-black/[0.03] flex items-center justify-center border border-black/[0.05] shadow-sm">
                                                    <Mail className="w-4 h-4" strokeWidth={2.5} />
                                                </div>
                                                {client.email}
                                            </div>
                                        </td>
                                        <td className="px-10 py-8">
                                            <button 
                                                onClick={() => toggleStatus(client)}
                                                disabled={isViewer}
                                                className={clsx(
                                                    "inline-flex items-center gap-4 px-6 py-3 rounded-[18px] text-[10px] font-bold uppercase tracking-[0.3em] transition-all duration-500 font-mono shadow-sm",
                                                    client.status === 'Active'
                                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-500/20"
                                                        : "bg-black/[0.03] text-text-muted border border-black/[0.05]",
                                                    isViewer ? "cursor-default" : "cursor-pointer hover:scale-105 active:scale-95"
                                                )}
                                            >
                                                <div className={clsx(
                                                    "w-2 h-2 rounded-full",
                                                    client.status === 'Active' ? "bg-emerald-500 animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]" : "bg-text-muted/30"
                                                )} />
                                                {client.status}
                                            </button>
                                        </td>
                                        <td className="px-10 py-8 text-right">
                                            <div className="flex justify-end gap-3 opacity-0 group-hover/row:opacity-100 transition-all duration-500 pr-2">
                                                <button 
                                                    onClick={() => handleOpenEdit(client)}
                                                    className="p-4 glass bg-white border border-black/[0.05] rounded-[20px] hover:bg-primary hover:text-white hover:border-primary transition-all duration-500 text-text-muted shadow-xl active:scale-90"
                                                    title="Reconfigure"
                                                >
                                                    <ShieldCheck className="w-5 h-5" strokeWidth={2.5} />
                                                </button>
                                                <button 
                                                    onClick={() => { if (!isViewer) setDeletingClient(client); }}
                                                    disabled={isViewer}
                                                    className={clsx(
                                                        "p-4 glass bg-white border border-black/[0.05] rounded-[20px] transition-all duration-500 shadow-xl active:scale-90",
                                                        isViewer ? "opacity-20 cursor-not-allowed" : "hover:bg-rose-600 hover:text-white hover:border-rose-600 text-text-muted"
                                                    )}
                                                    title="Decommission"
                                                >
                                                    <Trash2 className="w-5 h-5" strokeWidth={2.5} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CREATE/EDIT MODAL */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-text-primary/10 backdrop-blur-xl animate-in fade-in duration-300">
                    <div className="bg-white rounded-[40px] w-full max-w-[580px] shadow-[0_32px_120px_rgba(0,0,0,0.12)] flex flex-col border border-black/[0.05] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="px-10 pt-10 pb-0 bg-black/[0.01]">
                            <div className="flex items-start justify-between mb-8">
                                <div className="flex items-center gap-5">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-sm transform -rotate-3 hover:rotate-0 transition-transform duration-500">
                                        <Building2 className="w-7 h-7 text-primary" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-bold text-text-primary tracking-tighter leading-none mb-2">{editClient ? 'Reconfigure Alliance' : 'Establish Alliance'}</h2>
                                        <p className="text-[11px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">Client details and settings</p>
                                    </div>
                                </div>
                                <button onClick={handleCloseModal} className="p-3 bg-black/[0.03] hover:bg-black/[0.08] rounded-2xl transition-all text-text-muted hover:text-text-primary shadow-sm hover:scale-110 active:scale-90"><X className="w-5 h-5" strokeWidth={3} /></button>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="px-10 py-10 space-y-8 bg-white">
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-1">Entity Head Representative *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="DESIGNATE FULL NAME..."
                                    className="w-full bg-black/[0.02] border border-black/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all font-mono placeholder:text-text-muted/30 uppercase"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-1">Secure Communication Hub (Email) *</label>
                                <input
                                    type="email"
                                    required
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="SECURE@ENTITY.DOMAIN..."
                                    className="w-full bg-black/[0.02] border border-black/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all font-mono placeholder:text-text-muted/30 uppercase"
                                />
                            </div>
                            <div className="space-y-3">
                                <label className="block text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono mb-1">Corporation / Parent Entity *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.company}
                                    onChange={e => setFormData({ ...formData, company: e.target.value })}
                                    placeholder="PARENT ORGANIZATION IDENTIFIER..."
                                    className="w-full bg-black/[0.02] border border-black/[0.05] rounded-2xl px-6 py-4 text-[13px] font-bold text-text-primary focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary/20 transition-all font-mono placeholder:text-text-muted/30 uppercase"
                                />
                            </div>

                            <div className="pt-6 flex gap-4">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="flex-1 px-8 py-5 rounded-2xl border border-black/[0.1] text-[11px] font-bold text-text-muted hover:text-text-primary hover:bg-white transition-all uppercase tracking-[0.2em] font-mono active:scale-95 shadow-sm"
                                >
                                    ABORT
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving || isViewer}
                                    className={clsx(
                                        "flex-[2.2] px-8 py-5 rounded-[24px] text-[11px] font-bold transition-all shadow-xl flex items-center justify-center gap-3 uppercase tracking-[0.3em] font-mono active:scale-95",
                                        isViewer ? "bg-black/20 text-text-muted cursor-not-allowed" : "bg-primary text-white hover:shadow-primary/30 hover:scale-[1.02]"
                                    )}
                                >
                                    {saving && (
                                        <Loader2 className="w-4 h-4 animate-spin stroke-[3]" />
                                    )}
                                    {isViewer ? 'REGISTRY LOCKED' : (editClient ? 'SYNCHRONIZE ALLIANCE' : 'INITIALIZE ALLIANCE')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {deletingClient && (
                <div className="fixed inset-0 z-[100] bg-text-primary/10 backdrop-blur-xl flex items-center justify-center p-6 animate-in fade-in duration-500">
                    <div className="bg-white border border-rose-500/10 rounded-[48px] w-full max-w-md p-12 text-center shadow-[0_40px_120px_rgba(225,29,72,0.1)] overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                        <div className="w-28 h-28 bg-rose-500/5 rounded-[40px] flex items-center justify-center mx-auto mb-10 shadow-inner border border-rose-500/10 rotate-6 group-hover:rotate-0 transition-transform duration-700">
                            <Trash2 className="w-12 h-12 text-rose-600" strokeWidth={2.5} />
                        </div>
                        <h2 className="text-3xl font-bold text-text-primary tracking-tighter mb-4 uppercase">Purge Entity?</h2>
                        <p className="text-text-muted font-bold uppercase tracking-widest leading-relaxed mb-12 text-[11px] font-mono opacity-60">
                            Operation will permanently dissolve alliance with <span className="text-rose-600">"{deletingClient.name.toUpperCase()}"</span>. 
                            Project associations will be terminated.
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={() => setDeletingClient(null)}
                                className="flex-1 py-5 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-text-primary transition-all font-mono"
                            >
                                ABORT
                            </button>
                            <button
                                onClick={handleDelete}
                                className="flex-[1.8] bg-rose-600 hover:bg-rose-700 text-white py-5 rounded-[24px] text-[11px] font-bold uppercase tracking-[0.3em] transition-all shadow-xl shadow-rose-900/10 active:scale-95 font-mono"
                            >
                                CONFIRM PURGE
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatsCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: 'indigo' | 'emerald' | 'violet' }) {
    const colorClasses = {
        indigo: { bg: 'bg-primary/5', border: 'border-primary/20', text: 'text-primary', glow: 'bg-primary/5' },
        emerald: { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-600', glow: 'bg-emerald-500/5' },
        violet: { bg: 'bg-violet-500/5', border: 'border-violet-500/20', text: 'text-violet-600', glow: 'bg-violet-500/5' }
    };

    return (
        <div className="glass p-10 rounded-[44px] border border-black/[0.03] hover:border-primary/20 transition-all group overflow-hidden relative shadow-sm hover:shadow-xl duration-700 bg-white">
            <div className={clsx("absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-16 translate-x-16 group-hover:scale-125 transition-transform duration-1000", colorClasses[color].glow)} />
            <div className="flex items-center gap-6 mb-6">
                <div className={clsx("w-12 h-12 rounded-[18px] flex items-center justify-center border shadow-sm group-hover:scale-110 group-hover:rotate-6 transition-all duration-700", colorClasses[color].bg, colorClasses[color].border, colorClasses[color].text)}>
                    {icon}
                </div>
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em] font-mono">{label}</p>
            </div>
            <h2 className="text-5xl font-bold text-text-primary tracking-tighter leading-none">{value}</h2>
        </div>
    );
}
