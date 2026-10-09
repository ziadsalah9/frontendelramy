/** "من / إلى" day inputs used by the list screens (see useDateRange). */
export function DateRangeFilter({
  from,
  to,
  onFrom,
  onTo,
  onReset,
  showReset,
  idPrefix = 'range',
}: {
  from: string;
  to: string;
  onFrom: (v: string) => void;
  onTo: (v: string) => void;
  onReset?: () => void;
  showReset?: boolean;
  idPrefix?: string;
}) {
  const cls = 'h-10 px-3 rounded-lg border border-input bg-background text-sm';
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`${idPrefix}-from`} className="text-sm text-muted-foreground whitespace-nowrap">من</label>
      <input id={`${idPrefix}-from`} type="date" value={from} max={to || undefined} onChange={(e) => onFrom(e.target.value)} className={cls} />
      <label htmlFor={`${idPrefix}-to`} className="text-sm text-muted-foreground whitespace-nowrap">إلى</label>
      <input id={`${idPrefix}-to`} type="date" value={to} min={from || undefined} onChange={(e) => onTo(e.target.value)} className={cls} />
      {showReset && onReset && (
        <button type="button" onClick={onReset} className="text-sm text-primary hover:underline whitespace-nowrap">هذا الشهر</button>
      )}
    </div>
  );
}
