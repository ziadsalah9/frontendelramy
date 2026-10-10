import { useEffect } from 'react';
import { useProductTypeOptions } from '@/hooks/useProductTypes';
import { ALL_TYPES, NO_TYPE } from '@/utils/typeTabs';

/**
 * Filter tabs by product type: "الكل", then the types that have rows, in
 * the order of the Settings list (hidden or unknown types last), each with
 * its count. Scrolls sideways on narrow screens.
 */
export function TypeTabs({ types, value, onChange, idPrefix = 'type-tab' }: {
  /** The type of every row in the list (null = no type). */
  types: (string | null | undefined)[];
  value: string;
  onChange: (tab: string) => void;
  idPrefix?: string;
}) {
  const { options } = useProductTypeOptions();
  const counts = new Map<string, number>();
  let none = 0;
  for (const t of types) {
    if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
    else none++;
  }
  const ordered = [
    ...options.map((o) => o.value).filter((t) => counts.has(t)),
    ...[...counts.keys()].filter((t) => !options.some((o) => o.value === t)).sort((a, b) => a.localeCompare(b, 'ar')),
  ];
  const tabs = [
    { key: ALL_TYPES, label: 'الكل', count: types.length },
    ...ordered.map((t) => ({ key: t, label: t, count: counts.get(t) ?? 0 })),
    ...(none > 0 ? [{ key: NO_TYPE, label: 'بدون نوع', count: none }] : []),
  ];
  // A tab whose rows all went away (e.g. after a search) goes back to "الكل",
  // in the page's state too, so the list is never filtered by a hidden tab.
  const valid = tabs.some((t) => t.key === value);
  useEffect(() => {
    if (!valid) onChange(ALL_TYPES);
  }, [valid, onChange]);
  const current = valid ? value : ALL_TYPES;

  return (
    <div className="-mx-1 overflow-x-auto pb-1" role="tablist" aria-label="تصفية حسب النوع">
      <div className="flex gap-1.5 px-1 w-max">
        {tabs.map((t) => {
          const on = t.key === current;
          return (
            <button key={t.key} id={`${idPrefix}-${t.key}`} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.key)}
              className={`flex items-center gap-1.5 h-9 px-3 rounded-full border text-sm whitespace-nowrap transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-card hover:bg-accent'}`}>
              {t.label}
              <span className={`min-w-[1.25rem] px-1.5 rounded-full text-[11px] font-semibold ${on ? 'bg-black/25' : 'bg-muted text-muted-foreground'}`}>{t.count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
