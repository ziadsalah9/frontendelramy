import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, Receipt, ArrowLeft, TrendingUp } from 'lucide-react';
import { dashboardService } from '@/api/dashboard';
import { extractApiError } from '@/api/client';
import { PageHeader, LoadingState, EmptyState } from '@/components/shared/States';
import { formatDate, formatCurrency } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';

function StatCard({ icon: Icon, label, value, hint, to, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; hint?: string; to: string; color: string }) {
  return (
    <Link to={to} className="group bg-card border rounded-xl p-5 hover:shadow-lg hover:border-primary/30 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-6 h-6" />
        </div>
        <ArrowLeft className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:-translate-x-1 transition-all" />
      </div>
      <p className="text-sm text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </Link>
  );
}

/** Home: counts and today's sales from one small summary request. */
export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardService.get });

  if (isLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="الرئيسية" description={`مرحباً، ${user?.fullName ?? 'مستخدم'} - إليك نظرة عامة على النظام`} />

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
          تعذر تحميل الملخص: {extractApiError(error).message}
        </div>
      )}

      {data && (
        <>
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
            <StatCard icon={TrendingUp} label="مبيعات اليوم" value={`${formatCurrency(data.todaySalesTotal)} ج.م`} hint={`${data.todaySalesCount} فاتورة`} to="/receipts" color="bg-success/10 text-success" />
            <StatCard icon={Package} label="عدد المنتجات" value={data.products} to="/products" color="bg-primary/10 text-primary" />
            <StatCard icon={Users} label="عدد العملاء" value={data.customers} to="/customers" color="bg-chart-3/10 text-chart-3" />
            <StatCard icon={Receipt} label="فواتير البيع" value={data.salesInvoices} to="/sales-invoices" color="bg-chart-4/10 text-chart-4" />
            {isAdmin && data.purchaseInvoices != null && (
              <StatCard icon={ShoppingCart} label="فواتير الشراء" value={data.purchaseInvoices} to="/purchase-invoices" color="bg-chart-5/10 text-chart-5" />
            )}
          </div>

          {data.recentSales.length > 0 ? (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">أحدث فواتير البيع</h3>
                </div>
                <Link to="/sales-invoices" className="text-sm text-primary hover:underline">عرض الكل</Link>
              </div>
              <div className="divide-y">
                {data.recentSales.map((inv) => (
                  <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium text-foreground" dir="ltr">{inv.invoiceNumber}</p>
                      <p className="text-xs text-muted-foreground">{inv.customerName ?? 'عميل'} - {formatDate(inv.createdAt)}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)} ج.م</p>
                      {inv.remaining > 0 && <p className="text-xs text-destructive">متبقي {formatCurrency(inv.remaining)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="لا توجد فواتير لعرضها حالياً" description="ستظهر هنا أحدث الفواتير بمجرد إنشائها" />
          )}
        </>
      )}
    </div>
  );
}
