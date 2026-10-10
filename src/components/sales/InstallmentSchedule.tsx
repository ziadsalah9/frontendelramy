import { useQuery } from '@tanstack/react-query';
import { installmentsService } from '@/api/installments';
import type { InstallmentPlan, InstallmentStatus } from '@/types';
import { Badge } from '@/components/shared/DataTable';
import { formatCurrency } from '@/utils/format';

const STATUS: Record<InstallmentStatus, { label: string; variant: 'success' | 'warning' | 'info' | 'destructive' }> = {
  PAID: { label: 'مدفوع', variant: 'success' },
  PARTIAL: { label: 'جزئي', variant: 'warning' },
  DUE: { label: 'قادم', variant: 'info' },
  OVERDUE: { label: 'متأخر', variant: 'destructive' },
};

/** The monthly plan of an installment sale; renders nothing for a normal sale. */
export function InstallmentSchedule({ invoiceId }: { invoiceId: number }) {
  const { data: plan } = useQuery({ queryKey: ['installment-plan', invoiceId], queryFn: () => installmentsService.forInvoice(invoiceId) });
  if (!plan) return null;
  return <InstallmentPlanView plan={plan} />;
}

/** One plan: its terms, what is paid and left, and the month-by-month schedule. */
export function InstallmentPlanView({ plan, title }: { plan: InstallmentPlan; title?: string }) {
  return (
    <div className="space-y-2">
      <h4 className="font-semibold text-foreground">
        {title ?? 'التقسيط'}: {plan.months} شهر
        {plan.markupPercent > 0 && <span className="text-sm font-normal text-muted-foreground"> (زيادة {plan.markupPercent}% = {formatCurrency(plan.markupAmount)} ج.م)</span>}
      </h4>
      <p className="text-sm">
        إجمالي الأقساط {formatCurrency(plan.totalAmount)} · مدفوع <span className="text-success font-medium">{formatCurrency(plan.paid)}</span> · متبقي{' '}
        <span className={plan.remaining > 0 ? 'text-destructive font-medium' : ''}>{formatCurrency(plan.remaining)}</span> ج.م
      </p>
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr><th className="text-right p-2">#</th><th className="text-right p-2">الاستحقاق</th><th className="text-right p-2">القسط</th><th className="text-right p-2">المدفوع</th><th className="text-right p-2">الحالة</th></tr>
          </thead>
          <tbody>
            {plan.installments.map((i) => (
              <tr key={i.id} className="border-t">
                <td className="p-2">{i.seq}</td>
                <td className="p-2 whitespace-nowrap" dir="ltr">{i.dueDate}</td>
                <td className="p-2 whitespace-nowrap">{formatCurrency(i.amount)}</td>
                <td className="p-2 whitespace-nowrap">{formatCurrency(i.paidAmount)}</td>
                <td className="p-2 whitespace-nowrap">
                  <Badge variant={STATUS[i.status].variant}>{STATUS[i.status].label}</Badge>
                  {i.daysLate > 0 && <span className="mr-1 text-xs text-destructive">{i.daysLate} يوم</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">الأقساط تُحصّل من «تحصيل» في صفحة العميل، وتُطبَّق على أقدم قسط أولاً.</p>
    </div>
  );
}
