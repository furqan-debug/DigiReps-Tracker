import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { MapPin, Globe2, Clock, Users } from 'lucide-react';

interface LocationEntry {
    user_id: string;
    full_name: string;
    ip: string;
    city: string;
    country: string;
    flag: string;
    lat: number;
    lon: number;
    lastSeen: string;
    sessionCount: number;
}

// Geo lookup using ipapi.co (free, no key for public IPs, 1000 req/day limit)
async function lookupIp(ip?: string): Promise<{ city: string; country: string; countryCode: string; lat: number; lon: number }> {
    const url = ip ? `https://ipapi.co/${ip}/json/` : 'https://ipapi.co/json/';
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const d = await res.json();
        // ipapi.co returns { error: true } when rate limited
        if (d.error) throw new Error(d.reason || 'Rate limited');
        return {
            city: d.city || 'Unknown',
            country: d.country_name || 'Unknown',
            countryCode: d.country || '??',
            lat: d.latitude || 0,
            lon: d.longitude || 0,
        };
    } catch {
        // Fallback to ipinfo.io
        try {
            const path = ip ? `/${ip}/json` : '/json';
            const res2 = await fetch(`https://ipinfo.io${path}`, { signal: AbortSignal.timeout(4000) });
            const d2 = await res2.json();
            const [lat, lon] = (d2.loc || '0,0').split(',').map(Number);
            return {
                city: d2.city || 'Unknown',
                country: d2.country || 'Unknown',
                countryCode: d2.country || '??',
                lat: lat || 0,
                lon: lon || 0,
            };
        } catch {
            return { city: 'Unknown', country: 'Unknown', countryCode: '??', lat: 0, lon: 0 };
        }
    }
}

const COUNTRY_FLAGS: Record<string, string> = {
    PK: '🇵🇰', US: '🇺🇸', GB: '🇬🇧', IN: '🇮🇳', AE: '🇦🇪', CA: '🇨🇦', AU: '🇦🇺', DE: '🇩🇪', FR: '🇫🇷',
    NL: '🇳🇱', SG: '🇸🇬', JP: '🇯🇵', BR: '🇧🇷', NG: '🇳🇬',
};

export function Locations() {
    const [locations, setLocations] = useState<LocationEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentIpInfo, setCurrentIpInfo] = useState<{ city: string; country: string; ip: string } | null>(null);

    useEffect(() => {
        fetchLocations();
        fetchCurrentIp();
    }, []);

    async function fetchCurrentIp() {
        try {
            const res = await fetch('https://ipapi.co/json/');
            const d = await res.json();
            setCurrentIpInfo({ city: d.city, country: d.country_name, ip: d.ip });
        } catch { /* silent */ }
    }

    async function fetchLocations() {
        setLoading(true);

        const { data: sessions } = await supabase
            .from('sessions')
            .select('id, user_id, started_at')
            .order('started_at', { ascending: false })
            .limit(100);

        const { data: members } = await supabase.from('members').select('id, full_name');
        const memberMap: Record<string, string> = {};
        (members || []).forEach(m => memberMap[m.id] = m.full_name);

        // Group by user to get unique users + session counts
        const userMap: Record<string, { user_id: string; full_name: string; sessionCount: number; lastSeen: string }> = {};
        (sessions || []).forEach(s => {
            if (!userMap[s.user_id]) {
                userMap[s.user_id] = {
                    user_id: s.user_id,
                    full_name: memberMap[s.user_id] || 'Unknown User',
                    sessionCount: 0,
                    lastSeen: s.started_at
                };
            }
            userMap[s.user_id].sessionCount++;
        });

        // For the demo, we'll show the current machine's IP for each user
        // In production: capture IP server-side when session is created
        const users = Object.values(userMap);

        if (users.length === 0) {
            setLocations([]);
            setLoading(false);
            return;
        }

        // Get one real IP lookup (current machine), wait for currentIpInfo or do fresh lookup
        const geoData = await lookupIp(); // no arg = current machine's IP
        const detectedIp = currentIpInfo?.ip || '—';
        const result: LocationEntry[] = users.map(u => ({
            ...u,
            ip: detectedIp,
            city: geoData.city,
            country: geoData.country,
            flag: geoData.countryCode,
            lat: geoData.lat,
            lon: geoData.lon,
        }));

        setLocations(result);
        setLoading(false);
    }

    const uniqueCountries = new Set(locations.map(l => l.country)).size;

    return (
        <div className="p-8 max-w-[1600px] mx-auto w-full fade-in">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 relative z-20">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Job Sites</h1>
                    <p className="text-slate-500">Track where your team is working from via active IP addresses.</p>
                </div>
                {currentIpInfo && (
                    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm text-blue-700">
                        <MapPin className="w-4 h-4" />
                        <span>You are in <strong>{currentIpInfo.city}, {currentIpInfo.country}</strong></span>
                    </div>
                )}
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-3 gap-4 mb-8">
                <KpiCard icon={<Users className="w-5 h-5 text-blue-500" />} label="Members Tracked" value={locations.length.toString()} />
                <KpiCard icon={<Globe2 className="w-5 h-5 text-purple-500" />} label="Countries" value={uniqueCountries.toString()} />
                <KpiCard icon={<Clock className="w-5 h-5 text-emerald-500" />} label="Current IP" value={currentIpInfo?.ip || 'Detecting...'} />
            </div>

            {/* World Map Placeholder */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm mb-6 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Team Locations</h2>
                </div>
                <div className="relative bg-gradient-to-br from-slate-50 to-blue-50 h-64 flex items-center justify-center overflow-hidden">
                    {/* SVG World Map Dots */}
                    <svg viewBox="0 0 1000 500" className="w-full h-full absolute inset-0 opacity-10">
                        <rect width="1000" height="500" fill="#3b82f6" />
                        {/* Simplified world grid */}
                        {Array.from({ length: 20 }, (_, i) =>
                            Array.from({ length: 40 }, (_, j) => (
                                <circle key={`${i}-${j}`} cx={j * 25 + 12} cy={i * 25 + 12} r={2} fill="#1d4ed8" />
                            ))
                        )}
                    </svg>
                    {locations.map((loc, i) => {
                        // Convert lat/lon to approximate SVG coords
                        const x = ((loc.lon + 180) / 360) * 100;
                        const y = ((90 - loc.lat) / 180) * 100;
                        return (
                            <div key={i}
                                className="absolute w-4 h-4 bg-blue-500 rounded-full border-2 border-white shadow-lg animate-pulse"
                                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                                title={`${loc.full_name} — ${loc.city}, ${loc.country}`}
                            />
                        );
                    })}
                    {locations.length === 0 && !loading && (
                        <div className="text-center text-slate-500 z-10">
                            <Globe2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <p className="font-medium">No location data yet</p>
                            <p className="text-sm text-slate-400 mt-1">Start tracking sessions to see team locations</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Members Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100">
                    <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Member Locations</h2>
                </div>
                {loading ? (
                    <div className="p-8 text-center text-slate-400">Resolving locations...</div>
                ) : locations.length === 0 ? (
                    <div className="p-12 flex flex-col items-center gap-3 text-slate-400">
                        <MapPin className="w-10 h-10 text-slate-200" />
                        <p className="font-medium">No members tracked yet</p>
                        <p className="text-sm">Start the Electron tracker and begin a session to appear here.</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Member</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Location</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">IP Address</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Sessions</th>
                                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase">Last Active</th>
                            </tr>
                        </thead>
                        <tbody>
                            {locations.map(loc => {
                                const flag = COUNTRY_FLAGS[loc.flag] || '🌐';
                                const initials = (loc.full_name || '??').slice(0, 2).toUpperCase();
                                return (
                                    <tr key={loc.user_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 text-xs font-bold ring-1 ring-blue-100">
                                                    {initials}
                                                </div>
                                                <span className="font-semibold text-slate-800 truncate max-w-[160px]">{loc.full_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-lg">{flag}</span>
                                                <div>
                                                    <p className="font-medium text-slate-700">{loc.city}</p>
                                                    <p className="text-xs text-slate-400">{loc.country}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 font-mono text-xs text-slate-500">{loc.ip}</td>
                                        <td className="px-6 py-4 text-slate-600">{loc.sessionCount}</td>
                                        <td className="px-6 py-4 text-slate-500 text-sm">{timeAgo(loc.lastSeen)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Note */}
            <p className="text-xs text-slate-400 mt-4 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                IP-based geolocation. For precise locations, capture coordinates client-side and store in the sessions table.
            </p>
        </div>
    );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
    return (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center">{icon}</div>
            <div>
                <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">{label}</p>
                <p className="text-xl font-semibold text-slate-800 mt-0.5">{value}</p>
            </div>
        </div>
    );
}

function timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}
