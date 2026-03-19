import type { ButtonHTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    children: ReactNode;
    /** Optional left icon */
    leftIcon?: ReactNode;
    /** Optional right icon */
    rightIcon?: ReactNode;
    /** Show loading spinner */
    loading?: boolean;
    className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:
        'bg-gradient-to-br from-[#506ef8] to-[#3d59e0] text-white shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]',
    secondary:
        'glass text-text-primary hover:bg-white/40 border-border shadow-sm',
    ghost:
        'bg-transparent text-text-secondary hover:bg-black/5 hover:text-text-primary',
    danger:
        'bg-rose-500/10 text-rose-600 border border-rose-500/20 hover:bg-rose-500/20',
};

export function Button({
    variant = 'primary',
    children,
    leftIcon,
    rightIcon,
    loading,
    className,
    disabled,
    type = 'button',
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled || loading}
            className={clsx(
                'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 disabled:pointer-events-none',
                variantClasses[variant],
                className
            )}
            {...rest}
        >
            {loading ? (
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin shrink-0" />
            ) : leftIcon && (
                <span className="shrink-0">{leftIcon}</span>
            )}
            {children}
            {rightIcon && !loading && <span className="shrink-0">{rightIcon}</span>}
        </button>
    );
}
