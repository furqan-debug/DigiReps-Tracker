import { MapPin, Plus, Construction } from 'lucide-react';

export function JobSites() {
    return (
        <div className="p-8 max-w-[1200px] mx-auto w-full fade-in">
            <div className="flex justify-between items-end mb-8 relative z-20">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 tracking-tight mb-2">Job Sites</h1>
                    <p className="text-slate-500">Manage geofenced locations where your team is allowed to track time.</p>
                </div>

                <div className="flex items-center gap-4">
                    <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                        <Plus className="w-4 h-4" />
                        Add Job Site
                    </button>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                    <Construction className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-2">No Job Sites Configured</h3>
                <p className="text-slate-500 max-w-md mx-auto mb-6">
                    Create geofenced job sites to automatically remind your team to start tracking time when they arrive, or restrict time tracking to certain physical locations.
                </p>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 justify-center">
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Location tracking must be enabled in the mobile app.</span>
                </div>
            </div>
        </div>
    );
}
