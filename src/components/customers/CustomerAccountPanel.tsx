import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { customerAccountsService } from '@/api/customerAccounts';
import { extractApiError } from '@/api/client';
import { PAYMENT_METHODS, type PaymentMethod } from '@/types';
import { Modal, FormError, FormInput, FormSelect, FormTextarea, SubmitButton } from '@/components/shared/Modal';
import { useMainBranch } from '@/hooks/useMainBranch';
import { formatCurrency, formatDate } from '@/utils/format';
import { sanitizeDecimal, MAX_NOTES } from '@/utils/validation';

const ENTRY_LABEL = { INVOICE: 'فاتورة', PAYMENT: 'تحصيل', RETURN: 'مرتجع', INSTALLMENT_MARKUP: 'زيادة تقسيط' } as const;

/**
 * What a customer owes, their statement, and recording a payment (تحصيل).
 * Open to admins and employees.
 */
export function CustomerAccountPanel({ customerId }: { customerId: number }) {
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: ['customer-account', customerId], queryFn: () => customerAccountsService.getAccount(customerId) });
  const { branchId } = useMainBranch();
  const [statementOpen, setStatementOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const balance = account.data?.balance ?? 0;

  const openPay = () => {
    setAmount(balance > 0 ? String(balance) : '');
    setMethod('CASH');
    setNotes('');
    setError('');
    setPayOpen(true);
  };

  const pay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const n = Number(amount);
    if (!(n > 0)) return setError('اكتب مبلغاً أكبر من صفر');
    if (n > balance) return setError(`المبلغ أكبر من المستحق (${formatCurrency(balance)} ج.م)`);
    if (!branchId) return setError('لم يتم العثور على الفرع');
    setSaving(true);
    setError('');
    try {
      const p = await customerAccountsService.pay(customerId, { branchId, amount: n, paymentMethod: method, notes: notes.trim() || undefined });
      toast.success(`تم تسجيل التحصيل ${p.paymentNumber}: ${formatCurrency(p.amount)} ج.م`);
      ['customer-account', 'customer-payments', 'cash-closings-summary', 'activity-logs', 'installments-due', 'installment-plan', 'dashboard'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
      setPayOpen(false);
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-3 rounded-lg border space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><Wallet className="w-3.5 h-3.5" /> المستحق على العميل</p>
          <p className={`text-lg font-bold ${balance > 0 ? 'text-destructive' : 'text-success'}`}>
            {account.isLoading ? '...' : `${formatCurrency(balance)} ج.م`}
          </p>
        </div>
        <button type="button" onClick={openPay} disabled={account.isLoading || balance <= 0}
          className="flex items-center gap-2 h-9 px-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed">
          <Wallet className="w-4 h-4" /> تحصيل
        </button>
      </div>

      {account.data && account.data.entries.length > 0 && (
        <div>
          <button type="button" onClick={() => setStatementOpen((o) => !o)} aria-expanded={statementOpen} className="flex items-center gap-1 text-sm text-primary hover:underline">
            كشف الحساب ({account.data.entries.length}) <ChevronDown className={`w-4 h-4 transition-transform ${statementOpen ? 'rotate-180' : ''}`} />
          </button>
          {statementOpen && (
            <div className="mt-2 max-h-72 overflow-auto border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr><th className="text-right p-2">التاريخ</th><th className="text-right p-2">البيان</th><th className="text-right p-2">المبلغ</th><th className="text-right p-2">الرصيد</th></tr>
                </thead>
                <tbody>
                  {account.data.entries.map((e) => (
                    <tr key={`${e.type}-${e.id}`} className="border-t align-top">
                      <td className="p-2 whitespace-nowrap text-muted-foreground">{formatDate(e.date)}</td>
                      <td className="p-2"><span className="font-medium">{ENTRY_LABEL[e.type]}</span> <span dir="ltr" className="font-mono">{e.number}</span><span className="block text-muted-foreground">{e.description}</span></td>
                      <td className={`p-2 whitespace-nowrap font-medium ${e.amount < 0 ? 'text-success' : e.amount > 0 ? 'text-destructive' : ''}`} dir="ltr">{formatCurrency(e.amount)}</td>
                      <td className="p-2 whitespace-nowrap" dir="ltr">{formatCurrency(e.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={payOpen} onClose={() => setPayOpen(false)} title={`تحصيل من ${account.data?.customerName ?? ''}`} persistent busy={saving}>
        <form onSubmit={pay} className="space-y-4" noValidate>
          <p className="text-sm">المستحق حالياً: <strong className="text-destructive">{formatCurrency(balance)} ج.م</strong></p>
          <FormError message={error} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormInput label="المبلغ (ج.م)" type="text" inputMode="decimal" value={amount} onChange={(v) => setAmount(sanitizeDecimal(v))} required dir="ltr" />
            <FormSelect label="طريقة الدفع" value={method} onChange={(v) => setMethod(v as PaymentMethod)}
              options={PAYMENT_METHODS.filter((m) => m.value !== 'MIXED').map((m) => ({ value: m.value, label: m.label }))} />
          </div>
          <FormTextarea label="ملاحظات" value={notes} onChange={setNotes} maxLength={MAX_NOTES} placeholder="اختياري" />
          <p className="text-xs text-muted-foreground">التحصيل النقدي يُحسب في إغلاق كاش اليوم.</p>
          <SubmitButton loading={saving} label="تسجيل التحصيل" />
        </form>
      </Modal>
    </div>
  );
}
