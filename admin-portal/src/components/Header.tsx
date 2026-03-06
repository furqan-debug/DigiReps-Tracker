import { Bell, HelpCircle, Gift, Grid } from 'lucide-react';

export function Header() {
    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 w-full">
            <div className="flex items-center gap-4">
                {/* Placeholder for Breadcrumbs or Page Title */}
                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600">
                    <ClockIcon />
                    <span>02:44:15</span>
                </div>
            </div>

            <div className="flex items-center gap-4 text-slate-500">
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <HelpCircle className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <Bell className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <Gift className="w-5 h-5" />
                </button>
                <button className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <Grid className="w-5 h-5" />
                </button>

                <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-sm font-bold ml-2">
                    K
                </div>
            </div>
        </header>
    );
}

function ClockIcon() {
    return (
        <svg className="w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
        </svg>
    );
}
