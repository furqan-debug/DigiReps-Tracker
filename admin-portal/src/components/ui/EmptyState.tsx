import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
    /** Icon to show (default: Inbox) */
    icon?: ReactNode;
    title: string;
    description?: string;
    /** Optional action (e.g. button or link) */
    action?: ReactNode;
    /** Min height to reserve (e.g. h-48, h-64) */
    className?: string;
}

export function EmptyState({
    icon,
    title,
    description,
    action,
    className = '',
}: EmptyStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-3 text-center py-12 ${className}`}
        >
            <div className="w-12 h-12 rounded-shell-lg bg-surface-subtle border border-border flex items-center justify-center text-text-muted">
                {icon ?? <Inbox className="w-6 h-6" aria-hidden />}
            </div>
            <p className="text-sm font-medium text-text-primary">{title}</p>
            {description && (
                <p className="text-sm text-text-muted max-w-sm">{description}</p>
            )}
            {action && <div className="mt-1">{action}</div>}
        </div>
    );
}
