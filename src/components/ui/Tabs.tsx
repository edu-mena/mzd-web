import { useState } from 'react';
import type { ReactNode } from 'react';
import clsx from 'clsx';

export default function Tabs({
  tabs,
  defaultTab,
}: {
  tabs: { id: string; label: string; content: ReactNode; badge?: number }[];
  defaultTab?: string;
}) {
  const [active, setActive] = useState(defaultTab ?? tabs[0].id);
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div>
      <div className="no-print flex gap-1 overflow-x-auto border-b border-zinc-200 px-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={clsx(
              'relative flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-semibold transition-colors',
              active === t.id ? 'text-mzd-red' : 'text-mzd-gray hover:text-mzd-black'
            )}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold text-mzd-black">{t.badge}</span>
            )}
            {active === t.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-mzd-red" />}
          </button>
        ))}
      </div>
      <div className="pt-4">{activeTab.content}</div>
    </div>
  );
}
