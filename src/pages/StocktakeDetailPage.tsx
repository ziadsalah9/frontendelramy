import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { stocktakesService } from '@/api/stocktakes';
import { extractApiError } from '@/api/client';
import { PageHeader, LoadingState, ErrorState, ConfirmDialog } from '@/components/shared/States';
import { Badge } from '@/components/shared/DataTable';
import { formatDate } from '@/utils/format';
import { CountTab } from '@/components/stocktake/CountTab';
import { ReviewTab } from '@/components/stocktake/ReviewTab';
import { STOCKTAKE_STATUS, scopeText } from '@/components/stocktake/meta';

type Tab = 'count' | 'review';

export default function StocktakeDetailPage() {
  const id = Number(useParams().id);
  const queryClient = useQueryClient();
  const counting = useQuery({ queryKey: ['stocktake', id], queryFn: () => stocktakesService.getForCounting(id), enabled: Number.isFinite(id) });
  const st = counting.data?.stocktake;
  const isOpen = st?.status === 'OPEN';

  const [chosenTab, setTab] = useState<Tab | null>(null);
  // A finished stocktake opens on its report.
  const tab: Tab = chosenTab ?? (st && !isOpen ? 'review' : 'count');
  const review = useQuery({
    queryKey: ['stocktake-review', id],
    queryFn: () => stocktakesService.getReview(id),
    enabled: Number.isFinite(id) && tab === 'review',
  });

  const [confirm, setConfirm] = useState<'approve' | 'cancel' | null>(null);
  const [working, setWorking] = useState(false);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['stocktake', id] });
    queryClient.invalidateQueries({ queryKey: ['stocktake-review', id] });
    queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
  };

  const finish = async () => {
    if (!confirm || working) return;
    setWorking(true);
    try {
      if (confirm === 'approve') {
        await stocktakesService.approve(id);
        toast.success('تم اعتماد الجرد وتحديث المخزون');
        // Stock changed: every stock view must reload.
        ['products', 'low-stock', 'activity-logs'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
        setTab('review');
      } else {
        await stocktakesService.cancel(id);
        toast.success('تم إلغاء الجرد بدون تغيير المخزون');
      }
      refresh();
      setConfirm(null);
    } catch (err) {
      toast.error(extractApiError(err).message);
    } finally {
      setWorking(false);
    }
  };

  if (counting.isLoading) return <LoadingState />;
  if (counting.error || !st) return <ErrorState message={counting.error ? extractApiError(counting.error).message : 'الجرد غير موجود'} />;

  const tabCls = (active: boolean) =>
    `px-4 py-2 rounded-md text-sm font-medium transition-all ${active ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;
  const pendingReview = review.data;
  const missingReasons = pendingReview ? pendingReview.lines.filter((l) => l.variance !== 0 && !l.reason).length : 0;

  return (
    <div className="space-y-4">
      <Link to="/stocktakes" className="inline-flex items-center gap-1 text-sm text-primary hover:underline"><ArrowRight className="w-4 h-4" /> كل عمليات الجرد</Link>
      <PageHeader
        title={st.title}
        description={`${st.code} · ${scopeText(st.types)} · بدأ ${formatDate(st.createdAt)}${st.createdByName ? ` بواسطة ${st.createdByName}` : ''}`
          + (st.approvedAt ? ` · اعتُمد ${formatDate(st.approvedAt)}${st.approvedByName ? ` بواسطة ${st.approvedByName}` : ''}` : '')}
        action={<Badge variant={STOCKTAKE_STATUS[st.status].variant}>{STOCKTAKE_STATUS[st.status].label}</Badge>}
      />
      {st.notes && <p className="text-sm text-muted-foreground">{st.notes}</p>}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'count'} onClick={() => setTab('count')} className={tabCls(tab === 'count')}>{isOpen ? 'العد' : 'الأصناف المعدودة'}</button>
          <button type="button" role="tab" aria-selected={tab === 'review'} onClick={() => setTab('review')} className={tabCls(tab === 'review')}>{isOpen ? 'المراجعة والاعتماد' : 'تقرير الجرد'}</button>
        </div>
        {isOpen && (
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirm('cancel')} className="flex items-center gap-2 h-10 px-4 rounded-lg border text-sm text-destructive hover:bg-destructive/10">
              <XCircle className="w-4 h-4" /> إلغاء الجرد
            </button>
            <button
              type="button"
              onClick={() => { setTab('review'); setConfirm('approve'); }}
              disabled={st.countedLines === 0}
              className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" /> اعتماد الجرد
            </button>
          </div>
        )}
      </div>

      {tab === 'count' ? (
        <CountTab stocktake={st} lines={counting.data!.lines} onChanged={refresh} />
      ) : review.isLoading ? (
        <LoadingState />
      ) : review.error || !review.data ? (
        <ErrorState message={extractApiError(review.error).message} />
      ) : (
        <ReviewTab review={review.data} onChanged={refresh} />
      )}

      <ConfirmDialog
        open={confirm === 'approve'}
        onConfirm={finish}
        onCancel={() => setConfirm(null)}
        loading={working}
        title="اعتماد الجرد"
        description={
          pendingReview
            ? `سيتم تطبيق فروق ${pendingReview.linesWithDifference} صنف على المخزون الحالي.`
              + (pendingReview.uncounted.length ? ` ${pendingReview.uncounted.length} لون/مقاس لم يُعد وسيبقى كما هو.` : '')
              + (missingReasons ? ` ${missingReasons} فرق بدون سبب.` : '')
              + ' لا يمكن التراجع بعد الاعتماد.'
            : 'جاري تحميل الفروق...'
        }
        confirmText="اعتماد وتحديث المخزون"
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onConfirm={finish}
        onCancel={() => setConfirm(null)}
        loading={working}
        destructive
        title="إلغاء الجرد"
        description="سيتم إلغاء هذا الجرد ولن يتغير أي مخزون. العد المسجل يبقى محفوظاً للاطلاع فقط."
        confirmText="إلغاء الجرد"
        cancelText="رجوع"
      />
    </div>
  );
}
