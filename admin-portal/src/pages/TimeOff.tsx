import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    Clock, Check, X, Plus,
    Calendar as CalendarIcon,
    AlertCircle, CheckCircle, XCircle
} from 'lucide-react';

interface Member {
    id: string;
    full_name: string;
    email: string;
}

interface TimeOffRequest {
    id: string;
    member_id: string;
    member_name?: string;
    start_date: string;
    end_date: string;
    type: string;
    status: string;
    reason: string;
    manager_note: string;
    created_at: string;
}

export function TimeOff() {
    const [requests, setRequests] = useState<TimeOffRequest[]>([]);
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);

    // Form state
    const [memberId, setMemberId] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [type, setType] = useState('Vacation');
    const [reason, setReason] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    async function fetchData() {
        setLoading(true);
        const [
            { data: reqsData },
            { data: memsData }
        ] = await Promise.all([
            supabase.from('time_off_requests').select('*').order('created_at', { ascending: false }),
            supabase.from('members').select('id, full_name, email')
        ]);

        if (reqsData && memsData) {
            const memberMap: Record<string, string> = {};
            memsData.forEach(m => memberMap[m.id] = m.full_name);
            setRequests(reqsData.map(r => ({
                ...r,
                member_name: memberMap[r.member_id] || 'Unknown Member'
            })));
            setMembers(memsData);
        }
        setLoading(false);
    }

    async function handleStatusUpdate(id: string, status: 'Approved' | 'Rejected') {
        setProcessingId(id);
        const { error } = await supabase
            .from('time_off_requests')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) console.error(error);
        else fetchData();
        setProcessingId(null);
    }

    async function handleSubmitRequest() {
        if (!memberId || !startDate || !endDate) return;
        setLoading(true);
        const { error } = await supabase.from('time_off_requests').insert([{
            member_id: memberId,
            start_date: startDate,
            end_date: endDate,
            type,
            reason,
            status: 'Pending'
        }]);

        if (error) console.error(error);
        else {
            setShowAddModal(false);
            fetchData();
            // Reset form
            setMemberId(''); setStartDate(''); setEndDate(''); setReason('');
        }
    }

    const filtered = requests.filter(r => statusFilter === 'All' || r.status === statusFilter);

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full fade-in">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tight flex items-center gap-4">
                        <div className="bg-amber-500 p-2.5 rounded-2xl shadow-xl shadow-amber-100 ring-4 ring-amber-50">
                            <Clock className="w-8 h-8 text-white" />
                        </div>
                        Time Off Requests
                    </h1>
                    <p className="text-slate-500 mt-3 font-medium text-lg">Manage leave applications and track workforce availability.</p>
                </div>

                <div className="flex items-center gap-3">
                    <button onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 bg-slate-900 text-white px-8 py-3.5 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl shadow-slate-200 hover:shadow-amber-200 active:scale-95">
                        <Plus className="w-5 h-5" />
                        New Request
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row items-center justify-between gap-6">
                    <div className="flex bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
                        {(['All', 'Pending', 'Approved', 'Rejected'] as const).map(f => (
                            <button key={f} onClick={() => setStatusFilter(f)}
                                className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${statusFilter === f ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}>
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                {loading && !processingId ? (
                    <div className="p-24 text-center">
                        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">Processing Requests...</p>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="p-24 text-center">
                        <AlertCircle className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                        <h3 className="text-xl font-black text-slate-800 tracking-tight">No Requests Found</h3>
                        <p className="text-slate-500 font-medium max-w-sm mx-auto mt-2">There are currently no leave requests matching your filter.</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/30">
                                {['Member', 'Dates', 'Type', 'Status', 'Reason', 'Actions'].map(h => (
                                    <th key={h} className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{h}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filtered.map(r => (
                                <tr key={r.id} className="hover:bg-slate-50/50 transition-all group">
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black">
                                                {r.member_name?.[0]}
                                            </div>
                                            <div>
                                                <p className="font-black text-slate-800 tracking-tight">{r.member_name}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {r.member_id.slice(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2 text-slate-700 font-bold text-sm">
                                            <CalendarIcon className="w-4 h-4 text-slate-400" />
                                            {new Date(r.start_date).toLocaleDateString()} - {new Date(r.end_date).toLocaleDateString()}
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${r.type === 'Vacation' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                                r.type === 'Sick' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                    'bg-slate-50 text-slate-600 border-slate-100'
                                            }`}>
                                            {r.type}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className={`flex items-center gap-2 text-xs font-black uppercase tracking-tight ${r.status === 'Approved' ? 'text-emerald-500' :
                                                r.status === 'Rejected' ? 'text-rose-500' :
                                                    'text-amber-500'
                                            }`}>
                                            {r.status === 'Approved' ? <CheckCircle className="w-4 h-4" /> :
                                                r.status === 'Rejected' ? <XCircle className="w-4 h-4" /> :
                                                    <Clock className="w-4 h-4" />}
                                            {r.status}
                                        </span>
                                    </td>
                                    <td className="px-8 py-5 font-medium text-slate-500 italic text-sm max-w-xs truncate">
                                        "{r.reason || 'No reason provided'}"
                                    </td>
                                    <td className="px-8 py-5">
                                        {r.status === 'Pending' ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleStatusUpdate(r.id, 'Approved')}
                                                    disabled={processingId === r.id}
                                                    className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                                >
                                                    <Check className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(r.id, 'Rejected')}
                                                    disabled={processingId === r.id}
                                                    className="p-2.5 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm disabled:opacity-50"
                                                >
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">Processed</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* ADD REQUEST MODAL */}
            {showAddModal && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[3rem] w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-2xl font-black text-slate-900 tracking-tight">Log Time Off</h2>
                                <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Manual Leave Entry</p>
                            </div>
                            <button onClick={() => setShowAddModal(false)} className="p-3 hover:bg-slate-100 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="p-10 space-y-6">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Team Member</label>
                                <select
                                    value={memberId}
                                    onChange={e => setMemberId(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 transition-all appearance-none cursor-pointer"
                                >
                                    <option value="">Select a member...</option>
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>{m.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Start Date</label>
                                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 transition-all font-mono" />
                                </div>
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">End Date</label>
                                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                                        className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 transition-all font-mono" />
                                </div>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Request Type</label>
                                <select value={type} onChange={e => setType(e.target.value)}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 transition-all appearance-none cursor-pointer">
                                    {['Vacation', 'Sick', 'Personal', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Reason (Optional)</label>
                                <textarea
                                    value={reason}
                                    onChange={e => setReason(e.target.value)}
                                    placeholder="e.g. Family wedding, Medical checkup..."
                                    rows={2}
                                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-black text-slate-800 outline-none focus:ring-4 focus:ring-amber-500/10 focus:bg-white focus:border-amber-500 transition-all resize-none"
                                />
                            </div>
                        </div>
                        <div className="px-10 py-8 bg-slate-50/50 border-t border-slate-100 flex gap-4">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 px-6 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-all">Cancel</button>
                            <button onClick={handleSubmitRequest} disabled={!memberId || !startDate || !endDate}
                                className="flex-[2] bg-amber-500 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-amber-100 disabled:opacity-50 active:scale-95">
                                Submit Request
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
