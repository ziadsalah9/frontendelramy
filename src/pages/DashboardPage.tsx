import type { ComponentType, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Calculator, CalendarClock, PackagePlus, Receipt, TrendingUp, Wallet, PiggyBank, Boxes } from 'lucide-react';
import { dashboardService, type DashboardSummary } from '@/api/dashboard';
import { extractApiError } from '@/api/client';
import { LoadingState, EmptyState } from '@/components/shared/States';
import { formatDate, formatCurrency } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import { productsService } from '@/api/products';

const money = (v: number) => `${formatCurrency(v)} ج.م`;
const WEEKDAY = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'short' });
const LONG_DATE = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

function Kpi({ icon: Icon, label, value, hint, to, tone }: {
  icon: ComponentType<{ className?: string }>; label: string; value: string; hint?: ReactNode; to: string; tone: string;
}) {
  return (
    <Link to={to} className="group flex flex-col gap-2 bg-card border rounded-xl p-3.5 sm:p-4 hover:shadow-md hover:border-primary/30 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-center justify-between">
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${tone}`}><Icon className="w-[18px] h-[18px]" /></span>
        <ArrowLeft className="w-4 h-4 text-muted-foreground/60 group-hover:text-primary group-hover:-translate-x-0.5 transition-all" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg sm:text-xl font-bold text-foreground leading-tight">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground -mt-1">{hint}</p>}
    </Link>
  );
}

function Alert({ tone, children, action }: { tone: 'warning' | 'destructive'; children: ReactNode; action: ReactNode }) {
  const cls = tone === 'warning' ? 'bg-warning/10 border-warning/30' : 'bg-destructive/10 border-destructive/30';
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border text-sm ${cls}`}>
      <span className="flex items-center gap-2"><AlertTriangle className={`w-4 h-4 shrink-0 ${tone === 'warning' ? 'text-warning' : 'text-destructive'}`} />{children}</span>
      {action}
    </div>
  );
}

/** Last 7 days of sales as bars; today is the leftmost (RTL reads right to left, oldest first). */
function WeekChart({ days }: { days: DashboardSummary['last7Days'] }) {
  const max = Math.max(1, ...days.map((d) => d.total));
  const total = days.reduce((s, d) => s + d.total, 0);
  return (
    <section className="bg-card border rounded-xl p-4">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="font-semibold text-foreground">مبيعات آخر 7 أيام</h3>
        <span className="text-sm text-muted-foreground">{money(total)}</span>
      </div>
      <div className="flex items-end gap-2 h-36" role="img" aria-label={`مبيعات آخر 7 أيام: ${days.map((d) => `${WEEKDAY.format(new Date(d.date))} ${formatCurrency(d.total)}`).join('، ')}`}>
        {days.map((d, i) => {
          const isToday = i === days.length - 1;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end" title={`${d.date}: ${money(d.total)} · ${d.count} فاتورة`}>
              <span className="text-[10px] text-muted-foreground">{d.total > 0 ? formatCurrency(Math.round(d.total)) : ''}</span>
              <div className={`w-full max-w-[2.5rem] rounded-t-md ${isToday ? 'bg-primary' : 'bg-primary/35'}`} style={{ height: `${Math.max(d.total > 0 ? 6 : 2, (d.total / max) * 100)}%` }} />
              <span className={`text-[11px] ${isToday ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>{isToday ? 'اليوم' : WEEKDAY.format(new Date(d.date))}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Home: what matters today - sales, profit, the drawer, collections and stock - and the next actions. */
export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.get, refetchInterval: 60_000 });
  // Same cached query as the layout's low-stock warning (read only: no second toast).
  const { data: lowStock } = useQuery({ queryKey: ['low-stock'], queryFn: productsService.getLowStock });
  const lowStockCount = lowStock?.length ?? 0;

  if (isLoading) return <LoadingState />;

  const actions = [
    { label: 'تحصيل قسط', icon: Wallet, onClick: () => navigate('/installments') },
    { label: 'إغلاق الكاش', icon: Calculator, onClick: () => navigate('/cash-closings') },
    ...(isAdmin ? [{ label: 'إضافة منتج', icon: PackagePlus, onClick: () => navigate('/products') }] : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مرحباً، {user?.fullName ?? ''}</h1>
          <p className="text-sm text-muted-foreground mt-1">{LONG_DATE.format(new Date())}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <button key={a.label} type="button" onClick={a.onClick}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border bg-card text-sm font-medium hover:bg-accent transition-colors">
              <a.icon className="w-4 h-4" />{a.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">تعذر تحميل الملخص: {extractApiError(error).message}</div>
      )}

      {data && (
        <>
          {(data.unclosedYesterday || data.dueInstallmentsCount > 0) && (
            <div className="space-y-2">
              {data.unclosedYesterday && (
                <Alert tone="destructive" action={<Link to="/cash-closings" className="text-sm font-medium text-primary hover:underline">إغلاق كاش أمس</Link>}>
                  كاش أمس لم يُغلق رغم وجود مبيعات.
                </Alert>
              )}
              {data.dueInstallmentsCount > 0 && (
                <Alert tone="warning" action={<Link to="/installments" className="text-sm font-medium text-primary hover:underline">عرض الأقساط</Link>}>
                  {data.dueInstallmentsCount} قسط مستحق حتى اليوم بقيمة {money(data.dueInstallmentsAmount)}.
                </Alert>
              )}
            </div>
          )}

          {/* 2 per row on phones; an odd last card takes the whole row. */}
          <div className={`grid grid-cols-2 gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <Kpi icon={TrendingUp} label="مبيعات اليوم" value={money(data.todaySalesTotal)} hint={`${data.todaySalesCount} فاتورة`} to="/sales-invoices" tone="bg-success/10 text-success" />
            {isAdmin && data.todayProfit != null && (
              <Kpi icon={PiggyBank} label="ربح اليوم" value={money(data.todayProfit)} hint="بعد التكلفة والمصروفات" to="/reports" tone={data.todayProfit < 0 ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'} />
            )}
            <Kpi icon={Calculator} label="الكاش المتوقع في الدرج" value={money(data.expectedCash)}
              hint={data.cashClosedToday ? 'تم إغلاق كاش اليوم' : 'لم يُغلق بعد'} to="/cash-closings" tone="bg-chart-3/10 text-chart-3" />
            <Kpi icon={CalendarClock} label="أقساط مستحقة" value={money(data.dueInstallmentsAmount)} hint={`${data.dueInstallmentsCount} قسط`} to="/installments"
              tone={data.dueInstallmentsCount > 0 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'} />
            <Kpi icon={Boxes} label="مخزون منخفض" value={String(lowStockCount)} hint={lowStockCount > 0 ? 'منتج يحتاج طلب' : 'كل المخزون جيد'} to="/products"
              tone={lowStockCount > 0 ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground'} />
          </div>

          <div className="grid gap-4 lg:grid-cols-5">
            <div className="lg:col-span-2"><WeekChart days={data.last7Days} /></div>
            <section className="lg:col-span-3 bg-card border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b">
                <h3 className="flex items-center gap-2 font-semibold text-foreground"><Receipt className="w-4 h-4 text-primary" />أحدث فواتير البيع</h3>
                <Link to="/sales-invoices" className="text-sm text-primary hover:underline">عرض الكل</Link>
              </div>
              {data.recentSales.length === 0 ? (
                <EmptyState title="لا توجد فواتير بعد" description="ستظهر هنا أحدث الفواتير بمجرد إنشائها" />
              ) : (
                <ul className="divide-y">
                  {data.recentSales.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{inv.customerName ?? 'عميل'}</p>
                        <p className="text-xs text-muted-foreground"><span dir="ltr" className="font-mono">{inv.invoiceNumber}</span> · {formatDate(inv.createdAt)}</p>
                      </div>
                      <div className="text-left shrink-0">
                        <p className="text-sm font-bold text-foreground">{money(inv.total)}</p>
                        {inv.remaining > 0 && <p className="text-[11px] text-destructive">متبقي {formatCurrency(inv.remaining)}</p>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
