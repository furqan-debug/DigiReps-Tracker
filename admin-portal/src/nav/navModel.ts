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

export type Role = 'Admin' | 'Manager' | 'User' | 'Viewer';

export interface NavChild {
    name: string;
    path: string;
    badge?: BadgeType;
    allowedRoles?: Role[];
}

export interface NavGroup {
    name: string;
    icon: LucideIcon;
    path?: string;
    children?: NavChild[];
    allowedRoles?: Role[];
}

export const navStructure: NavGroup[] = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    {
        name: 'Timesheets',
        icon: Clock,
        children: [
            { name: 'View & edit', path: '/dashboard/timesheets' },
            { name: 'Approvals', path: '/dashboard/timesheets/approvals', badge: 'bolt', allowedRoles: ['Admin', 'Manager'] },
        ],
    },
    {
        name: 'Activity',
        icon: Activity,
        children: [
            { name: 'Screenshots', path: '/dashboard/activity' },
            { name: 'Apps', path: '/dashboard/activity/apps' },
            { name: 'URLs', path: '/dashboard/url-tracking' },
        ],
    },
    {
        name: 'Project management',
        icon: FolderKanban,
        allowedRoles: ['Admin', 'Manager', 'User', 'Viewer'],
        children: [
            { name: 'Projects', path: '/dashboard/projects' },
            { name: 'To-dos', path: '/dashboard/projects/todos' },
            { name: 'Clients', path: '/dashboard/projects/clients', allowedRoles: ['Admin', 'Manager', 'Viewer'] },
        ],
    },
    {
        name: 'Reports',
        icon: FileText,
        children: [
            { name: 'Time & activity', path: '/dashboard/reports', badge: 'new' },
            { name: 'Time & activity (Legacy)', path: '/dashboard/reports/legacy', allowedRoles: ['Admin'] },
            { name: 'Daily totals (Weekly)', path: '/dashboard/reports/daily' },
            { name: 'Amounts owed', path: '/dashboard/reports/owed', allowedRoles: ['Admin', 'Manager', 'Viewer'] },
            { name: 'Payments', path: '/dashboard/reports/payments', allowedRoles: ['Admin', 'Manager'] },
            { name: 'All reports', path: '/dashboard/reports/all', allowedRoles: ['Admin'] },
            { name: 'Customized reports', path: '/dashboard/reports/custom', badge: 'bolt', allowedRoles: ['Admin'] },
        ],
    },
    {
        name: 'People',
        icon: Users,
        allowedRoles: ['Admin', 'Manager'],
        children: [
            { name: 'Members', path: '/dashboard/people', allowedRoles: ['Admin'] },
            { name: 'Teams', path: '/dashboard/people/teams', badge: 'bolt' },
        ],
    },
    {
        name: 'Financials',
        icon: CircleDollarSign,
        allowedRoles: ['Admin'],
        children: [
            { name: 'Manage payroll', path: '/dashboard/financials', badge: 'bolt' },
            { name: 'Create payments', path: '/dashboard/financials/create' },
            { name: 'Past payments', path: '/dashboard/financials/past' },
            { name: 'Invoices', path: '/dashboard/financials/invoices' },
            { name: 'Expenses', path: '/dashboard/financials/expenses' },
        ],
    },
    {
        name: 'Silent app',
        icon: AppWindow,
        allowedRoles: ['Admin'],
        children: [{ name: 'How it works', path: '/dashboard/silent/how-it-works' }],
    },
    {
        name: 'Settings',
        icon: Settings,
        children: [
            { name: 'All settings', path: '/dashboard/settings', allowedRoles: ['Admin'] },
            { name: 'Activity & tracking', path: '/dashboard/settings/tracking', allowedRoles: ['Admin', 'Manager'] },
            { name: 'Billing', path: '/dashboard/settings/billing', allowedRoles: ['Admin'] },
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
