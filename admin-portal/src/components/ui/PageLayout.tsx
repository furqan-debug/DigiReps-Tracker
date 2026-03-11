import type { ReactNode } from 'react';

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
        <div className={`p-6 md:p-8 mx-auto w-full ${maxClass}`}>
            {(title || actions) && (
                <div className="mb-6 md:mb-8">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            {title && (
                                <h1 className="text-xl md:text-2xl font-semibold text-text-primary tracking-tight">
                                    {title}
                                </h1>
                            )}
                            {description && (
                                <p className="text-sm text-text-secondary mt-1">
                                    {description}
                                </p>
                            )}
                        </div>
                        {actions && (
                            <div className="flex items-center gap-2 shrink-0">
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
            )}
            {children}
        </div>
    );
}
