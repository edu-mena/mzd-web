import type { ReactNode } from 'react';
import clsx from 'clsx';
import { TrendingDown, TrendingUp } from 'lucide-react';

export default function StatTile({
  label,
  value,
  delta,
  deltaGood,
  icon,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaGood?: boolean;
  icon?: ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-card ring-1 ring-zinc-200/70">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-mzd-gray">{label}</span>
        {icon && <span className="text-mzd-red">{icon}</span>}
      </div>
      <div className="mt-2 flex items-end gap-2">
        <span className="text-2xl font-extrabold text-mzd-black">{value}</span>
        {delta && (
          <span
            className={clsx(
              'mb-1 inline-flex items-center gap-0.5 text-xs font-bold',
              deltaGood ? 'text-emerald-600' : 'text-mzd-red'
            )}
          >
            {deltaGood ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
            {delta}
          </span>
        )}
      </div>
      {hint && <p className="mt-1 text-xs text-mzd-gray">{hint}</p>}
    </div>
  );
}
