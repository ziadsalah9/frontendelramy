import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import {
  LayoutDashboard,
  Building2,
  Package,
  Tags,
  Users,
  Boxes,
  SlidersHorizontal,
  ArrowLeftRight,
  ShoppingCart,
  Receipt,
  UserCog,
  LogOut,
  Menu,
  X,
  Sofa,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getRoleLabel } from '@/utils/format';

const navItems = [
  { to: '/', label: 'الرئيسية', icon: LayoutDashboard, end: true },
  { to: '/branches', label: 'الفروع', icon: Building2 },
  { to: '/products', label: 'المنتجات', icon: Package },
  { to: '/product-prices', label: 'الأسعار', icon: Tags },
  { to: '/customers', label: 'العملاء', icon: Users },
  { to: '/stock', label: 'المخزون', icon: Boxes },
  { to: '/stock-adjustments', label: 'تعديلات المخزون', icon: SlidersHorizontal },
  { to: '/branch-transfers', label: 'التحويلات بين الفروع', icon: ArrowLeftRight },
  { to: '/purchase-invoices', label: 'فواتير الشراء', icon: ShoppingCart },
  { to: '/sales-invoices', label: 'فواتير البيع', icon: Receipt },
  { to: '/users', label: 'المستخدمون', icon: UserCog },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
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
                <span className="truncate">{item.label}</span>
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
    </div>
  );
}
