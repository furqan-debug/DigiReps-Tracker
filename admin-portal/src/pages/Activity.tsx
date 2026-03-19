import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
    Monitor, Keyboard, Mouse, Camera, Clock, 
    Users, Activity as ActivityIcon, Zap, 
    Maximize2, ShieldCheck, Calendar,
    ChevronDown, X, Loader2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { PageLayout, KpiCard, Card } from '../components/ui';

interface ActivitySample {
    id: number;
    session_id: string;
    recorded_at: string;
    mouse_clicks: number;
    key_presses: number;
    app_name: string;
    window_title: string;
    idle: boolean;
    activity_percent: number;
}

interface Screenshot {
    id: number;
    session_id: string;
    recorded_at: string;
    file_url: string;
}

interface MemberInfo {
    id: string;
    full_name: string;
}

export function Activity() {
    const [samples, setSamples] = useState<ActivitySample[]>([]);
    const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]!);
    const [enlarged, setEnlarged] = useState<Screenshot | null>(null);
    const [members, setMembers] = useState<MemberInfo[]>([]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('all');

    useEffect(() => {
        supabase.from('members').select('id, full_name').eq('status', 'Active').then(({ data }) => {
            if (data) setMembers(data);
        });
    }, []);

    useEffect(() => { fetchData(); }, [selectedDate, selectedMemberId]);

    async function fetchData() {
        setLoading(true);
        const start = `${selectedDate}T00:00:00`;
        const end = `${selectedDate}T23:59:59`;

        let sessionIds: string[] | null = null;
        if (selectedMemberId !== 'all') {
            const { data: userSessions } = await supabase
                .from('sessions')
                .select('id')
                .eq('user_id', selectedMemberId);

            if (!userSessions || userSessions.length === 0) {
                setSamples([]);
                setScreenshots([]);
                setLoading(false);
                return;
            }
            sessionIds = userSessions.map(s => s.id);
        }

        let actQuery = supabase.from('activity_samples').select('*').gte('recorded_at', start).lte('recorded_at', end).order('recorded_at', { ascending: true });
        let ssQuery = supabase.from('screenshots').select('*').gte('recorded_at', start).lte('recorded_at', end).order('recorded_at', { ascending: false }).limit(24);

        if (sessionIds && sessionIds.length > 0) {
            actQuery = actQuery.in('session_id', sessionIds);
            ssQuery = ssQuery.in('session_id', sessionIds);
        }

        const [{ data: actData }, { data: ssData }] = await Promise.all([actQuery, ssQuery]);

        setSamples(actData || []);
        setScreenshots(ssData || []);
        setLoading(false);
    }

    const chartData = Array.from({ length: 24 }, (_, hour) => {
        const hourSamples = samples.filter(s => new Date(s.recorded_at).getHours() === hour);
        const avg = hourSamples.length
            ? Math.round(hourSamples.reduce((a, b) => a + b.activity_percent, 0) / hourSamples.length)
            : 0;
        return { hour: `${hour}:00`, activity: avg };
    });

    const totalClicks = samples.reduce((a, b) => a + b.mouse_clicks, 0);
    const totalKeys = samples.reduce((a, b) => a + b.key_presses, 0);
    const avgActivity = samples.length ? Math.round(samples.reduce((a, b) => a + b.activity_percent, 0) / samples.length) : 0;
    const activeTime = samples.filter(s => !s.idle).length;

    const isToday = selectedDate === new Date().toISOString().split('T')[0];
    const dateLabel = isToday ? 'Current Timeline' : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

    return (
        <PageLayout 
            title="Behavioral Matrix" 
            description={`${dateLabel} • Granular engagement analysis & app usage`} 
            maxWidth="full" 
            actions={
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
                    <FilterSelect 
                        icon={<Users className="w-4 h-4" />}
                        value={selectedMemberId}
                        onChange={setSelectedMemberId}
                        options={[{ id: 'all', name: 'Global Units' }, ...members.map(m => ({ id: m.id, name: m.full_name }))]}
                    />
                    <div className="relative group/date">
                        <div className="flex items-center gap-3 glass border border-black/[0.05] rounded-2xl px-5 py-3 shadow-xl transition-all group-hover/date:border-primary/50 cursor-pointer">
                            <Calendar className="w-4 h-4 text-primary" strokeWidth={2.5} />
                            <span className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] min-w-[120px] font-mono">{selectedDate}</span>
                        </div>
                        <input 
                            type="date" 
                            value={selectedDate} 
                            onChange={e => setSelectedDate(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                        />
                    </div>
                </div>
            }
        >
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                <KpiCard icon={<Mouse className="w-6 h-6" />} label="Mouse Interactions" value={totalClicks.toLocaleString()} trend="+12%" trendVariant="positive" />
                <KpiCard icon={<Keyboard className="w-6 h-6" />} label="Keystroke Volume" value={totalKeys.toLocaleString()} trend="+5%" trendVariant="positive" />
                <KpiCard icon={<ActivityIcon className="w-6 h-6" />} label="Active Sequences" value={activeTime.toString()} sub="Verified activity slots" />
                <KpiCard icon={<Zap className="w-6 h-6" />} label="Engagement Ratio" value={`${avgActivity}%`} trend="+2%" trendVariant="positive" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 mb-10">
                <div className="lg:col-span-2">
                    <Card title="Activity Intensity Registry">
                        {loading ? (
                            <div className="h-[400px] flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-primary animate-spin" />
                            </div>
                        ) : samples.length === 0 ? (
                            <div className="h-[400px] flex flex-col items-center justify-center text-text-muted opacity-30">
                                <ActivityIcon className="w-16 h-16 mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.3em] font-mono">No activity data recovered</p>
                            </div>
                        ) : (
                            <div className="h-[400px] w-full mt-6">
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={chartData}>
                                        <defs>
                                            <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#506ef8" stopOpacity={0.2} />
                                                <stop offset="95%" stopColor="#506ef8" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(41, 61, 99, 0.05)" />
                                        <XAxis 
                                            dataKey="hour" 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#5c6b8a', fontSize: 10, fontWeight: 900 }}
                                            dy={15}
                                            interval={2}
                                        />
                                        <YAxis 
                                            domain={[0, 100]} 
                                            axisLine={false} 
                                            tickLine={false} 
                                            tick={{ fill: '#5c6b8a', fontSize: 10, fontWeight: 900 }}
                                            unit="%"
                                            dx={-10}
                                        />
                                        <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(80, 110, 248, 0.1)', strokeWidth: 2 }} />
                                        <Area 
                                            type="monotone" 
                                            dataKey="activity" 
                                            stroke="#506ef8" 
                                            strokeWidth={4} 
                                            fill="url(#actGrad)" 
                                            animationDuration={2000} 
                                        />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Card>
                </div>

                <div className="lg:col-span-1">
                    <Card title="Environment Analysis">
                        <div className="space-y-6 mt-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                            {groupByApp(samples).length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-text-muted py-24 opacity-30">
                                    <Monitor className="w-12 h-12 mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.3em] font-mono">Registry Void</p>
                                </div>
                            ) : (
                                groupByApp(samples).map(({ app, percent }) => (
                                    <div key={app} className="group cursor-default">
                                        <div className="flex items-center justify-between mb-2.5">
                                            <span className="text-sm font-black text-text-primary tracking-tight group-hover:text-primary transition-colors truncate max-w-[180px] leading-none">{app || 'System Kernel'}</span>
                                            <span className="text-[9px] font-black text-text-secondary bg-black/[0.03] px-3 py-1 rounded-xl uppercase tracking-widest font-mono border border-black/[0.03] group-hover:bg-primary/5 group-hover:text-primary transition-all">
                                                {percent}%
                                            </span>
                                        </div>
                                        <div className="h-2 bg-black/[0.03] rounded-full overflow-hidden w-full p-[1px]">
                                            <div 
                                                className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full transition-all duration-[1500ms] ease-out shadow-sm shadow-primary/10"
                                                style={{ width: `${percent}%` }} 
                                            />
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </Card>
                </div>
            </div>

            <Card title="Visual Surveillance Manifest">
                {screenshots.length === 0 ? (
                    <div className="py-32 flex flex-col items-center justify-center text-text-muted opacity-40">
                        <Camera className="w-16 h-16 mb-6" />
                        <h3 className="text-2xl font-black text-text-primary tracking-tighter mb-2">No Visual Artifacts</h3>
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] font-mono">Registry is void of captured evidence for this period</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
                        {screenshots.map(ss => (
                            <div 
                                key={ss.id}
                                onClick={() => setEnlarged(ss)}
                                className="group relative rounded-[32px] overflow-hidden glass border border-black/[0.05] hover:border-primary/50 transition-all aspect-video cursor-pointer shadow-xl hover:shadow-primary/10"
                            >
                                <img 
                                    src={ss.file_url} 
                                    alt="Surveillance Capture" 
                                    className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-5">
                                    <p className="text-[10px] font-black text-white tracking-[0.2em] uppercase mb-1.5 font-mono">
                                        {new Date(ss.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                    <div className="flex items-center gap-2.5 text-primary">
                                        <Maximize2 className="w-3.5 h-3.5" strokeWidth={3} />
                                        <span className="text-[9px] font-black uppercase tracking-[0.3em]">ANALYZE</span>
                                    </div>
                                </div>
                                <div className="absolute top-4 right-4 w-7 h-7 rounded-xl bg-white/40 backdrop-blur-md border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ShieldCheck className="w-4 h-4 text-emerald-500" strokeWidth={2.5} />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {/* Lightbox / Neural Analysis */}
            {enlarged && (
                <div 
                    className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-8 backdrop-blur-3xl animate-in fade-in duration-500 cursor-zoom-out" 
                    onClick={() => setEnlarged(null)}
                >
                    <div className="max-w-7xl w-full relative group" onClick={e => e.stopPropagation()}>
                        <div className="absolute -top-20 left-0 right-0 flex justify-between items-center animate-in slide-in-from-bottom-4 duration-700">
                            <div>
                                <h2 className="text-3xl font-black text-text-primary tracking-tighter leading-none mb-2">Visual Evidence Analysis</h2>
                                <p className="text-[11px] font-black uppercase tracking-[0.3em] text-primary font-mono bg-primary/5 px-3 py-1 rounded-lg border border-primary/10 inline-block">Registry: {enlarged.id} • Auth Code: {enlarged.session_id.slice(0, 8)}</p>
                            </div>
                            <button onClick={() => setEnlarged(null)} className="p-5 bg-white/40 border border-white/20 hover:bg-white rounded-[24px] shadow-xl transition-all group/close">
                                <X className="w-7 h-7 text-text-primary group-hover/close:rotate-90 transition-transform" strokeWidth={3} />
                            </button>
                        </div>
                        
                        <div className="relative rounded-[48px] overflow-hidden border border-white/40 shadow-2xl animate-in zoom-in-95 duration-500">
                            <img src={enlarged.file_url} alt="Full Registry Evidence" className="w-full h-auto" />
                            <div className="absolute bottom-12 left-12 p-8 glass border border-white/40 rounded-[36px] backdrop-blur-3xl animate-in slide-in-from-left-8 duration-1000 delay-300 shadow-xl">
                                <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 rounded-[20px] bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                                        <Clock className="w-6 h-6 text-primary" strokeWidth={2.5} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-1.5 font-mono">Capture Timestamp</p>
                                        <p className="text-2xl font-black text-text-primary tracking-tighter leading-none">{new Date(enlarged.recorded_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <p className="text-text-primary/10 text-[11px] font-black uppercase tracking-[1em] text-center mt-12 animate-pulse font-mono">
                            NEURAL REGISTRY SYNC: ACTIVE
                        </p>
                    </div>
                </div>
            )}
        </PageLayout>
    );
}

function FilterSelect({ icon, value, onChange, options }: { icon: React.ReactNode; value: string; onChange: (val: string) => void; options: { id: string; name: string }[] }) {
    const activeLabel = options.find(o => o.id === value)?.name || value;
    
    return (
        <div className="relative group/select">
            <div className="flex items-center gap-3.5 glass border border-black/[0.05] rounded-2xl px-5 py-3 shadow-xl transition-all group-hover/select:border-primary/50 cursor-pointer shadow-black/[0.02]">
                <div className="text-primary group-hover/select:scale-110 transition-transform">{icon}</div>
                <span className="text-[10px] font-black text-text-primary uppercase tracking-[0.2em] min-w-[140px] font-mono">{activeLabel}</span>
                <ChevronDown className="w-4 h-4 text-text-muted group-hover/select:text-text-primary transition-all group-hover/select:rotate-180" strokeWidth={3} />
            </div>
            
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
            >
                {options.map(o => (
                    <option key={o.id} value={o.id} className="bg-white text-text-primary">{o.name}</option>
                ))}
            </select>
        </div>
    );
}

function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
        return (
            <div className="glass border border-primary/10 p-6 rounded-[32px] shadow-xl animate-in zoom-in-95 duration-200">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em] mb-4 border-b border-black/[0.03] pb-3 font-mono">{label}</p>
                <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-black text-text-primary tracking-tighter font-head">
                        {payload[0].value}%
                    </span>
                    <span className="text-[10px] font-black text-primary uppercase tracking-[0.2em] font-mono">Sequence Impact</span>
                </div>
            </div>
        );
    }
    return null;
}

function groupByApp(samples: ActivitySample[]) {
    const map: Record<string, number> = {};
    samples.forEach(s => { const app = s.app_name || 'System Kernel'; map[app] = (map[app] || 0) + 1; });
    const total = samples.length;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
        .map(([app, count]) => ({ app, count, percent: Math.round((count / total) * 100) }));
}
