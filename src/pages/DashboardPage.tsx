import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Package, Building2, Users, ShoppingCart, Receipt, ArrowLeft, TrendingUp, Boxes } from 'lucide-react';
import { branchesService } from '@/api/branches';
import { productsService } from '@/api/products';
import { customersService } from '@/api/customers';
import { purchaseInvoicesService } from '@/api/purchaseInvoices';
import { salesInvoicesService } from '@/api/salesInvoices';
import { PageHeader } from '@/components/shared/States';
import { LoadingState, ErrorState } from '@/components/shared/States';
import { formatDate, formatCurrency } from '@/utils/format';
import { useAuth } from '@/hooks/useAuth';
import type { ReactNode } from 'react';

function StatCard({ icon: Icon, label, value, to, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number | string; to: string; color: string }) {
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
    </Link>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: branches, isLoading: lb, error: eb } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });
  const { data: products, isLoading: lp, error: ep } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });
  const { data: customers, isLoading: lc, error: ec } = useQuery({ queryKey: ['customers'], queryFn: customersService.getAll });
  const { data: purchaseInvoices, isLoading: lpi, error: epi } = useQuery({ queryKey: ['purchase-invoices'], queryFn: purchaseInvoicesService.getAll });
  const { data: salesInvoices, isLoading: lsi, error: esi } = useQuery({ queryKey: ['sales-invoices'], queryFn: salesInvoicesService.getAll });

  const anyError = eb || ep || ec || epi || esi;
  const anyLoading = lb && lp && lc && lpi && lsi;

  const recentSales = salesInvoices?.slice(0, 5) ?? [];
  const recentPurchases = purchaseInvoices?.slice(0, 5) ?? [];

  if (anyLoading) return <LoadingState />;

  return (
    <div>
      <PageHeader title="الرئيسية" description={`مرحباً، ${user?.fullName ?? 'مستخدم'} - إليك نظرة عامة على النظام`} />

      {anyError ? (
        <div className="mb-6 p-4 rounded-lg bg-warning/10 border border-warning/30 text-sm text-warning">
          تعذر تحميل بعض البيانات من الخادم. تأكد من تشغيل الخادم على المنفذ 8086
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard icon={Package} label="عدد المنتجات" value={products?.length ?? 0} to="/products" color="bg-primary/10 text-primary" />
        <StatCard icon={Building2} label="عدد الفروع" value={branches?.length ?? 0} to="/branches" color="bg-chart-2/10 text-chart-2" />
        <StatCard icon={Users} label="عدد العملاء" value={customers?.length ?? 0} to="/customers" color="bg-chart-3/10 text-chart-3" />
        <StatCard icon={Receipt} label="فواتير البيع" value={salesInvoices?.length ?? 0} to="/sales-invoices" color="bg-chart-4/10 text-chart-4" />
        <StatCard icon={ShoppingCart} label="فواتير الشراء" value={purchaseInvoices?.length ?? 0} to="/purchase-invoices" color="bg-chart-5/10 text-chart-5" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {recentSales.length > 0 && (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">أحدث فواتير البيع</h3>
              </div>
              <Link to="/sales-invoices" className="text-sm text-primary hover:underline">عرض الكل</Link>
            </div>
            <div className="divide-y">
              {recentSales.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{inv.customerName ?? 'عميل'} - {formatDate(inv.createdAt)}</p>
                  </div>
                  <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)} ج.م</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentPurchases.length > 0 && (
          <div className="bg-card border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-primary" />
                <h3 className="font-bold text-foreground">أحدث فواتير الشراء</h3>
              </div>
              <Link to="/purchase-invoices" className="text-sm text-primary hover:underline">عرض الكل</Link>
            </div>
            <div className="divide-y">
              {recentPurchases.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/30 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-foreground">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">{inv.branchName ?? ''} - {formatDate(inv.createdAt)}</p>
                  </div>
                  <p className="text-sm font-bold text-primary">{formatCurrency(inv.total)} ج.م</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentSales.length === 0 && recentPurchases.length === 0 && !anyError && (
          <div className="lg:col-span-2">
            <ErrorState message="لا توجد فواتير لعرضها حالياً" />
          </div>
        )}
      </div>
    </div>
  );
}
