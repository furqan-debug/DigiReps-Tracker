import type { InputHTMLAttributes } from 'react';
import clsx from 'clsx';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    /** Optional icon on the left */
    leftIcon?: React.ReactNode;
    className?: string;
}

export function Input({
    label,
    error,
    leftIcon,
    className,
    id,
    ...rest
}: InputProps) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
        <div className="w-full group">
            {label && (
                <label
                    htmlFor={inputId}
                    className="block text-[11px] font-bold text-text-muted uppercase tracking-[0.15em] mb-2.5 ml-1 transition-colors group-focus-within:text-primary"
                >
                    {label}
                </label>
            )}
            <div className="relative group/input">
                {leftIcon && (
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center justify-center text-text-muted transition-colors group-focus-within/input:text-primary">
                        {leftIcon}
                    </div>
                )}
                <input
                    id={inputId}
                    className={clsx(
                        'w-full bg-black/[0.02] border border-black/[0.05] rounded-xl px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 focus:bg-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-black/[0.02]',
                        leftIcon && 'pl-11',
                        error && 'border-rose-500/50 focus:ring-rose-500/10 focus:border-rose-500/50',
                        className
                    )}
                    {...rest}
                />
            </div>
            {error && (
                <p className="mt-2 text-[11px] font-bold text-rose-600 ml-1 uppercase tracking-wider">{error}</p>
            )}
        </div>
    );
}
