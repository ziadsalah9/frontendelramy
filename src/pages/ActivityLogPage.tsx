import { useEffect, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, History, User as UserIcon } from 'lucide-react';
import { activityLogsService } from '@/api/activityLogs';
import { usersService } from '@/api/users';
import { extractApiError } from '@/api/client';
import type { ActivityAction, ActivityEntity, ActivityLogEntry } from '@/types';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '@/components/shared/States';
import { SearchInput, Badge } from '@/components/shared/DataTable';
import { formatDate } from '@/utils/format';

type BadgeVariant = 'default' | 'success' | 'warning' | 'destructive' | 'info';

const ACTIONS: Record<ActivityAction, { label: string; variant: BadgeVariant }> = {
  CREATE: { label: 'إضافة', variant: 'success' },
  UPDATE: { label: 'تعديل', variant: 'info' },
  DELETE: { label: 'حذف', variant: 'destructive' },
  STATUS: { label: 'تغيير الحالة', variant: 'warning' },
  PRICE: { label: 'تسعير', variant: 'info' },
  STOCK: { label: 'مخزون', variant: 'default' },
  IMPORT: { label: 'استيراد', variant: 'success' },
  COMPLETE: { label: 'إكمال', variant: 'success' },
};

const ENTITIES: Record<ActivityEntity, string> = {
  PRODUCT: 'منتج',
  PRODUCT_DRAFT: 'منتج غير مكتمل',
  STOCKTAKE: 'جرد',
  SALES_RETURN: 'مرتجع',
  CUSTOMER_PAYMENT: 'تحصيل',
  SETTINGS: 'الإعدادات',
  SUPPLIER: 'مورد',
  EXPENSE: 'مصروف',
  INSTALLMENT: 'تقسيط',
  SALES_INVOICE: 'فاتورة بيع',
  PURCHASE_INVOICE: 'فاتورة شراء',
  CUSTOMER: 'عميل',
  USER: 'مستخدم',
  BRANCH: 'فرع',
  CASH_CLOSING: 'إغلاق كاش',
};

const PAGE_SIZE = 30;

const selectCls = 'h-10 px-3 rounded-lg border border-input bg-background text-sm';

export default function ActivityLogPage() {
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState('');
  const [entityType, setEntityType] = useState<ActivityEntity | ''>('');
  const [action, setAction] = useState<ActivityAction | ''>('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(0);

  // Search on the server once typing pauses.
  useEffect(() => {
    const t = setTimeout(() => { setQ(search.trim()); setPage(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const users = useQuery({ queryKey: ['users'], queryFn: usersService.getAll });

  const filters = {
    userId: userId ? Number(userId) : undefined,
    entityType: entityType || undefined,
    action: action || undefined,
    from: fromDate || undefined,
    to: toDate || undefined,
    q: q || undefined,
    page,
    size: PAGE_SIZE,
  };
  const logs = useQuery({
    queryKey: ['activity-logs', filters],
    queryFn: () => activityLogsService.search(filters),
    placeholderData: keepPreviousData,
  });

  const hasFilters = !!(userId || entityType || action || fromDate || toDate || search);
  const clearFilters = () => {
    setUserId(''); setEntityType(''); setAction(''); setFromDate(''); setToDate(''); setSearch(''); setQ(''); setPage(0);
  };
  const onFilter = <T,>(set: (v: T) => void) => (v: T) => { set(v); setPage(0); };

  const data = logs.data;
  const totalPages = data?.totalPages ?? 0;

  return (
    <div>
      <PageHeader title="سجل النشاط" description="كل التغييرات في النظام: من قام بها، ومتى، وماذا تغيّر" />

      <div className="flex flex-col gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث في الوصف أو اسم العنصر..." />
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="المستخدم" value={userId} onChange={(e) => onFilter(setUserId)(e.target.value)} className={selectCls}>
            <option value="">كل المستخدمين</option>
            {users.data?.map((u) => <option key={u.id} value={u.id}>{u.fullName || u.username}</option>)}
          </select>
          <select aria-label="القسم" value={entityType} onChange={(e) => onFilter(setEntityType)(e.target.value as ActivityEntity | '')} className={selectCls}>
            <option value="">كل الأقسام</option>
            {(Object.keys(ENTITIES) as ActivityEntity[]).map((k) => <option key={k} value={k}>{ENTITIES[k]}</option>)}
          </select>
          <select aria-label="نوع العملية" value={action} onChange={(e) => onFilter(setAction)(e.target.value as ActivityAction | '')} className={selectCls}>
            <option value="">كل العمليات</option>
            {(Object.keys(ACTIONS) as ActivityAction[]).map((k) => <option key={k} value={k}>{ACTIONS[k].label}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <label htmlFor="log-from" className="text-sm text-muted-foreground whitespace-nowrap">من</label>
            <input id="log-from" type="date" value={fromDate} max={toDate || undefined} onChange={(e) => onFilter(setFromDate)(e.target.value)} className={selectCls} />
            <label htmlFor="log-to" className="text-sm text-muted-foreground whitespace-nowrap">إلى</label>
            <input id="log-to" type="date" value={toDate} min={fromDate || undefined} onChange={(e) => onFilter(setToDate)(e.target.value)} className={selectCls} />
          </div>
          {hasFilters && (
            <button type="button" onClick={clearFilters} className="text-sm text-primary hover:underline whitespace-nowrap">مسح الفلاتر</button>
          )}
        </div>
      </div>

      {logs.isLoading ? (
        <LoadingState />
      ) : logs.error ? (
        <ErrorState message={extractApiError(logs.error).message} />
      ) : !data || data.content.length === 0 ? (
        <EmptyState
          title={hasFilters ? 'لا توجد نتائج مطابقة' : 'لا يوجد نشاط بعد'}
          description={hasFilters ? 'جرّب تغيير الفلاتر' : 'ستظهر هنا كل عملية إضافة أو تعديل أو حذف'}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground mb-2">{data.totalElements} عملية</p>
          <ul className={`space-y-2 transition-opacity ${logs.isFetching ? 'opacity-60' : ''}`}>
            {data.content.map((entry) => <ActivityItem key={entry.id} entry={entry} />)}
          </ul>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                type="button"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="h-9 px-3 inline-flex items-center gap-1 rounded-lg border border-input bg-background text-sm hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
              >
                <ChevronRight className="w-4 h-4" /> الأحدث
              </button>
              <span className="text-sm text-muted-foreground">صفحة {page + 1} من {totalPages}</span>
              <button
                type="button"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-9 px-3 inline-flex items-center gap-1 rounded-lg border border-input bg-background text-sm hover:bg-accent disabled:opacity-40 disabled:pointer-events-none"
              >
                الأقدم <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ActivityItem({ entry }: { entry: ActivityLogEntry }) {
  const [open, setOpen] = useState(false);
  const meta = ACTIONS[entry.action] ?? { label: entry.action, variant: 'default' as const };
  const hasChanges = entry.changes.length > 0;
  const who = entry.userFullName || entry.username || 'النظام';

  return (
    <li className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={() => hasChanges && setOpen((o) => !o)}
        aria-expanded={hasChanges ? open : undefined}
        className={`w-full text-right p-3 sm:p-4 flex items-start gap-3 ${hasChanges ? 'hover:bg-accent/40 cursor-pointer' : 'cursor-default'} rounded-xl`}
      >
        <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <History className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant={meta.variant}>{meta.label}</Badge>
            <span className="text-xs text-muted-foreground">{ENTITIES[entry.entityType] ?? entry.entityType}</span>
          </div>
          <p className="text-sm font-medium text-foreground break-words">{entry.description}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><UserIcon className="w-3 h-3" />{who}</span>
            <span>{formatDate(entry.createdAt)}</span>
          </div>
        </div>
        {hasChanges && (
          <span className="text-xs text-primary inline-flex items-center gap-1 shrink-0 mt-1">
            {entry.changes.length} تغيير
            <ChevronDown className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} />
          </span>
        )}
      </button>

      {open && hasChanges && (
        <div className="px-3 pb-3 sm:px-4 sm:pb-4">
          <div className="overflow-x-auto border rounded-lg">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-2 font-medium">الحقل</th>
                  <th className="text-right p-2 font-medium">قبل</th>
                  <th className="text-right p-2 font-medium">بعد</th>
                </tr>
              </thead>
              <tbody>
                {entry.changes.map((c, i) => (
                  <tr key={i} className="border-t align-top">
                    <td className="p-2 font-medium whitespace-nowrap">{c.field}</td>
                    <td className="p-2 text-destructive/90 whitespace-pre-wrap break-words">{c.before ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-2 text-success whitespace-pre-wrap break-words">{c.after ?? <span className="text-muted-foreground">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </li>
  );
}
