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
      <div role="tablist" className="no-print flex gap-5 overflow-x-auto border-b border-linha">
        {tabs.map((t) => {
          const ativo = activeTab.id === t.id;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={ativo}
              onClick={() => setActive(t.id)}
              className={clsx(
                'relative -mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1 text-sm font-semibold transition-colors',
                ativo ? 'border-mzd-black text-mzd-black' : 'border-transparent text-mzd-gray hover:text-mzd-black'
              )}
            >
              {t.label}
              {t.badge !== undefined && t.badge > 0 && (
                <span className="num rounded bg-zinc-100 px-1.5 py-px text-[10.5px] font-semibold text-mzd-gray">{t.badge}</span>
              )}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-5">{activeTab.content}</div>
    </div>
  );
}
