import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { TrendingUp, Wallet, Undo2, Percent, ShoppingCart, Users, AlertTriangle } from 'lucide-react';
import { reportsService } from '@/api/reports';
import { extractApiError } from '@/api/client';
import type { SalesReport } from '@/types';
import { PageHeader, LoadingState, ErrorState } from '@/components/shared/States';
import { formatCurrency, formatDate, getPaymentMethodLabel, todayLocalISO } from '@/utils/format';

type Preset = 'today' | 'week' | 'month' | 'lastMonth' | 'custom';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function rangeOf(p: Preset): [string, string] {
  const now = new Date();
  if (p === 'today') return [iso(now), iso(now)];
  if (p === 'week') {
    const start = new Date(now);
    start.setDate(now.getDate() - ((now.getDay() + 1) % 7)); // week starts on Saturday
    return [iso(start), iso(now)];
  }
  if (p === 'lastMonth') {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    return [iso(first), iso(last)];
  }
  return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), iso(now)];
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'today', label: 'اليوم' },
  { key: 'week', label: 'هذا الأسبوع' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'lastMonth', label: 'الشهر الماضي' },
  { key: 'custom', label: 'مخصص' },
];

/** Sales, profit, cash and stock figures for a period (ADMIN). */
export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('month');
  const [[from, to], setRange] = useState<[string, string]>(rangeOf('month'));
  const valid = from !== '' && to !== '' && from <= to;
  const report = useQuery({
    queryKey: ['reports', from, to],
    queryFn: () => reportsService.get(from, to),
    enabled: valid,
    placeholderData: keepPreviousData,
  });

  const choose = (p: Preset) => {
    setPreset(p);
    if (p !== 'custom') setRange(rangeOf(p));
  };

  const tabCls = (on: boolean) => `px-3 py-1.5 rounded-md text-sm font-medium transition-all whitespace-nowrap ${on ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="space-y-4">
      <PageHeader title="التقارير" description="المبيعات والأرباح والنقدية وحركة المخزون خلال فترة" />

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit max-w-full overflow-x-auto" role="tablist">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={preset === p.key} onClick={() => choose(p.key)} className={tabCls(preset === p.key)}>{p.label}</button>
          ))}
        </div>
        {preset === 'custom' && (
          <div className="flex items-center gap-2">
            <label htmlFor="rep-from" className="text-sm text-muted-foreground">من</label>
            <input id="rep-from" type="date" value={from} max={to || todayLocalISO()} onChange={(e) => setRange([e.target.value, to])} className="h-10 px-3 rounded-lg border border-input bg-background text-sm" />
            <label htmlFor="rep-to" className="text-sm text-muted-foreground">إلى</label>
            <input id="rep-to" type="date" value={to} min={from || undefined} max={todayLocalISO()} onChange={(e) => setRange([from, e.target.value])} className="h-10 px-3 rounded-lg border border-input bg-background text-sm" />
          </div>
        )}
      </div>

      {!valid ? <ErrorState message="اختر فترة صحيحة" />
        : report.isLoading ? <LoadingState />
        : report.error || !report.data ? <ErrorState message={extractApiError(report.error).message} />
        : <ReportBody r={report.data} fetching={report.isFetching} />}
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone = '' }: { icon: typeof TrendingUp; label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="p-4 rounded-xl border bg-card">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Icon className="w-3.5 h-3.5" /> {label}</p>
      <p className={`text-xl font-bold ${tone}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

function ReportBody({ r, fetching }: { r: SalesReport; fetching: boolean }) {
  const s = r.summary;
  const maxNet = Math.max(1, ...r.days.map((d) => Math.max(d.net, d.profit, 0)));
  const money = (v: number) => `${formatCurrency(v)} ج.م`;

  return (
    <div className={`space-y-4 transition-opacity ${fetching ? 'opacity-60' : ''}`}>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={TrendingUp} label="صافي المبيعات" value={money(s.netSales)} hint={`${s.invoiceCount} فاتورة · قبل الخصم ${formatCurrency(s.grossSales)}`} />
        <Kpi icon={Percent} label="مجمل الربح" value={money(s.grossProfit)} hint={`هامش ${formatCurrency(s.profitMarginPercent)}% · التكلفة ${formatCurrency(s.costOfSales)}`} tone={s.grossProfit < 0 ? 'text-destructive' : 'text-success'} />
        <Kpi icon={Wallet} label="النقدية الداخلة" value={money(s.cashIn)} hint={`تحصيلات ${formatCurrency(s.customerPayments)}`} />
        <Kpi icon={Undo2} label="المرتجعات والخصومات" value={money(s.returns)} hint={`خصومات ${formatCurrency(s.discounts)}`} tone={s.returns > 0 ? 'text-warning' : ''} />
        <Kpi icon={ShoppingCart} label="المشتريات" value={money(s.purchases)} />
        <Kpi icon={Users} label="مستحقات على العملاء (الآن)" value={money(s.outstandingBalances)} tone={s.outstandingBalances > 0 ? 'text-destructive' : ''} />
      </div>
      {s.linesWithoutCost > 0 && (
        <p className="flex items-center gap-2 text-xs text-warning"><AlertTriangle className="w-4 h-4" /> {s.linesWithoutCost} بند مبيعات لمنتجات بدون سعر تكلفة لم يُحسب في الربح.</p>
      )}
      <p className="text-xs text-muted-foreground">الربح محسوب بسعر التكلفة الحالي للمنتجات.</p>

      <section className="p-4 rounded-xl border bg-card">
        <h3 className="text-sm font-semibold mb-3">المبيعات والربح يومياً</h3>
        {r.days.every((d) => d.invoices === 0 && d.returns === 0) ? (
          <p className="text-sm text-muted-foreground text-center py-6">لا توجد مبيعات في هذه الفترة</p>
        ) : (
          <div className="overflow-x-auto">
            <div className="flex items-end gap-1 h-48 min-w-fit" role="img" aria-label="رسم المبيعات اليومية">
              {r.days.map((d) => (
                <div key={d.date} className="flex flex-col items-center justify-end h-full w-6 shrink-0 gap-0.5" title={`${formatDate(d.date)}\nصافي ${formatCurrency(d.net)} · ربح ${formatCurrency(d.profit)} · ${d.invoices} فاتورة`}>
                  <div className="w-full flex items-end gap-px h-full">
                    <div className="flex-1 bg-primary/70 rounded-t" style={{ height: `${(Math.max(d.net, 0) / maxNet) * 100}%` }} />
                    <div className="flex-1 bg-success/70 rounded-t" style={{ height: `${(Math.max(d.profit, 0) / maxNet) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{Number(d.date.slice(8))}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-primary/70" /> صافي المبيعات</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-success/70" /> الربح</span>
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <TableCard title="الأكثر مبيعاً" empty="لا توجد مبيعات" head={['المنتج', 'الكمية', 'المبيعات', 'الربح']}
          rows={r.topProducts.map((p) => [p.name, String(p.quantity), formatCurrency(p.revenue), formatCurrency(p.profit)])} />
        <TableCard title="طرق الدفع" empty="لا توجد مبيعات" head={['الطريقة', 'الفواتير', 'المدفوع']}
          rows={r.paymentMethods.map((m) => [getPaymentMethodLabel(m.method), String(m.invoices), formatCurrency(m.paid)])} />
        <TableCard title="راكد (بدون بيع منذ 60 يوماً)" empty="لا توجد منتجات راكدة" head={['المنتج', 'المخزون', 'قيمة المخزون', 'آخر بيع']}
          rows={r.slowMovers.map((p) => [p.name, String(p.stock), p.stockValue != null ? formatCurrency(p.stockValue) : '-', p.lastSaleAt ? formatDate(p.lastSaleAt) : 'لم يُبع'])} />
        <section className="p-4 rounded-xl border bg-card">
          <h3 className="text-sm font-semibold mb-3">نتائج الجرد في الفترة</h3>
          {r.stocktakes.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد جرد معتمد في هذه الفترة</p> : (
            <ul className="space-y-2 text-sm">
              {r.stocktakes.map((st) => (
                <li key={st.id} className="flex flex-wrap justify-between gap-2">
                  <Link to={`/stocktakes/${st.id}`} className="text-primary hover:underline">{st.title} <span dir="ltr" className="font-mono text-xs">{st.code}</span></Link>
                  <span className="text-xs"><span className="text-destructive">عجز {formatCurrency(st.shortageCost)}</span> · <span className="text-warning">زيادة {formatCurrency(st.surplusCost)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function TableCard({ title, head, rows, empty }: { title: string; head: string[]; rows: string[][]; empty: string }) {
  return (
    <section className="p-4 rounded-xl border bg-card">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">{empty}</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground">{head.map((h) => <th key={h} className="text-right font-medium pb-2">{h}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i} className="border-t">{row.map((c, j) => <td key={j} className="py-2">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}
