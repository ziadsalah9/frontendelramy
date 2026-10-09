import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Plus, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { stocktakesService } from '@/api/stocktakes';
import { extractApiError } from '@/api/client';
import { PRODUCT_TYPES, type ProductType, type StocktakeSummary } from '@/types';
import { STOCKTAKE_STATUS, scopeText } from '@/components/stocktake/meta';
import { PageHeader } from '@/components/shared/States';
import { DataTable, ActionButton, Badge, type Column } from '@/components/shared/DataTable';
import { Modal, FormError, FormInput, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { formatCurrency, formatDate } from '@/utils/format';
import { MAX_NOTES } from '@/utils/validation';

export default function StocktakesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['stocktakes'], queryFn: stocktakesService.getAll });
  const openOne = data?.find((s) => s.status === 'OPEN');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [allTypes, setAllTypes] = useState(true);
  const [types, setTypes] = useState<ProductType[]>([]);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const openDialog = () => {
    setTitle(`جرد ${new Date().toLocaleDateString('ar-EG-u-nu-latn')}`);
    setAllTypes(true);
    setTypes([]);
    setNotes('');
    setFormError('');
    setDialogOpen(true);
  };

  const toggleType = (t: ProductType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!title.trim()) return setFormError('اكتب عنواناً للجرد');
    if (!allTypes && types.length === 0) return setFormError('اختر نوعاً واحداً على الأقل، أو "كل المنتجات"');
    setSaving(true);
    setFormError('');
    try {
      const created = await stocktakesService.create({ title: title.trim(), types: allTypes ? [] : types, notes: notes.trim() || undefined });
      queryClient.invalidateQueries({ queryKey: ['stocktakes'] });
      toast.success('تم بدء الجرد');
      setDialogOpen(false);
      navigate(`/stocktakes/${created.id}`);
    } catch (err) {
      setFormError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<StocktakeSummary>[] = [
    { key: 'code', header: 'الرقم', render: (s) => <span className="font-mono text-sm" dir="ltr">{s.code}</span> },
    { key: 'title', header: 'العنوان', render: (s) => <span className="font-medium">{s.title}</span> },
    { key: 'scope', header: 'النطاق', render: (s) => <span className="text-sm text-muted-foreground">{scopeText(s.types)}</span> },
    { key: 'status', header: 'الحالة', render: (s) => <Badge variant={STOCKTAKE_STATUS[s.status].variant}>{STOCKTAKE_STATUS[s.status].label}</Badge> },
    {
      key: 'progress', header: 'المعدود',
      render: (s) => (s.status === 'OPEN' ? `${s.countedLines} من ${s.totalInScope}` : `${s.countedLines} صنف`),
    },
    {
      key: 'net', header: 'صافي الفرق (تكلفة)',
      render: (s) => {
        if (s.status !== 'APPROVED') return <span className="text-muted-foreground">-</span>;
        const net = (s.surplusCost ?? 0) - (s.shortageCost ?? 0);
        return <span className={`font-medium whitespace-nowrap ${net < 0 ? 'text-destructive' : net > 0 ? 'text-warning' : 'text-success'}`}>{net > 0 ? '+' : ''}{formatCurrency(net)} ج.م</span>;
      },
    },
    { key: 'date', header: 'التاريخ', render: (s) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</span> },
    {
      key: 'actions', header: '', className: 'text-left w-px',
      render: (s) => <ActionButton onClick={() => navigate(`/stocktakes/${s.id}`)} icon={Eye} label={s.status === 'OPEN' ? 'متابعة العد' : 'عرض التقرير'} />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="الجرد"
        description="عد المخزون الفعلي ومقارنته بالنظام، ثم اعتماد الفروق"
        action={
          <button
            type="button"
            onClick={openOne ? () => navigate(`/stocktakes/${openOne.id}`) : openDialog}
            className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
          >
            {openOne ? <ClipboardCheck className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {openOne ? 'متابعة الجرد المفتوح' : 'جرد جديد'}
          </button>
        }
      />

      <DataTable
        columns={columns}
        data={data ?? []}
        loading={isLoading}
        error={error ? extractApiError(error).message : null}
        emptyTitle="لا يوجد جرد بعد"
        emptyDescription="ابدأ جرداً جديداً لعد المخزون الفعلي"
        onRowClick={(s) => navigate(`/stocktakes/${s.id}`)}
      />

      <Modal open={dialogOpen} onClose={() => setDialogOpen(false)} title="جرد جديد" persistent busy={saving}>
        <form onSubmit={submit} className="space-y-4">
          <FormError message={formError} />
          <FormInput label="العنوان" value={title} onChange={setTitle} required maxLength={200} />
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-foreground mb-2">ماذا ستعد؟</legend>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" checked={allTypes} onChange={() => setAllTypes(true)} />
              كل المنتجات
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" name="scope" checked={!allTypes} onChange={() => setAllTypes(false)} />
              أنواع محددة
            </label>
            {!allTypes && (
              <div className="flex flex-wrap gap-2 pt-1">
                {PRODUCT_TYPES.map((t) => {
                  const on = types.includes(t.value);
                  return (
                    <button
                      key={t.value}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleType(t.value)}
                      className={`h-8 px-3 rounded-full border text-sm transition-colors ${on ? 'bg-primary text-white border-primary' : 'bg-background hover:bg-accent'}`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>
          <FormTextarea label="ملاحظات" value={notes} onChange={setNotes} maxLength={MAX_NOTES} placeholder="اختياري" />
          <p className="text-xs text-muted-foreground">يمكن أن يكون هناك جرد مفتوح واحد فقط. البيع مستمر أثناء الجرد.</p>
          <SubmitButton loading={saving} label="بدء الجرد" loadingLabel="جاري البدء..." />
        </form>
      </Modal>
    </div>
  );
}
