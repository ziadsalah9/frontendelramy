import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/routes/ProtectedRoute';
import AdminLayout from '@/layouts/AdminLayout';
import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import BranchesPage from '@/pages/BranchesPage';
import ProductsPage from '@/pages/ProductsPage';
import ProductPricesPage from '@/pages/ProductPricesPage';
import CustomersPage from '@/pages/CustomersPage';
import StockPage from '@/pages/StockPage';
import StockAdjustmentsPage from '@/pages/StockAdjustmentsPage';
import BranchTransfersPage from '@/pages/BranchTransfersPage';
import PurchaseInvoicesPage from '@/pages/PurchaseInvoicesPage';
import SalesInvoicesPage from '@/pages/SalesInvoicesPage';
import UsersPage from '@/pages/UsersPage';

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
              <Route path="branches" element={<BranchesPage />} />
              <Route path="products" element={<ProductsPage />} />
              <Route path="product-prices" element={<ProductPricesPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="stock" element={<StockPage />} />
              <Route path="stock-adjustments" element={<StockAdjustmentsPage />} />
              <Route path="branch-transfers" element={<BranchTransfersPage />} />
              <Route path="purchase-invoices" element={<PurchaseInvoicesPage />} />
              <Route path="sales-invoices" element={<SalesInvoicesPage />} />
              <Route path="users" element={<UsersPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" richColors dir="rtl" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
