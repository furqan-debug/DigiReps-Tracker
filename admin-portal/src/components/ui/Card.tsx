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
                'glass rounded-[32px] overflow-hidden relative group transition-all duration-700 hover:shadow-xl hover:shadow-[#293d63]/5 hover:border-[#506ef8]/20',
                !noPadding && 'p-8 md:p-10',
                className
            )}
        >
            {title && (
                <div className="flex items-center justify-between mb-8">
                    <h2 className="text-[11px] font-bold text-text-muted uppercase tracking-[0.2em] font-head opacity-80">
                        {title}
                    </h2>
                    <div className="h-px flex-1 bg-black/5 ml-6" aria-hidden />
                </div>
            )}
            <div className="relative z-10">
                {children}
            </div>
            {/* Subtle background glow for light mode */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#506ef8]/5 blur-[100px] rounded-full -mr-32 -mt-32 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#8b5cf6]/5 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-700 delay-150" />
        </div>
    );
}
