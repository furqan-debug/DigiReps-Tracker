import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Plus, Search, MoreHorizontal, Map, User, CircleDot, X, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface JobSite {
    id: string;
    name: string;
    address: string;
    radius: number;
    assigned_members: number;
    status: 'Active' | 'Inactive';
    created_at: string;
}

export function JobSites() {
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');
    const [sites, setSites] = useState<JobSite[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newSite, setNewSite] = useState({ name: '', address: '', radius: 150 });

    useEffect(() => {
        fetchSites();
    }, []);

    async function fetchSites() {
        setLoading(true);
        const { data, error } = await supabase
            .from('job_sites')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setSites(data);
        }
        setLoading(false);
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        const { data, error } = await supabase
            .from('job_sites')
            .insert({
                name: newSite.name,
                address: newSite.address,
                radius: newSite.radius,
                status: 'Active',
                assigned_members: 0 // Default to 0, actual assignments would normally be associative table
            })
            .select()
            .single();

        if (!error && data) {
            setSites([data, ...sites]);
            setShowModal(false);
            setNewSite({ name: '', address: '', radius: 150 });
        }
        setSaving(false);
    }

    const filteredSites = sites.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.address.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === 'All' || s.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    return (
        <div className="p-8 max-w-[1400px] mx-auto w-full fade-in">
            {/* Header Area */}
            <div className="flex justify-between items-end mb-8 relative z-20">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Job Sites</h1>
                    <p className="text-slate-500">Manage geofenced boundaries for location-restricted time tracking.</p>
                </div>

                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/locations')}
                        className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors"
                    >
                        <Map className="w-4 h-4" />
                        View Map
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" />
                        Create Job Site
                    </button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group cursor-pointer hover:border-blue-200 transition-colors">
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Sites</p>
                        <p className="text-3xl font-bold text-slate-800">{loading ? '-' : sites.length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <MapPin className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group cursor-pointer hover:border-emerald-200 transition-colors">
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Active Now</p>
                        <p className="text-3xl font-bold text-slate-800">{loading ? '-' : sites.filter(s => s.status === 'Active').length}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CircleDot className="w-6 h-6" />
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex items-center justify-between group cursor-pointer hover:border-purple-200 transition-colors">
                    <div>
                        <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-1">Total Members</p>
                        <p className="text-3xl font-bold text-slate-800">
                            {loading ? '-' : sites.reduce((acc, s) => acc + s.assigned_members, 0)}
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <User className="w-6 h-6" />
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col h-[600px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                    <div className="relative w-72">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search job sites or addresses..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="border border-slate-200 rounded-lg text-sm px-3 py-2 bg-white text-slate-700 outline-none hover:bg-slate-50"
                        >
                            <option value="All">All Statuses</option>
                            <option value="Active">Active</option>
                            <option value="Inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                            <tr className="border-b border-slate-200">
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Site Name & Address</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Geofence Radius</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Assigned Members</th>
                                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-32">Status</th>
                                <th className="px-6 py-4 w-16"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center text-slate-500">
                                        Loading job sites...
                                    </td>
                                </tr>
                            ) : filteredSites.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-20 text-center">
                                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-400 mb-4 border border-slate-100">
                                            <MapPin className="w-8 h-8" />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-900 mb-1">No job sites found</h3>
                                        <p className="text-slate-500 text-sm">Create a new geofenced area to restrict time tracking.</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredSites.map((site) => (
                                    <tr key={site.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                                                    <MapPin className="w-5 h-5 text-blue-600" />
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-slate-800">{site.name}</div>
                                                    <div className="text-sm text-slate-500 tracking-tight">{site.address}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <span className="inline-flex text-sm font-medium text-slate-700 bg-slate-100 px-2.5 py-1 rounded">
                                                {site.radius}m
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5 min-w-[100px]">
                                                {site.assigned_members > 0 ? (
                                                    <div className="flex -space-x-2 mr-2">
                                                        {[...Array(Math.min(3, site.assigned_members))].map((_, i) => (
                                                            <div key={i} className="w-6 h-6 rounded-full border-2 border-white bg-slate-200"></div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 mr-2">None</span>
                                                )}
                                                <span className="text-sm font-semibold text-slate-700">{site.assigned_members}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${site.status === 'Active'
                                                    ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20'
                                                    : 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/20'
                                                }`}>
                                                <CircleDot className={`w-3 h-3 ${site.status === 'Active' ? 'text-emerald-500' : 'text-slate-400'}`} />
                                                {site.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Job Site Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 fade-in">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col scale-in">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-blue-600" />
                                Create Job Site
                            </h2>
                            <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-md hover:bg-slate-100">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleCreate} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Site Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={newSite.name}
                                        onChange={e => setNewSite({ ...newSite, name: e.target.value })}
                                        placeholder="e.g. Downtown Headquarters"
                                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Address</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            required
                                            value={newSite.address}
                                            onChange={e => setNewSite({ ...newSite, address: e.target.value })}
                                            placeholder="123 Main St, New York, NY 10001"
                                            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        />
                                        <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1.5">Geofence Radius (meters)</label>
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="range"
                                            min="50"
                                            max="1000"
                                            step="50"
                                            value={newSite.radius}
                                            onChange={e => setNewSite({ ...newSite, radius: Number(e.target.value) })}
                                            className="flex-1 accent-blue-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                                        />
                                        <div className="w-20 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-center font-medium text-slate-700">
                                            {newSite.radius}m
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-500 mt-2">
                                        Members will be reminded to start tracking when entering this radius.
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowModal(false)}
                                    className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Create Site
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
