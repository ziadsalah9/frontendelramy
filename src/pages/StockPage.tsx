import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Eye, Boxes, SlidersHorizontal } from 'lucide-react';
import { stockService } from '@/api/stock';
import { branchesService } from '@/api/branches';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { Stock, StockTransaction } from '@/types';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '@/components/shared/States';
import { SearchInput, Badge, ActionButton, type Column } from '@/components/shared/DataTable';
import { Modal, FormSelect } from '@/components/shared/Modal';
import { formatDate } from '@/utils/format';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

export default function StockPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [viewing, setViewing] = useState<Stock | null>(null);
  const [transactions, setTransactions] = useState<StockTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  const { data: branches } = useQuery({ queryKey: ['branches'], queryFn: branchesService.getAll });
  const { data: products } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  // Stock endpoint requires product+branch, so we build a view from products x branches
  // by fetching stock for each combination
  const stockQueries = useQuery({
    queryKey: ['stock-all', branches, products],
    queryFn: async () => {
      if (!branches || !products) return [];
      const results: Stock[] = [];
      for (const branch of branches) {
        for (const product of products) {
          try {
            const stock = await stockService.getByProductAndBranch(product.id, branch.id);
            if (stock) {
              results.push({
                ...stock,
                productName: product.name,
                branchName: branch.name,
                minimumQuantity: product.minimumQuantity,
              });
            }
          } catch {
            // skip if stock doesn't exist for this combo
          }
        }
      }
      return results;
    },
    enabled: !!branches && !!products,
  });

  const allStock = stockQueries.data ?? [];
  const filtered = allStock.filter((s) => {
    const matchesSearch = (s.productName ?? '').includes(search) || (s.branchName ?? '').includes(search);
    const matchesBranch = !branchFilter || s.branchId === Number(branchFilter);
    return matchesSearch && matchesBranch;
  });

  const viewTransactions = async (stock: Stock) => {
    setViewing(stock);
    setTxLoading(true);
    try {
      const txs = await stockService.getTransactionsByProduct(stock.productId);
      setTransactions(txs);
    } catch (err) {
      toast.error(extractApiError(err).message);
      setTransactions([]);
    } finally {
      setTxLoading(false);
    }
  };

  const getStockStatus = (s: Stock) => {
    if (s.quantity <= 0) return <Badge variant="destructive">نفد</Badge>;
    if (s.minimumQuantity && s.quantity <= s.minimumQuantity) return <Badge variant="warning">منخفض</Badge>;
    return <Badge variant="success">متوفر</Badge>;
  };

  const columns: Column<Stock>[] = [
    { key: 'productName', header: 'المنتج', render: (s) => <span className="font-medium">{s.productName}</span> },
    { key: 'branchName', header: 'الفرع', render: (s) => s.branchName ?? '-' },
    { key: 'quantity', header: 'الكمية الحالية', render: (s) => <span className="font-bold text-lg">{s.quantity}</span> },
    { key: 'minimumQuantity', header: 'الحد الأدنى', render: (s) => s.minimumQuantity ?? '-' },
    { key: 'status', header: 'الحالة', render: (s) => getStockStatus(s) },
    {
      key: 'actions', header: 'إجراءات', className: 'text-left',
      render: (s) => (
        <div className="flex items-center gap-1">
          <ActionButton onClick={() => viewTransactions(s)} icon={Eye} label="حركات المخزون" />
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="المخزون" description="عرض المخزون وحركاته عبر الفروع" />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="بحث عن منتج أو فرع..." />
        <select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} className="h-10 px-3 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none">
          <option value="">كل الفروع</option>
          {(branches ?? []).map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
      </div>

      {stockQueries.isLoading ? <LoadingState /> : stockQueries.error ? <ErrorState message={extractApiError(stockQueries.error).message} /> : (
        <div className="border rounded-xl overflow-hidden bg-card">
          {filtered.length === 0 ? <EmptyState title="لا توجد بيانات مخزون" description="لم يتم العثور على مخزون للفلاتر المحددة" /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    {columns.map((col) => <th key={col.key} className={`text-right font-semibold text-foreground px-4 py-3 whitespace-nowrap ${col.className ?? ''}`}>{col.header}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      {columns.map((col) => <td key={col.key} className={`px-4 py-3 ${col.className ?? ''}`}>{col.render ? col.render(row) : (row as unknown as Record<string, unknown>)[col.key] as never}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <Modal open={!!viewing} onClose={() => setViewing(null)} title={`حركات المخزون - ${viewing?.productName ?? ''}`} maxWidth="max-w-2xl">
        {viewing && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الفرع</p><p className="text-sm font-medium">{viewing.branchName}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الكمية الحالية</p><p className="text-lg font-bold text-foreground">{viewing.quantity}</p></div>
              <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الحد الأدنى</p><p className="text-sm font-medium">{viewing.minimumQuantity ?? '-'}</p></div>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-3">سجل الحركات</h4>
              {txLoading ? <LoadingState /> : transactions.length === 0 ? <EmptyState title="لا توجد حركات" /> : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="text-sm font-medium text-foreground">{tx.reason ?? tx.type}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                      </div>
                      <Badge variant={tx.quantity > 0 ? 'success' : 'destructive'}>{tx.quantity > 0 ? '+' : ''}{tx.quantity}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
