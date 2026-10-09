import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { productDraftsService } from '@/api/productDrafts';
import {
  LayoutDashboard,
  Package,
  FilePen,
  Tags,
  Users,
  FileText,
  ShoppingCart,
  Receipt,
  UserCog,
  LogOut,
  Menu,
  X,
  Sofa,
  AlertTriangle,
  Calculator,
  History,
  ClipboardCheck,
  Settings,
  BarChart3,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useLowStockAlerts } from '@/hooks/useLowStockAlerts';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/shared/DataTable';
import { getRoleLabel } from '@/utils/format';

// Every page here is reachable by both roles; ADMIN-only pages carry
// `adminOnly` so employees don't get a link that would 403. The route
// guard in App.tsx enforces the same rule.
// `exact` is needed on "/" because NavLink matches on prefix by default,
// which would keep the dashboard highlighted on every page.
const navItems = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, adminOnly: false, exact: true },
  // Includes cost and profit; /api/reports is ADMIN-only.
  { to: '/reports', label: 'التقارير', icon: BarChart3, adminOnly: true, exact: false },
  { to: '/products', label: 'المنتجات', icon: Package, adminOnly: false, exact: false },
  // Excel rows missing data; not part of the system until completed.
  { to: '/product-drafts', label: 'منتجات غير مكتملة', icon: FilePen, adminOnly: true, exact: false },
  // Price management is ADMIN-only on the backend.
  { to: '/product-prices', label: 'الأسعار', icon: Tags, adminOnly: true, exact: false },
  { to: '/customers', label: 'العملاء', icon: Users, adminOnly: false, exact: false },
  // Sales, purchase (admin) and cash-closing documents in one list.
  { to: '/receipts', label: 'الفواتير والإيصالات', icon: FileText, adminOnly: false, exact: false },
  { to: '/cash-closings', label: 'إغلاق الكاش', icon: Calculator, adminOnly: false, exact: false },
  // Stocktaking changes stock; /api/stocktakes is ADMIN-only.
  { to: '/stocktakes', label: 'الجرد', icon: ClipboardCheck, adminOnly: true, exact: false },
  // /api/purchase-invoices is ADMIN-only in full.
  { to: '/purchase-invoices', label: 'فواتير الشراء', icon: ShoppingCart, adminOnly: true, exact: false },
  { to: '/sales-invoices', label: 'فواتير البيع', icon: Receipt, adminOnly: false, exact: false },
  // /api/users is ADMIN-only in full, so employees cannot open this page.
  { to: '/users', label: 'المستخدمون', icon: UserCog, adminOnly: true, exact: false },
  // Who changed what; /api/activity-logs is ADMIN-only.
  { to: '/activity-log', label: 'سجل النشاط', icon: History, adminOnly: true, exact: false },
  // Store details and the employee discount limit; PUT /api/settings is ADMIN-only.
  { to: '/settings', label: 'الإعدادات', icon: Settings, adminOnly: true, exact: false },
];

export default function AdminLayout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [lowStockOpen, setLowStockOpen] = useState(false);

  // Mounted here so the warning follows the user across every page. The
  // toast action and the header button both open the same list.
  // Badge on "منتجات غير مكتملة" so pending drafts aren't forgotten.
  const { data: draftCount = 0 } = useQuery({
    queryKey: ['product-drafts-count'],
    queryFn: productDraftsService.count,
    enabled: isAdmin,
    refetchInterval: 60_000,
  });

  const { lowStock, count: lowStockCount } = useLowStockAlerts(() =>
    setLowStockOpen(true),
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background flex" dir="rtl">
      {/* Sidebar - desktop */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-40 w-72 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex items-center gap-3 px-6 h-16 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/20">
            <Sofa className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate">مفروشات الرامى</h1>
            <p className="text-xs text-sidebar-foreground/60 truncate">لوحة التحكم</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 text-sidebar-foreground/70 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {navItems
            .filter((item) => !item.adminOnly || isAdmin)
            .map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-primary/20'
                      : 'text-sidebar-foreground/70 hover:bg-white/5 hover:text-white'
                  }`
                }
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                <span className="truncate flex-1">{item.label}</span>
                {item.to === '/product-drafts' && draftCount > 0 && (
                  <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-warning text-white text-xs font-bold flex items-center justify-center">{draftCount}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 mb-2">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
              {user?.fullName?.charAt(0) ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.fullName ?? 'مستخدم'}</p>
              <p className="text-xs text-sidebar-foreground/60 truncate">{user ? getRoleLabel(user.role) : ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:bg-destructive/20 hover:text-red-300 transition-all"
          >
            <LogOut className="w-[18px] h-[18px]" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Global low-stock indicator. Visible on every page. */}
            <button
              onClick={() => setLowStockOpen(true)}
              aria-label="المخزون منخفض"
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                lowStockCount > 0
                  ? 'bg-warning/10 border-warning/40 hover:bg-warning/20'
                  : 'bg-card border-border hover:bg-accent'
              }`}
            >
              <AlertTriangle
                className={`w-4 h-4 ${lowStockCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}
              />
              <span className="hidden sm:inline text-sm font-medium text-foreground">
                المخزون منخفض
              </span>
              {lowStockCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-warning text-white text-xs font-bold">
                  {lowStockCount}
                </span>
              )}
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-left hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user?.fullName ?? 'مستخدم'}</p>
              <p className="text-xs text-muted-foreground">{user ? getRoleLabel(user.role) : ''}</p>
            </div>
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold">
              {user?.fullName?.charAt(0) ?? 'U'}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-7xl mx-auto animate-in fade-in">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Low stock list, opened from the header button or the warning toast */}
      <Modal
        open={lowStockOpen}
        onClose={() => setLowStockOpen(false)}
        title="المخزون منخفض"
        maxWidth="max-w-2xl"
      >
        {lowStock.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              لا توجد منتجات وصلت إلى الحد الأدنى للمخزون.
            </p>
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {lowStock.length === 1
                ? 'منتج واحد وصل إلى الحد الأدنى:'
                : `${lowStock.length} منتجات وصلت إلى الحد الأدنى:`}
            </p>

            <ul className="divide-y border rounded-lg overflow-hidden">
              {lowStock.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[s.code, s.variants.length > 1 ? `${s.variants.length} ألوان/مقاسات` : s.variants[0]?.label].filter(Boolean).join(' · ')}
                    </p>
                  </div>

                  <div className="text-left shrink-0">
                    <p className="text-sm font-bold text-destructive">
                      {s.quantity}
                      <span className="text-xs font-normal text-muted-foreground">
                        {' '}
                        / {s.minimumQuantity ?? 0}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">الكمية / الحد الأدنى</p>
                  </div>

                  <Badge variant="warning">منخفض</Badge>
                </li>
              ))}
            </ul>

            <button
              onClick={() => {
                setLowStockOpen(false);
                navigate('/products');
              }}
              className="mt-4 w-full px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 transition-all"
            >
              الذهاب إلى المنتجات
            </button>
          </>
        )}
      </Modal>
    </div>
  );
}
