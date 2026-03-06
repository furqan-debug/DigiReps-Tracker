import { Bell, HelpCircle, Gift, Grid, Star } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useFavorites } from '../context/FavoritesContext';

export function Header() {
    const location = useLocation();
    const { toggleFavorite, isFavorite } = useFavorites();

    // Map paths to descriptive names for favorites
    const getPageName = (path: string) => {
        if (path === '/') return 'Dashboard';
        if (path === '/activity') return 'Screenshots';
        if (path.startsWith('/activity/apps')) return 'Apps';
        if (path === '/url-tracking') return 'URLs';
        if (path === '/timesheets') return 'Timesheets';
        if (path === '/reports') return 'Time & activity';
        if (path === '/people') return 'Members';
        if (path === '/projects') return 'Projects';
        if (path === '/calendar') return 'Calendar';
        if (path === '/financials') return 'Financials';

        // Fallback: capitalize the last part of the path
        const parts = path.split('/').filter(Boolean);
        if (parts.length === 0) return 'Dashboard';
        const last = parts[parts.length - 1];
        return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
    };

    const pageName = getPageName(location.pathname);
    const favorited = isFavorite(location.pathname);

    return (
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 sticky top-0 z-10 w-full">
            <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-slate-700 ml-2">{pageName}</h2>
                <button
                    onClick={() => toggleFavorite(pageName, location.pathname)}
                    className="p-1.5 hover:bg-slate-50 rounded-lg group transition-colors"
                    title={favorited ? "Remove from favorites" : "Add to favorites"}
                >
                    <Star
                        className={`w-4 h-4 transition-all ${favorited
                            ? "fill-yellow-400 text-yellow-500 scale-110"
                            : "text-slate-300 group-hover:text-slate-400"
                            }`}
                    />
                </button>

                <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 ml-6">
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
