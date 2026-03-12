import type { LucideIcon } from 'lucide-react';
import {
    LayoutDashboard,
    Clock,
    Activity,
    FolderKanban,
    FileText,
    Users,
    CircleDollarSign,
    AppWindow,
    Settings,
} from 'lucide-react';

export type BadgeType = 'new' | 'bolt' | null;

export interface NavChild {
    name: string;
    path: string;
    badge?: BadgeType;
}

export interface NavGroup {
    name: string;
    icon: LucideIcon;
    path?: string;
    children?: NavChild[];
}

export const navStructure: NavGroup[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    {
        name: 'Timesheets',
        icon: Clock,
        children: [
            { name: 'View & edit', path: '/timesheets' },
            { name: 'Approvals', path: '/timesheets/approvals', badge: 'bolt' },
        ],
    },
    {
        name: 'Activity',
        icon: Activity,
        children: [
            { name: 'Screenshots', path: '/activity' },
            { name: 'Apps', path: '/activity/apps' },
            { name: 'URLs', path: '/url-tracking' },
        ],
    },
    {
        name: 'Project management',
        icon: FolderKanban,
        children: [
            { name: 'Projects', path: '/projects' },
            { name: 'To-dos', path: '/projects/todos' },
            { name: 'Clients', path: '/projects/clients' },
        ],
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
            { name: 'Customized reports', path: '/reports/custom', badge: 'bolt' },
        ],
    },
    {
        name: 'People',
        icon: Users,
        children: [
            { name: 'Members', path: '/people' },
            { name: 'Teams', path: '/people/teams', badge: 'bolt' },
        ],
    },
    {
        name: 'Financials',
        icon: CircleDollarSign,
        children: [
            { name: 'Manage payroll', path: '/financials', badge: 'bolt' },
            { name: 'Create payments', path: '/financials/create' },
            { name: 'Past payments', path: '/financials/past' },
            { name: 'Invoices', path: '/financials/invoices' },
            { name: 'Expenses', path: '/financials/expenses' },
        ],
    },
    {
        name: 'Silent app',
        icon: AppWindow,
        children: [{ name: 'How it works', path: '/silent/how-it-works' }],
    },
    {
        name: 'Settings',
        icon: Settings,
        children: [
            { name: 'All settings', path: '/settings' },
            { name: 'Activity & tracking', path: '/settings/tracking' },
            { name: 'Billing', path: '/settings/billing' },
        ],
    },
];

/**
 * Returns whether the current pathname matches the given item path (exact or prefix for nested routes).
 */
export function matchActive(pathname: string, itemPath: string): boolean {
    if (pathname === itemPath) return true;
    if (itemPath === '/') return false;
    return pathname.startsWith(itemPath + '/');
}

/**
 * Returns the display label for a given path by looking up in nav structure.
 * Used for Header page title and favorites; falls back to a formatted path segment.
 */
export function getLabelForPath(pathname: string): string {
    const normalized = pathname.replace(/\/$/, '') || '/';
    for (const group of navStructure) {
        if (group.path === normalized) return group.name;
        for (const child of group.children ?? []) {
            if (child.path === normalized) return child.name;
        }
    }
    const parts = pathname.split('/').filter(Boolean);
    if (parts.length === 0) return 'Dashboard';
    const last = parts[parts.length - 1] ?? '';
    return last.charAt(0).toUpperCase() + last.slice(1).replace(/-/g, ' ');
}
