import {
    LayoutDashboard,
    Clock,
    Activity,
    MapPin,
    FolderKanban,
    CalendarDays,
    BarChart3,
    Users,
    CircleDollarSign,
    Settings,
    Link2
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';

const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Timesheets', icon: Clock, path: '/timesheets' },
    { name: 'Activity', icon: Activity, path: '/activity' },
    { name: 'URL Tracking', icon: Link2, path: '/url-tracking' },
    { name: 'Locations', icon: MapPin, path: '/locations' },
    { name: 'Project Management', icon: FolderKanban, path: '/projects' },
    { name: 'Schedules', icon: CalendarDays, path: '/schedules' },
    { name: 'Reports', icon: BarChart3, path: '/reports' },
    { name: 'People', icon: Users, path: '/people' },
    { name: 'Financials', icon: CircleDollarSign, path: '/financials' },
    { name: 'Settings & Policies', icon: Settings, path: '/settings' },
];

export function Sidebar() {
    const location = useLocation();

    return (
        <aside className="w-64 h-screen bg-white border-r border-slate-200 flex flex-col shrink-0 sticky top-0">
            <div className="p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold">
                    D
                </div>
                <span className="text-xl font-bold text-slate-800 tracking-tight">DigiReps</span>
            </div>

            <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.name}
                            to={item.path}
                            className={clsx(
                                'flex items-center justify-between px-3 py-2.5 rounded-md text-sm font-medium transition-colors group',
                                isActive
                                    ? 'bg-blue-50 text-primary'
                                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <item.icon
                                    className={clsx(
                                        "w-5 h-5",
                                        isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600"
                                    )}
                                />
                                {item.name}
                            </div>
                        </Link>
                    );
                })}
            </nav>
        </aside>
    );
}
