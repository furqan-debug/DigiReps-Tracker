import type { ReactNode } from 'react';
import clsx from 'clsx';

export interface KpiCardProps {
    icon: ReactNode;
    label: string;
    value: string;
    /** Optional subtitle (e.g. "tracked sessions") */
    sub?: string;
    /** Optional trend badge (e.g. "+12%") */
    trend?: string;
    /** Trend style: default (neutral), positive (green), negative (red) */
    trendVariant?: 'default' | 'positive' | 'negative';
}

export function KpiCard({
    icon,
    label,
    value,
    sub,
    trend,
    trendVariant = 'default',
}: KpiCardProps) {
    const trendClass =
        trendVariant === 'positive'
            ? 'bg-emerald-50 text-emerald-700 ring-emerald-500/10'
            : trendVariant === 'negative'
              ? 'bg-red-50 text-red-700 ring-red-500/10'
              : 'bg-surface-subtle text-text-secondary ring-border';

    return (
        <div className="bg-surface border border-border rounded-shell-lg shadow-shell-sm p-5 flex flex-col">
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-10 h-10 rounded-shell-md bg-surface-subtle border border-border flex items-center justify-center text-primary shrink-0">
                    {icon}
                </div>
                {trend && (
                    <span
                        className={clsx(
                            'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ring-1',
                            trendClass
                        )}
                    >
                        {trend}
                    </span>
                )}
            </div>
            <p className="text-xs font-medium text-text-muted uppercase tracking-wider">
                {label}
            </p>
            <p className="text-xl font-semibold text-text-primary tracking-tight mt-0.5">
                {value}
            </p>
            {sub && (
                <p className="text-xs text-text-muted mt-1">{sub}</p>
            )}
        </div>
    );
}
