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
                'glass rounded-lg shadow-lg',
                !noPadding && 'p-6',
                className
            )}
        >
            {title && (
                <h2 className="text-xs font-bold text-text-secondary uppercase tracking-[0.15em] mb-5 font-head opacity-80">
                    {title}
                </h2>
            )}
            {children}
        </div>
    );
}
