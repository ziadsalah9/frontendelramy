import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Store, Percent } from 'lucide-react';
import { toast } from 'sonner';
import { settingsService } from '@/api/settings';
import { extractApiError } from '@/api/client';
import type { StoreSettings } from '@/types';
import { PageHeader, LoadingState, ErrorState } from '@/components/shared/States';
import { FormError, FormInput, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { FormSection } from '@/components/products/FormSection';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { sanitizeDecimal } from '@/utils/validation';
import { ProductTypesSection } from '@/components/settings/ProductTypesSection';
import { ProductColorsSection } from '@/components/settings/ProductColorsSection';

type Form = { storeName: string; phone: string; address: string; receiptFooter: string; employeeMaxDiscountPercent: string };

const toForm = (s: StoreSettings): Form => ({
  storeName: s.storeName,
  phone: s.phone ?? '',
  address: s.address ?? '',
  receiptFooter: s.receiptFooter ?? '',
  employeeMaxDiscountPercent: String(s.employeeMaxDiscountPercent),
});

/** Store details printed on receipts, and the employee discount limit (ADMIN). */
export default function SettingsPage() {
  const queryClient = useQueryClient();
  const settings = useStoreSettings();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings.data) setForm(toForm(settings.data));
  }, [settings.data]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form || saving) return;
    const pct = Number(form.employeeMaxDiscountPercent);
    if (!form.storeName.trim()) return setError('اسم المحل مطلوب');
    if (form.employeeMaxDiscountPercent === '' || pct < 0 || pct > 100) return setError('حد خصم الموظف بين 0 و 100');
    setSaving(true);
    setError('');
    try {
      const saved = await settingsService.update({
        storeName: form.storeName.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        receiptFooter: form.receiptFooter.trim() || null,
        employeeMaxDiscountPercent: pct,
      });
      queryClient.setQueryData(['store-settings'], saved);
      toast.success('تم حفظ الإعدادات');
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  if (settings.isLoading || (!form && !settings.error)) return <LoadingState />;
  if (settings.error || !form) return <ErrorState message={extractApiError(settings.error).message} />;

  return (
    <div className="max-w-3xl">
      <PageHeader title="الإعدادات" description="بيانات المحل التي تظهر في الإيصال، وصلاحيات الخصم" />
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <FormSection icon={Store} title="بيانات المحل" hint="تُطبع في أعلى وأسفل إيصال البيع.">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="اسم المحل" value={form.storeName} onChange={(v) => setForm({ ...form, storeName: v })} required maxLength={200} />
            <FormInput label="الهاتف" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} maxLength={100} dir="ltr" placeholder="010xxxxxxxx" />
          </div>
          <FormInput label="العنوان" value={form.address} onChange={(v) => setForm({ ...form, address: v })} maxLength={300} />
          <FormTextarea label="تذييل الإيصال" value={form.receiptFooter} onChange={(v) => setForm({ ...form, receiptFooter: v })} maxLength={300} placeholder="مثال: شكراً لزيارتكم - الاستبدال خلال 14 يوماً" />
        </FormSection>
        <FormSection icon={Percent} title="الخصم" hint="أقصى خصم يمكن للموظف إعطاؤه في الفاتورة (خصم البنود + خصم الفاتورة) كنسبة من إجمالي الفاتورة قبل الخصم. المدير بدون حد.">
          <div className="max-w-xs">
            <FormInput label="حد خصم الموظف %" type="text" inputMode="decimal" value={form.employeeMaxDiscountPercent}
              onChange={(v) => setForm({ ...form, employeeMaxDiscountPercent: sanitizeDecimal(v).slice(0, 6) })} required dir="ltr" />
          </div>
        </FormSection>
        <SubmitButton loading={saving} label="حفظ الإعدادات" />
      </form>

      {/* Separate from the form above: each change is saved right away. */}
      <div className="mt-6">
        <ProductTypesSection />
        <ProductColorsSection />
      </div>
    </div>
  );
}
