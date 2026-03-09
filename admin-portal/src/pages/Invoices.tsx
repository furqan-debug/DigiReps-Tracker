import { useState, useEffect } from 'react';

import { FileText, Plus, Search, Filter, MoreHorizontal } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Invoice {
    id: string;
    client_id: string;
    amount: number;
    status: string;
    issue_date: string;
    due_date: string;
    clients?: { name: string };
}

export function Invoices() {
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        fetchInvoices();
    }, []);

    async function fetchInvoices() {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/invoices`);
            if (res.ok) {
                const data = await res.json();
                setInvoices(data);
            }
        } catch (err) {
            console.error('Failed to fetch invoices', err);
        } finally {
            setLoading(false);
        }
    }

    const filtered = invoices.filter(inv => {
        const matchesSearch = inv.clients?.name?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || inv.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalOutstanding = invoices.reduce((sum, inv) => {
        return (inv.status === 'Sent' || inv.status === 'Overdue') ? sum + Number(inv.amount) : sum;
    }, 0);

    return (
        <div className="p-8 max-w-[1400px] mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Invoices</h1>
                    <p className="text-slate-500 text-sm mt-1">Manage bills to your clients and track payments</p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        <Plus className="w-4 h-4" /> New Invoice
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Outstanding Balance</div>
                    <div className="text-3xl font-light text-rose-600">${totalOutstanding.toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Drafts</div>
                    <div className="text-3xl font-light text-slate-800">
                        {invoices.filter(i => i.status === 'Draft').length}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                    <div className="relative w-full sm:w-72 shrink-0">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search client..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-1.5">
                            <Filter className="w-4 h-4 text-slate-400" />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="bg-transparent border-none text-sm text-slate-700 font-medium focus:outline-none focus:ring-0 cursor-pointer"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="Sent">Sent</option>
                                <option value="Paid">Paid</option>
                                <option value="Overdue">Overdue</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Client</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Amount</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Issue Date</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Due Date</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading invoices...</td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <FileText className="w-12 h-12 mb-3 text-slate-200" />
                                            <p className="text-base font-medium text-slate-600">No invoices found</p>
                                            <p className="text-sm mt-1">Create an invoice to bill a client.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((inv) => (
                                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-semibold text-slate-800">{inv.clients?.name || 'Unknown Client'}</span>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                                            ${Number(inv.amount).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {new Date(inv.issue_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {new Date(inv.due_date).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                                                inv.status === 'Sent' ? 'bg-blue-100 text-blue-800' :
                                                    inv.status === 'Overdue' ? 'bg-rose-100 text-rose-800' :
                                                        'bg-slate-100 text-slate-800'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-md transition-colors">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
