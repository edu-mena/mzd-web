import type { ReactNode } from 'react';
import clsx from 'clsx';

export function Card({ children, className, ...rest }: { children: ReactNode; className?: string; [k: string]: any }) {
  return (
    <div className={clsx('rounded-xl bg-white shadow-card ring-1 ring-zinc-200/70', className)} {...rest}>
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
      <div>
        <h3 className="text-sm font-bold text-mzd-black">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-mzd-gray">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
