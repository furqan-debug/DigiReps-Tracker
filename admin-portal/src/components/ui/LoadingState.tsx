import type { ReactNode } from 'react';

export interface LoadingStateProps {
    /** Optional message (default: "Loading…") */
    message?: string;
    /** Optional custom content (e.g. skeleton) instead of message */
    children?: ReactNode;
    /** Min height (default: h-48) */
    className?: string;
}

export function LoadingState({
    message = 'Loading…',
    children,
    className = 'min-h-[12rem]',
}: LoadingStateProps) {
    return (
        <div
            className={`flex flex-col items-center justify-center gap-2 text-text-muted text-sm ${className}`}
        >
            {children ?? (
                <>
                    <div
                        className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin"
                        aria-hidden
                    />
                    <span>{message}</span>
                </>
            )}
        </div>
    );
}
