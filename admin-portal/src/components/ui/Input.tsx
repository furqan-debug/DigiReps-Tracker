import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    className?: string;
}

export function Input({
    label,
    error,
    className,
    id,
    ...rest
}: InputProps) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
        <div className="w-full">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 opacity-80"
                >
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={clsx(
                    'w-full bg-surface-subtle/50 border border-border rounded-md px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-inner',
                    error && 'border-rose-500/50 focus:ring-rose-500/20',
                    className
                )}
                {...rest}
            />
            {error && (
                <p className="mt-1.5 text-xs font-medium text-rose-400">{error}</p>
            )}
        </div>
    );
}
