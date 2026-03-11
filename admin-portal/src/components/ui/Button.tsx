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
        'bg-primary text-white hover:bg-primary-hover focus-visible:ring-primary',
    secondary:
        'bg-surface border border-border text-text-primary hover:bg-surface-subtle focus-visible:ring-border',
    ghost:
        'bg-transparent text-text-secondary hover:bg-surface-subtle hover:text-text-primary focus-visible:ring-border',
    danger:
        'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
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
                'inline-flex items-center justify-center gap-2 px-4 py-2 rounded-shell-md text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-50 disabled:pointer-events-none',
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
