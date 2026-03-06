import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import clsx from 'clsx';
import {
    LayoutDashboard,
    Clock,
    Activity,
    Lightbulb,
    MapPin,
    FolderKanban,
    CalendarDays,
    FileText,
    Users,
    CircleDollarSign,
    AppWindow,
    Settings,
    ChevronDown,
    ChevronRight,
    Star,
    Zap
} from 'lucide-react';

// --- Data Structure strictly matching Hubstaff screenshots ---

type BadgeType = 'new' | 'bolt' | null;

interface NavChild {
    name: string;
    path: string;
    badge?: BadgeType;
}

interface NavGroup {
    name: string;
    icon: any;
    path?: string; // If it's a direct link (no children)
    children?: NavChild[];
}

const navStructure: NavGroup[] = [
    {
        name: 'Dashboard',
        icon: LayoutDashboard,
        path: '/'
    },
    {
        name: 'Timesheets',
        icon: Clock,
        children: [
            { name: 'View & edit', path: '/timesheets' },
            { name: 'Approvals', path: '/timesheets/approvals', badge: 'bolt' }
        ]
    },
    {
        name: 'Activity',
        icon: Activity,
        children: [
            { name: 'Screenshots', path: '/activity' },
            { name: 'Apps', path: '/activity/apps' },
            { name: 'URLs', path: '/url-tracking' }
        ]
    },
    {
        name: 'Insights',
        icon: Lightbulb, // Using Lightbulb as closest match to their distinct icon
        children: [
            { name: 'Highlights', path: '/insights/highlights' },
            { name: 'Performance', path: '/insights/performance' },
            { name: 'Timeline', path: '/member-timeline', badge: 'new' },
            { name: 'Unusual activity', path: '/insights/unusual' },
            { name: 'Smart notifications', path: '/insights/notifications' },
            { name: 'Output', path: '/insights/output' }
        ]
    },
    {
        name: 'Locations',
        icon: MapPin,
        children: [
            { name: 'Map', path: '/locations' },
            { name: 'Job sites', path: '/locations/job-sites' }
        ]
    },
    {
        name: 'Project management',
        icon: FolderKanban,
        children: [
            { name: 'Projects', path: '/projects' },
            { name: 'To-dos', path: '/projects/todos' },
            { name: 'Clients', path: '/projects/clients' }
        ]
    },
    {
        name: 'Calendar',
        icon: CalendarDays,
        children: [
            { name: 'View calendar', path: '/calendar' },
            { name: 'Schedules', path: '/schedules' },
            { name: 'Time off requests', path: '/calendar/requests' }
        ]
    },
    {
        name: 'Reports',
        icon: FileText,
        children: [
            { name: 'Time & activity', path: '/reports', badge: 'new' },
            { name: 'Time & activity (Legacy)', path: '/reports/legacy' },
            { name: 'Daily totals (Weekly)', path: '/reports/daily' },
            { name: 'Amounts owed', path: '/reports/owed' },
            { name: 'Payments', path: '/reports/payments' },
            { name: 'All reports', path: '/reports/all' },
            { name: 'Customized reports', path: '/reports/custom', badge: 'bolt' }
        ]
    },
    {
        name: 'People',
        icon: Users,
        children: [
            { name: 'Members', path: '/people' },
            { name: 'Teams', path: '/people/teams', badge: 'bolt' }
        ]
    },
    {
        name: 'Financials',
        icon: CircleDollarSign,
        children: [
            { name: 'Manage payroll', path: '/financials', badge: 'bolt' },
            { name: 'Create payments', path: '/financials/create' },
            { name: 'Past payments', path: '/financials/past' },
            { name: 'Invoices', path: '/financials/invoices' },
            { name: 'Expenses', path: '/financials/expenses' }
        ]
    },
    {
        name: 'Silent app',
        icon: AppWindow,
        children: [
            { name: 'How it works', path: '/silent/how-it-works' }
        ]
    },
    {
        name: 'Settings',
        icon: Settings,
        children: [
            { name: 'All settings', path: '/settings' },
            { name: 'Activity & tracking', path: '/settings/tracking' },
            { name: 'Integrations', path: '/settings/integrations' },
            { name: 'Billing', path: '/settings/billing' }
        ]
    }
];

export function Sidebar() {
    const location = useLocation();

    // State to track which top-level groups are expanded
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
    const [favoritesExpanded, setFavoritesExpanded] = useState(true);

    // Auto-expand groups based on the current active path
    useEffect(() => {
        const currentPath = location.pathname;
        const newExpanded = { ...expandedGroups };
        let changed = false;

        navStructure.forEach(group => {
            if (group.children) {
                const isChildActive = group.children.some(child => currentPath === child.path || currentPath.startsWith(child.path + '/'));
                if (isChildActive && !newExpanded[group.name]) {
                    newExpanded[group.name] = true;
                    changed = true;
                }
            }
        });

        if (changed) {
            setExpandedGroups(newExpanded);
        }
    }, [location.pathname]);

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
    };

    const renderBadge = (badge?: BadgeType) => {
        if (!badge) return null;
        if (badge === 'new') {
            return (
                <span className="flex items-center gap-1 bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-0.5 rounded-full ml-2 shrink-0">
                    <Zap className="w-2.5 h-2.5 fill-purple-700" /> New
                </span>
            );
        }
        if (badge === 'bolt') {
            return <Zap className="w-3.5 h-3.5 text-purple-600 ml-2 shrink-0 fill-purple-600" />;
        }
        return null;
    };

    return (
        <aside className="w-[260px] h-screen bg-[#f8fafc] border-r border-slate-200 flex flex-col shrink-0 sticky top-0 overflow-y-auto custom-scrollbar">
            {/* Logo Area */}
            <div className="px-5 py-4 flex items-center gap-2.5 mb-2 sticky top-0 bg-[#f8fafc] z-10">
                <div className="w-8 h-8 rounded shrink-0" style={{ background: 'conic-gradient(from 180deg at 50% 50%, #2A85FF 0deg, #0052CC 360deg)' }}>
                    {/* Simplified Hubstaff-like logo abstraction */}
                    <div className="w-full h-full flex items-center justify-center text-white">
                        <div className="w-4 h-4 border-2 border-white rounded-sm rotate-45" />
                    </div>
                </div>
                <span className="text-xl font-bold text-slate-800 tracking-tight">DigiReps</span>
            </div>

            <div className="px-3 pb-6 flex-1">
                {/* Favorites Section */}
                <div className="mb-4">
                    <button
                        onClick={() => setFavoritesExpanded(!favoritesExpanded)}
                        className="w-full flex items-center justify-between px-2 py-2 text-[13px] font-medium text-slate-700 hover:text-slate-900 transition-colors"
                    >
                        <div className="flex items-center gap-2.5">
                            <Star className="w-4 h-4 text-slate-400" />
                            Favorites (3)
                        </div>
                        {favoritesExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                    </button>

                    {favoritesExpanded && (
                        <div className="mt-1 ml-4 space-y-1">
                            <Link to="/insights/performance" className="block px-4 py-2 text-[13px] text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors">
                                Performance
                            </Link>
                            <Link to="/projects" className="block px-4 py-2 text-[13px] text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors">
                                Projects
                            </Link>
                            <Link to="/people" className="block px-4 py-2 text-[13px] text-slate-600 hover:text-slate-900 rounded-md hover:bg-slate-100 transition-colors">
                                Members
                            </Link>
                        </div>
                    )}
                </div>

                <div className="w-full h-px bg-slate-200/60 my-2" />

                {/* Main Navigation */}
                <nav className="space-y-0.5 mt-3">
                    {navStructure.map((group) => {
                        const hasChildren = group.children && group.children.length > 0;
                        const isExpanded = expandedGroups[group.name];
                        const isDirectlyActive = group.path && location.pathname === group.path;

                        // Check if any child is active to highlight the parent slightly even if collapsed (optional UI detail)
                        const isChildActive = hasChildren && group.children?.some(c => location.pathname === c.path);

                        return (
                            <div key={group.name} className="flex flex-col">
                                {hasChildren ? (
                                    <button
                                        onClick={() => toggleGroup(group.name)}
                                        className={clsx(
                                            'flex items-center justify-between px-2 py-2 rounded-md text-[13.5px] font-medium transition-colors group/btn',
                                            isChildActive && !isExpanded ? 'text-blue-700 font-semibold' : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <group.icon className={clsx("w-[18px] h-[18px]", isChildActive ? "text-blue-600" : "text-slate-400 group-hover/btn:text-slate-500")} strokeWidth={2} />
                                            {group.name}
                                        </div>
                                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                                    </button>
                                ) : (
                                    <Link
                                        to={group.path!}
                                        className={clsx(
                                            'flex items-center px-2 py-2 rounded-md text-[13.5px] font-medium transition-colors group/link',
                                            isDirectlyActive
                                                ? 'bg-blue-50 text-blue-700'
                                                : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100/80'
                                        )}
                                    >
                                        <div className="flex items-center gap-3">
                                            <group.icon className={clsx("w-[18px] h-[18px]", isDirectlyActive ? "text-blue-600" : "text-slate-400 group-hover/link:text-slate-500")} strokeWidth={2} />
                                            {group.name}
                                        </div>
                                    </Link>
                                )}

                                {/* Children Rendering */}
                                {hasChildren && isExpanded && (
                                    <div className="mt-1 pb-2 space-y-0.5 relative">
                                        {/* Left border line connecting children */}
                                        <div className="absolute left-[17px] top-0 bottom-2 w-px bg-slate-200" />

                                        {group.children!.map((child) => {
                                            const isActive = location.pathname === child.path;
                                            return (
                                                <Link
                                                    key={child.name}
                                                    to={child.path}
                                                    className={clsx(
                                                        'flex items-center justify-between ml-[30px] px-3 py-[7px] text-[13px] rounded-md transition-colors relative',
                                                        isActive
                                                            ? 'bg-slate-200/60 text-slate-900 font-medium'
                                                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                                                    )}
                                                >
                                                    {/* Active Indicator Bar matching Hubstaff */}
                                                    {isActive && (
                                                        <div className="absolute -left-[30px] top-0 bottom-0 w-[3px] bg-blue-600 rounded-r" />
                                                    )}

                                                    <span className="truncate">{child.name}</span>
                                                    {renderBadge(child.badge)}
                                                </Link>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </nav>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background-color: #cbd5e1;
                    border-radius: 20px;
                }
            `}</style>
        </aside>
    );
}
