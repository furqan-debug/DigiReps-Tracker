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
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/10'
            : trendVariant === 'negative'
              ? 'bg-rose-500/10 text-rose-600 border-rose-500/10'
              : 'bg-black/5 text-text-muted border-black/5';

    return (
        <div className="glass rounded-3xl p-6 flex flex-col relative overflow-hidden group hover:shadow-xl hover:shadow-primary/5 transition-all duration-500 border border-black/[0.03]">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-2xl rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-colors" />
            
            <div className="flex items-start justify-between mb-5 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center text-primary shrink-0 group-hover:scale-110 group-hover:bg-primary/10 transition-all duration-500 shadow-sm">
                    {icon}
                </div>
                {trend && (
                    <span
                        className={clsx(
                            'text-[10px] font-black uppercase tracking-wider px-2.5 py-1.5 rounded-xl border backdrop-blur-md transition-transform duration-500 group-hover:-translate-x-1 font-mono',
                            trendClass
                        )}
                    >
                        {trend}
                    </span>
                )}
            </div>
            
            <div className="relative z-10">
                <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1.5 opacity-80">
                    {label}
                </p>
                <h3 className="text-3xl font-black text-text-primary tracking-tighter leading-none font-head">
                    {value}
                </h3>
                {sub && (
                    <div className="flex items-center gap-1.5 mt-3 opacity-80">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <p className="text-[10px] font-black uppercase tracking-widest text-text-muted">{sub}</p>
                    </div>
                )}
            </div>
        </div>
    );
}
