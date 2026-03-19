import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface PageLayoutProps {
    title?: string;
    description?: string;
    children: ReactNode;
    /** Max width: '7xl' (1280px) default, or 'full' for no max */
    maxWidth?: '7xl' | '6xl' | 'full';
    /** Optional actions (e.g. buttons) to show next to title on desktop */
    actions?: ReactNode;
}

export function PageLayout({
    title,
    description,
    children,
    maxWidth = '7xl',
    actions,
}: PageLayoutProps) {
    const maxClass =
        maxWidth === '7xl' ? 'max-w-7xl' : maxWidth === '6xl' ? 'max-w-6xl' : '';

    return (
        <div className={clsx("p-8 md:p-12 mx-auto w-full animate-in fade-in slide-in-from-top-4 duration-700", maxClass)}>
            {(title || actions) && (
                <div className="mb-12 md:mb-16">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            {title && (
                                <h1 className="text-3xl md:text-4xl font-black text-text-primary tracking-tighter mb-4 leading-none">
                                    {title}
                                </h1>
                            )}
                            {description && (
                                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] max-w-2xl font-mono opacity-80">
                                    {description}
                                </p>
                            )}
                        </div>
                        {actions && (
                            <div className="flex items-center gap-4 shrink-0">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
