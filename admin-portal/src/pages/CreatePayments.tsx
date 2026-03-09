import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Plus, Check, ChevronLeft, CreditCard } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface Member {
    id: string;
    full_name: string;
    pay_rate: number;
}

export function CreatePayments() {
    const navigate = useNavigate();
    const [members, setMembers] = useState<Member[]>([]);
    const [selectedMember, setSelectedMember] = useState<string>('');
    const [amount, setAmount] = useState('');
    const [method, setMethod] = useState('');
    const [reference, setReference] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    useEffect(() => {
        async function fetchMembers() {
            setFetching(true);
            const { data } = await supabase.from('members').select('id, full_name, pay_rate').order('full_name');
            if (data) setMembers(data);
            setFetching(false);
        }
        fetchMembers();
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!selectedMember || !amount || !method) return;

        setLoading(true);
        try {
            const res = await fetch(`${API}/api/payments`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    member_id: selectedMember,
                    amount: parseFloat(amount),
                    method,
                    reference
                })
            });
            if (!res.ok) throw new Error('Failed to create payment');
            navigate('/financials/past');
        } catch (err: any) {
            alert(err.message);
            setLoading(false);
        }
    }
    
    return (
        <div className="p-8 max-w-[800px] mx-auto w-full">
            <div className="mb-8">
                <Link to="/financials" className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors mb-4">
                    <ChevronLeft className="w-4 h-4 mr-1" /> Back to Financials
                </Link>
                <h1 className="text-2xl font-semibold text-slate-900 tracking-tight flex items-center gap-3">
                    <CreditCard className="w-6 h-6 text-indigo-500" />
                    Issue Payment
                </h1>
                <p className="text-slate-500 text-sm mt-1">Record a new payment made to a team member</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Recipient Member *</label>
                        <select
                            required
                            value={selectedMember}
                            onChange={(e) => setSelectedMember(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        >
                            <option value="">Select a member...</option>
                            {members.map(m => (
                                <option key={m.id} value={m.id}>{m.full_name} {m.pay_rate ? `($${m.pay_rate}/hr)` : ''}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Amount ($) *</label>
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-mono"
                                placeholder="0.00"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">Payment Method *</label>
                            <select
                                required
                                value={method}
                                onChange={(e) => setMethod(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            >
                                <option value="">Select method...</option>
                                <option value="Bank Transfer">Bank Transfer</option>
                                <option value="PayPal">PayPal</option>
                                <option value="Stripe">Stripe</option>
                                <option value="Crypto">Crypto</option>
                                <option value="Cash/Other">Cash/Other</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Reference / Notes</label>
                        <input
                            type="text"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                            placeholder="e.g. Transaction ID, Check #, or brief note"
                        />
                    </div>

                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
                        <Link to="/financials" className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading || fetching}
                            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : <><Check className="w-4 h-4" /> Issue Payment</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
