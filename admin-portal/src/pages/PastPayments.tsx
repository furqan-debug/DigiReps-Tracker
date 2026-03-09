import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard, Search, Download, ExternalLink, Calendar as CalendarIcon, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Payment {
    id: string;
    member_id: string;
    amount: number;
    status: string;
    method: string;
    reference: string;
    paid_at: string;
    created_at: string;
    members?: { full_name: string };
}

export function PastPayments() {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        fetchPayments();
    }, []);

    async function fetchPayments() {
        setLoading(true);
        try {
            const res = await fetch(`${API}/api/payments`);
            if (res.ok) {
                const data = await res.json();
                setPayments(data);
            }
        } catch (err) {
            console.error('Failed to fetch payments', err);
        } finally {
            setLoading(false);
        }
    }

    const filtered = payments.filter(p => {
        const matchesSearch = p.members?.full_name?.toLowerCase().includes(search.toLowerCase()) ||
            p.reference?.toLowerCase().includes(search.toLowerCase());
        const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    const totalPaid = payments.reduce((sum, p) => p.status === 'Completed' ? sum + Number(p.amount) : sum, 0);

    return (
        <div className="p-8 max-w-[1400px] mx-auto w-full">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Past Payments</h1>
                    <p className="text-slate-500 text-sm mt-1">History of all transactions and payouts</p>
                </div>
                <div className="flex items-center gap-3">
                    <Link to="/financials/create" className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                        <CreditCard className="w-4 h-4" /> Issue Payment
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Paid (All Time)</div>
                    <div className="text-3xl font-light text-slate-800">${totalPaid.toFixed(2)}</div>
                </div>
                <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Total Transactions</div>
                    <div className="text-3xl font-light text-slate-800">{payments.length}</div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
                <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row gap-4 justify-between items-center bg-slate-50/50">
                    <div className="relative w-full sm:w-72 shrink-0">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Search member or reference..."
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
                                <option value="Completed">Completed</option>
                                <option value="Pending">Pending</option>
                                <option value="Failed">Failed</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
                            <tr>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Date</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Recipient</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Amount</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Method</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Reference</th>
                                <th className="px-6 py-4 font-semibold text-xs tracking-wider uppercase">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">Loading payments...</td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-400">
                                            <CreditCard className="w-12 h-12 mb-3 text-slate-200" />
                                            <p className="text-base font-medium text-slate-600">No payments found</p>
                                            <p className="text-sm mt-1">Adjust your filters or issue a new payment.</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((payment) => (
                                    <tr key={payment.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-600 font-medium whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <CalendarIcon className="w-4 h-4 text-slate-400" />
                                                {new Date(payment.paid_at || payment.created_at).toLocaleDateString(undefined, {
                                                    year: 'numeric', month: 'short', day: 'numeric'
                                                })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="font-semibold text-slate-800">{payment.members?.full_name || 'Unknown'}</span>
                                        </td>
                                        <td className="px-6 py-4 font-mono font-medium text-slate-900">
                                            ${Number(payment.amount).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                                            {payment.method}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 truncate max-w-[200px]">
                                            {payment.reference || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${payment.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' :
                                                    payment.status === 'Pending' ? 'bg-amber-100 text-amber-800' :
                                                        'bg-rose-100 text-rose-800'
                                                }`}>
                                                {payment.status}
                                            </span>
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
