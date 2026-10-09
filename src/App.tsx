import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import { AdminRoute } from '@/routes/AdminRoute';
import AdminLayout from '@/layouts/AdminLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import ProductsPage from '@/pages/ProductsPage';
import ProductDraftsPage from '@/pages/ProductDraftsPage';
import ProductPricesPage from '@/pages/ProductPricesPage';
import CustomersPage from '@/pages/CustomersPage';
import PurchaseInvoicesPage from '@/pages/PurchaseInvoicesPage';
import SalesInvoicesPage from '@/pages/SalesInvoicesPage';
import UsersPage from '@/pages/UsersPage';
import ReceiptsPage from '@/pages/ReceiptsPage';
import CashClosingsPage from '@/pages/CashClosingsPage';
import ActivityLogPage from '@/pages/ActivityLogPage';
import StocktakesPage from '@/pages/StocktakesPage';
import StocktakeDetailPage from '@/pages/StocktakeDetailPage';
import SettingsPage from '@/pages/SettingsPage';
import ReportsPage from '@/pages/ReportsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="products" element={<ProductsPage />} />
              {/* Incomplete products from Excel imports; ADMIN-only API. */}
              <Route
                path="product-drafts"
                element={
                  <AdminRoute>
                    <ProductDraftsPage />
                  </AdminRoute>
                }
              />
              {/* Price changes are ADMIN-only on the backend. */}
              <Route
                path="product-prices"
                element={
                  <AdminRoute>
                    <ProductPricesPage />
                  </AdminRoute>
                }
              />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="receipts" element={<ReceiptsPage />} />
              <Route path="cash-closings" element={<CashClosingsPage />} />
              {/* Single-branch mode: there is no branches page (the old one
                  is archived in .local-dev/removed-frontend-files.tgz). */}
              {/* /api/purchase-invoices is ADMIN-only end to end. */}
              <Route
                path="purchase-invoices"
                element={
                  <AdminRoute>
                    <PurchaseInvoicesPage />
                  </AdminRoute>
                }
              />
              <Route path="sales-invoices" element={<SalesInvoicesPage />} />
              {/* /api/users is ADMIN-only end to end. */}
              <Route
                path="users"
                element={
                  <AdminRoute>
                    <UsersPage />
                  </AdminRoute>
                }
              />
              <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
              <Route path="reports" element={<AdminRoute><ReportsPage /></AdminRoute>} />
              {/* Stocktaking; ADMIN-only end to end. */}
              <Route path="stocktakes" element={<AdminRoute><StocktakesPage /></AdminRoute>} />
              <Route path="stocktakes/:id" element={<AdminRoute><StocktakeDetailPage /></AdminRoute>} />
              {/* Who changed what; ADMIN-only end to end. */}
              <Route
                path="activity-log"
                element={
                  <AdminRoute>
                    <ActivityLogPage />
                  </AdminRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors dir="rtl" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
