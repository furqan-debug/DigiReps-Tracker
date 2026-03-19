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
    className?: string;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary:
        'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:scale-[1.02] active:scale-[0.98]',
    secondary:
        'glass text-text-primary hover:bg-white/10 border-white/10',
    ghost:
        'bg-transparent text-text-secondary hover:bg-white/5 hover:text-text-primary',
    danger:
        'bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20',
};

export function Button({
    variant = 'primary',
    children,
    leftIcon,
    rightIcon,
    className,
    disabled,
    type = 'button',
    ...rest
}: ButtonProps) {
    return (
        <button
            type={type}
            disabled={disabled}
            className={clsx(
                'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-50 disabled:pointer-events-none',
                variantClasses[variant],
                className
            )}
            {...rest}
        >
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            {children}
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
        </button>
    );
}
