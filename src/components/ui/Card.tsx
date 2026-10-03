import type { HTMLAttributes, ReactNode } from 'react';
import clsx from 'clsx';

/** Painel: superfície branca com linha fina, sem sombra. */
export function Card({ children, className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx('rounded-lg border border-linha bg-superficie', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-linha px-5 py-3.5">
      <div className="min-w-0">
        <h3 className="text-[13px] font-bold text-mzd-black">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-mzd-gray">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
