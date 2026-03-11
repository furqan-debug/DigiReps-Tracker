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
                    className="block text-sm font-medium text-text-primary mb-1.5"
                >
                    {label}
                </label>
            )}
            <input
                id={inputId}
                className={clsx(
                    'w-full bg-surface border border-border rounded-shell-md px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:cursor-not-allowed',
                    error && 'border-red-500 focus-visible:ring-red-500',
                    className
                )}
                {...rest}
            />
            {error && (
                <p className="mt-1 text-sm text-red-600">{error}</p>
            )}
        </div>
    );
}
