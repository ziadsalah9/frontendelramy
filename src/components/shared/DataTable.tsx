import type { KeyboardEvent, MouseEvent, ReactNode } from 'react';
import { LoadingState, ErrorState, EmptyState } from './States';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  className?: string;
  /**
   * Phone layout (cards): 'title' heads the card (default: the first
   * column), 'hide' leaves it out, 'full' spans the card's width. The
   * 'actions' column always goes to the card's footer.
   */
  mobile?: 'title' | 'hide' | 'full';
}

const cell = <T,>(col: Column<T>, row: T): ReactNode =>
  col.render ? col.render(row) : (row as Record<string, unknown>)[col.key] as ReactNode;

/** Buttons and links inside a clickable row must not also open the row. */
const stop = (e: MouseEvent) => e.stopPropagation();

/**
 * A table on tablets and computers; on phones every row becomes a card
 * (title, then label/value pairs, actions at the bottom), so nothing is
 * hidden off-screen. Rows with {@code onRowClick} open on click or Enter.
 */
export function DataTable<T extends { id?: number | string }>({
  columns,
  data,
  loading,
  error,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onRowClick,
  rowLabel,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  error?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
  /** Accessible name of a clickable row, e.g. "فتح الفاتورة INV-1". */
  rowLabel?: (row: T) => string;
}) {
  if (loading) return <LoadingState />;
  if (error) return <ErrorState message={error} />;
  if (!data || data.length === 0)
    return <EmptyState title={emptyTitle ?? 'لا توجد بيانات'} description={emptyDescription} action={emptyAction} />;

  const isActions = (c: Column<T>) => c.key === 'actions';
  const titleCol = columns.find((c) => c.mobile === 'title') ?? columns.find((c) => !isActions(c) && c.mobile !== 'hide');
  const actionsCol = columns.find(isActions);
  // Full-width fields go last so the two-column grid above them stays even.
  const bodyCols = columns.filter((c) => c !== titleCol && !isActions(c) && c.mobile !== 'hide')
    .sort((a, b) => Number(a.mobile === 'full') - Number(b.mobile === 'full'));
  // Table rows stay rows (focusable, Enter opens them).
  const rowProps = (row: T) => onRowClick ? {
    onClick: () => onRowClick(row),
    onKeyDown: (e: KeyboardEvent) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); onRowClick(row); }
    },
    tabIndex: 0,
    'aria-label': rowLabel?.(row),
  } : {};

  return (
    <>
      {/* Tablets and computers */}
      <div className="hidden md:block border rounded-xl overflow-hidden bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                {columns.map((col) => (
                  <th key={col.key} className={`text-right font-semibold text-foreground px-4 py-3 whitespace-nowrap ${col.className ?? ''}`}>
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, i) => (
                <tr key={row.id ?? i} {...rowProps(row)}
                  className={`border-b last:border-0 hover:bg-muted/30 transition-colors ${onRowClick ? 'cursor-pointer focus-visible:outline-none focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring' : ''}`}>
                  {columns.map((col) => (
                    <td key={col.key} onClick={isActions(col) ? stop : undefined} className={`px-4 py-3 text-foreground ${col.className ?? ''}`}>
                      {cell(col, row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phones: one card per row */}
      <ul className="md:hidden space-y-2.5">
        {data.map((row, i) => (
          // A tap anywhere on the card opens it (mouse and touch); keyboard and screen readers
          // use the title, a real button, so no button sits inside another one.
          <li key={row.id ?? i} onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={`rounded-xl border bg-card p-3.5 ${onRowClick ? 'cursor-pointer active:bg-muted/40' : ''}`}>
            {titleCol && (onRowClick
              ? <button type="button" aria-label={rowLabel?.(row)} onClick={(e) => { e.stopPropagation(); onRowClick(row); }}
                  className="block w-full min-h-9 text-right font-semibold text-foreground mb-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{cell(titleCol, row)}</button>
              : <div className="font-semibold text-foreground mb-2">{cell(titleCol, row)}</div>)}
            {bodyCols.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                {bodyCols.map((col) => (
                  <div key={col.key} className={`min-w-0 ${col.mobile === 'full' ? 'col-span-2' : ''}`}>
                    <dt className="text-[11px] text-muted-foreground">{col.header}</dt>
                    <dd className="text-foreground break-words">{cell(col, row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            {actionsCol && (
              <div onClick={stop} className="mt-3 pt-2.5 border-t flex justify-end">{cell(actionsCol, row)}</div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'بحث...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative flex-1 max-w-sm">
      <svg
        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="w-full pr-10 pl-4 h-10 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all"
      />
    </div>
  );
}

export function Badge({ children, variant = 'default' }: { children: ReactNode; variant?: 'default' | 'success' | 'warning' | 'destructive' | 'info' }) {
  const variants = {
    default: 'bg-muted text-muted-foreground',
    success: 'bg-success/15 text-success border border-success/30',
    warning: 'bg-warning/15 text-warning border border-warning/30',
    destructive: 'bg-destructive/15 text-destructive border border-destructive/30',
    info: 'bg-primary/15 text-primary border border-primary/30',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-medium ${variants[variant]}`}>
      {children}
    </span>
  );
}

export function ActionButton({
  onClick,
  icon: Icon,
  label,
  variant = 'default',
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  variant?: 'default' | 'destructive';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`p-2 rounded-lg transition-colors ${
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-muted-foreground hover:bg-accent hover:text-foreground'
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
