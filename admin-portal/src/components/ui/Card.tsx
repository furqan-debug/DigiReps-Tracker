import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface CardProps {
    children: ReactNode;
    title?: string;
    className?: string;
    /** If true, card has no padding (for tables/charts that need full bleed) */
    noPadding?: boolean;
}

export function Card({
    children,
    title,
    className,
    noPadding = false,
}: CardProps) {
    return (
        <div
            className={clsx(
                'bg-surface border border-border rounded-shell-lg shadow-shell-sm',
                !noPadding && 'p-6',
                className
            )}
        >
            {title && (
                <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide mb-4">
                    {title}
                </h2>
            )}
            {children}
        </div>
    );
}
