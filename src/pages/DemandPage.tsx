import { useMemo, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Minus, Flame, PackageX, ShoppingBag, Snowflake, Archive } from 'lucide-react';
import { reportsService } from '@/api/reports';
import { extractApiError } from '@/api/client';
import type { DemandItem, DemandStatus } from '@/types';
import { PageHeader } from '@/components/shared/States';
import { DataTable, SearchInput, Badge, type Column } from '@/components/shared/DataTable';
import { TypeTabs } from '@/components/shared/TypeTabs';
import { inTypeTab, ALL_TYPES } from '@/utils/typeTabs';
import { formatCurrency, formatDate } from '@/utils/format';
import { matches } from '@/utils/validation';

const PERIODS = [30, 60, 90, 180];

const STATUS: Record<DemandStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'destructive' | 'default'; hint: string }> = {
  OUT_OF_STOCK: { label: 'نفد وعليه طلب', variant: 'destructive', hint: 'بيع في الفترة ولم يتبق منه شيء' },
  REORDER: { label: 'يحتاج طلب', variant: 'warning', hint: 'المخزون يكفي أقل من أسبوعين' },
  OK: { label: 'مناسب', variant: 'success', hint: 'المخزون مناسب لسرعة البيع' },
  OVERSTOCK: { label: 'مخزون زائد', variant: 'info', hint: 'المخزون يكفي أكثر من 6 أشهر' },
  NOT_MOVING: { label: 'راكد', variant: 'default', hint: 'في المخزن ولم يُبع في الفترة' },
  NO_ACTIVITY: { label: 'لا حركة', variant: 'default', hint: 'لا مخزون ولا مبيعات' },
};

type Focus = 'all' | 'top' | 'reorder' | 'out' | 'stale' | 'over';
type Sort = 'revenue' | 'net' | 'cover' | 'stale';

const inFocus = (f: Focus, i: DemandItem) =>
  f === 'all' ? i.status !== 'NO_ACTIVITY'
    : f === 'top' ? i.abc === 'A'
    : f === 'reorder' ? i.status === 'REORDER' || i.status === 'OUT_OF_STOCK'
    : f === 'out' ? i.status === 'OUT_OF_STOCK'
    : f === 'stale' ? i.status === 'NOT_MOVING'
    : i.status === 'OVERSTOCK';

function Trend({ i }: { i: DemandItem }) {
  if (i.net <= 0) return null;
  if (i.firstHalf <= 0) return <span className="inline-flex items-center text-[11px] text-success" title="بدأ البيع في النصف الثاني من الفترة"><ArrowUpRight className="w-3.5 h-3.5" />جديد</span>;
  const pct = Math.round(((i.secondHalf - i.firstHalf) / i.firstHalf) * 100);
  if (Math.abs(pct) < 15) return <span className="inline-flex items-center text-[11px] text-muted-foreground" title="مبيعات النصف الثاني من الفترة مقارنة بالأول"><Minus className="w-3.5 h-3.5" />ثابت</span>;
  return pct > 0
    ? <span className="inline-flex items-center text-[11px] text-success" title="مبيعات النصف الثاني من الفترة مقارنة بالأول"><ArrowUpRight className="w-3.5 h-3.5" />{pct}%</span>
    : <span className="inline-flex items-center text-[11px] text-destructive" title="مبيعات النصف الثاني من الفترة مقارنة بالأول"><ArrowDownRight className="w-3.5 h-3.5" />{Math.abs(pct)}%</span>;
}

function Cover({ days }: { days: number | null }) {
  if (days == null) return <span className="text-muted-foreground">-</span>;
  const tone = days < 14 ? 'bg-destructive' : days > 180 ? 'bg-sky-500' : 'bg-success';
  const width = Math.min(100, Math.round((Math.min(days, 180) / 180) * 100));
  return (
    <div className="min-w-[5.5rem]">
      <p className="text-sm whitespace-nowrap">{days >= 9999 ? '+9999' : days} يوم</p>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className={`h-full ${tone}`} style={{ width: `${Math.max(width, 4)}%` }} /></div>
    </div>
  );
}

/** Sales and demand per colour/size: best sellers, what to reorder, what is not moving. */
export default function DemandPage() {
  const [days, setDays] = useState(90);
  const [focus, setFocus] = useState<Focus>('all');
  const [typeTab, setTypeTab] = useState(ALL_TYPES);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('revenue');
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ['demand', days], queryFn: () => reportsService.demand(days), placeholderData: keepPreviousData,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const searched = items.filter((i) => matches(i.productName, search) || matches(i.code, search) || matches(i.label, search));
  const focused = searched.filter((i) => inFocus(focus, i));
  const rows = focused.filter((i) => inTypeTab(typeTab, i.itemType));
  const sorted = [...rows].sort((a, b) =>
    sort === 'net' ? b.net - a.net
      : sort === 'cover' ? (a.daysOfCover ?? 1e9) - (b.daysOfCover ?? 1e9)
      : sort === 'stale' ? b.stockValue - a.stockValue
      : b.revenue - a.revenue);

  const count = (f: Focus) => items.filter((i) => inFocus(f, i)).length;
  const revenue = items.reduce((s, i) => s + i.revenue, 0);
  const topRevenue = items.filter((i) => i.abc === 'A').reduce((s, i) => s + i.revenue, 0);
  const staleValue = items.filter((i) => i.status === 'NOT_MOVING').reduce((s, i) => s + i.stockValue, 0);
  const toOrder = items.filter((i) => inFocus('reorder', i)).reduce((s, i) => s + i.suggestedReorder, 0);

  const cards: { f: Focus; icon: typeof Flame; label: string; value: string; hint: string; tone: string }[] = [
    { f: 'top', icon: Flame, label: 'الأكثر طلباً (A)', value: String(count('top')), hint: revenue > 0 ? `${Math.round((topRevenue / revenue) * 100)}% من الإيراد` : 'لا مبيعات', tone: 'text-primary' },
    { f: 'reorder', icon: ShoppingBag, label: 'تحتاج طلب', value: String(count('reorder')), hint: toOrder > 0 ? `اقتراح ${toOrder} قطعة لشهر` : 'لا شيء الآن', tone: 'text-warning' },
    { f: 'out', icon: PackageX, label: 'نفدت وعليها طلب', value: String(count('out')), hint: 'مبيعات ضائعة محتملة', tone: 'text-destructive' },
    { f: 'stale', icon: Snowflake, label: 'راكدة', value: String(count('stale')), hint: `قيمتها ${formatCurrency(staleValue)} ج.م`, tone: 'text-muted-foreground' },
    { f: 'over', icon: Archive, label: 'مخزون زائد', value: String(count('over')), hint: 'يكفي أكثر من 6 أشهر', tone: 'text-sky-600' },
  ];

  const columns: Column<DemandItem & { id: number }>[] = [
    {
      key: 'item', header: 'الصنف',
      render: (i) => (
        <div>
          <p className="font-medium">{i.productName}</p>
          <p className="text-xs text-muted-foreground">{i.label || 'بدون لون أو مقاس'} · <span className="font-mono" dir="ltr">{i.code}</span></p>
        </div>
      ),
    },
    { key: 'net', header: 'المبيع', render: (i) => <div className="whitespace-nowrap"><p className="font-bold">{i.net}</p><Trend i={i} />{i.returned > 0 && <p className="text-[11px] text-muted-foreground">رُد {i.returned}</p>}</div> },
    { key: 'avg', header: 'في اليوم', render: (i) => <span dir="ltr">{i.avgDaily}</span> },
    { key: 'stock', header: 'المخزون', render: (i) => <span className={i.stock === 0 ? 'text-destructive font-bold' : ''}>{i.stock}</span> },
    { key: 'cover', header: 'يكفي', render: (i) => <Cover days={i.daysOfCover} /> },
    { key: 'revenue', header: 'الإيراد', render: (i) => <span className="whitespace-nowrap">{formatCurrency(i.revenue)}</span> },
    { key: 'abc', header: 'الفئة', render: (i) => i.abc ? <Badge variant={i.abc === 'A' ? 'success' : i.abc === 'B' ? 'info' : 'default'}>{i.abc}</Badge> : <span className="text-muted-foreground">-</span> },
    {
      key: 'status', header: 'الحالة',
      render: (i) => (
        <div title={STATUS[i.status].hint}>
          <Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge>
          {i.status === 'NOT_MOVING' && <p className="mt-1 text-[11px] text-muted-foreground whitespace-nowrap">{i.lastSaleAt ? `آخر بيع ${formatDate(i.lastSaleAt)}` : 'لم يُبع أبداً'}</p>}
        </div>
      ),
    },
    { key: 'order', header: 'اقتراح الطلب', render: (i) => i.suggestedReorder > 0 ? <span className="font-bold text-warning">{i.suggestedReorder}</span> : <span className="text-muted-foreground">-</span> },
  ];

  const segCls = (on: boolean) => `px-3 py-1.5 rounded-md text-sm font-medium transition-all ${on ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div>
      <PageHeader title="حركة الأصناف" description="الأكثر طلباً، ما يحتاج طلب، والراكد - لكل لون/مقاس حسب مبيعات الفترة" />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1 p-1 bg-muted rounded-lg" role="tablist" aria-label="الفترة">
          {PERIODS.map((d) => <button key={d} type="button" role="tab" aria-selected={days === d} onClick={() => setDays(d)} className={segCls(days === d)}>آخر {d} يوم</button>)}
        </div>
        {data && <span className="text-xs text-muted-foreground" dir="ltr">{data.from} → {data.to}</span>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
        {cards.map((c) => (
          <button key={c.f} type="button" aria-pressed={focus === c.f} onClick={() => setFocus(focus === c.f ? 'all' : c.f)}
            className={`p-3 rounded-xl border text-right transition-colors ${focus === c.f ? 'border-primary ring-2 ring-primary/20 bg-primary/5' : 'bg-card hover:bg-accent'}`}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><c.icon className={`w-4 h-4 ${c.tone}`} />{c.label}</p>
            <p className={`text-xl font-bold ${c.tone}`}>{c.value}</p>
            <p className="text-[11px] text-muted-foreground">{c.hint}</p>
          </button>
        ))}
      </div>

      <div className="flex flex-col lg:flex-row gap-3 lg:items-center mb-3">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث بالاسم أو الكود أو اللون..." />
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          ترتيب
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-10 px-2 rounded-lg border border-input bg-background text-sm">
            <option value="revenue">الأعلى إيراداً</option>
            <option value="net">الأكثر مبيعاً</option>
            <option value="cover">الأقرب للنفاد</option>
            <option value="stale">الأعلى قيمة مخزون</option>
          </select>
        </label>
      </div>
      <div className="mb-4"><TypeTabs types={focused.map((i) => i.itemType)} value={typeTab} onChange={setTypeTab} idPrefix="demand-type" /></div>

      <div className={`transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
        <DataTable columns={columns} data={sorted.map((i) => ({ ...i, id: i.variantId }))} loading={isLoading}
          error={error ? extractApiError(error).message : null}
          emptyTitle="لا توجد أصناف بهذا الفلتر" emptyDescription="غيّر الفترة أو الفلتر" />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        المبيع بعد خصم المرتجع. «يكفي» = المخزون ÷ متوسط البيع اليومي. اقتراح الطلب يكفي 30 يوماً. الفئة A = الأصناف التي تصنع أول 80% من الإيراد.
      </p>
    </div>
  );
}
