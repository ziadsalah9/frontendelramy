import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tags, Save, Loader2 } from 'lucide-react';
import { productsService, productPricesService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { Product, ProductPrice } from '@/types';
import { PageHeader, LoadingState, ErrorState, EmptyState } from '@/components/shared/States';
import { SearchInput, Badge } from '@/components/shared/DataTable';
import { FormInput, FormField } from '@/components/shared/Modal';
import { formatCurrency } from '@/utils/format';
import { toast } from 'sonner';

export default function ProductPricesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [priceMode, setPriceMode] = useState<'profit' | 'selling'>('profit');
  const [form, setForm] = useState({ purchasePrice: '0', profitPercentage: '0', sellingPrice: '0' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const { data: products, isLoading, error: queryError } = useQuery({ queryKey: ['products'], queryFn: productsService.getAll });

  const { data: currentPrice, isLoading: priceLoading } = useQuery({
    queryKey: ['product-price', selectedProduct?.id],
    queryFn: () => productPricesService.getPrice(selectedProduct!.id),
    enabled: !!selectedProduct,
  });

  const filtered = (products ?? []).filter((p) => p.name.includes(search) || (p.code ?? '').includes(search) || (p.itemType ?? '').includes(search) || (p.color ?? '').includes(search));

  const selectProduct = (p: Product) => {
    setSelectedProduct(p);
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setLoading(true);
    setError('');
    try {
      const payload = priceMode === 'profit'
        ? { purchasePrice: Number(form.purchasePrice), profitPercentage: Number(form.profitPercentage) }
        : { purchasePrice: Number(form.purchasePrice), sellingPrice: Number(form.sellingPrice) };
      await productPricesService.updatePrice(selectedProduct.id, payload);
      toast.success('تم تحديث السعر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['product-price', selectedProduct.id] });
    } catch (err) {
      setError(extractApiError(err).message);
    } finally {
      setLoading(false);
    }
  };

  const calculatedSelling = priceMode === 'profit'
    ? Number(form.purchasePrice) * (1 + Number(form.profitPercentage) / 100)
    : Number(form.sellingPrice);

  return (
    <div>
      <PageHeader title="الأسعار" description="إدارة أسعار المنتجات" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product list */}
        <div className="lg:col-span-1">
          <div className="mb-3"><SearchInput value={search} onChange={setSearch} placeholder="بحث عن منتج..." /></div>
          <div className="border rounded-xl bg-card max-h-[600px] overflow-y-auto">
            {isLoading ? <LoadingState /> : queryError ? <ErrorState message={extractApiError(queryError).message} /> : filtered.length === 0 ? <EmptyState title="لا توجد منتجات" /> : (
              <div className="divide-y">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className={`w-full text-right px-4 py-3 hover:bg-muted/30 transition-colors ${selectedProduct?.id === p.id ? 'bg-primary/5 border-r-4 border-primary' : ''}`}
                  >
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.itemType ?? ''} {p.color ?? ''} {p.size ?? ''}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Price panel */}
        <div className="lg:col-span-2">
          {!selectedProduct ? (
            <div className="border rounded-xl bg-card p-12 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4"><Tags className="w-8 h-8 text-muted-foreground" /></div>
              <h3 className="font-semibold text-foreground mb-1">اختر منتجاً</h3>
              <p className="text-sm text-muted-foreground">اختر منتجاً من القائمة لعرض وتعديل سعره</p>
            </div>
          ) : (
            <div className="border rounded-xl bg-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-foreground">{selectedProduct.name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedProduct.itemType ?? ''} {selectedProduct.color ?? ''} {selectedProduct.size ?? ''}</p>
                </div>
              </div>

              {/* Current price */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">سعر الشراء</p><p className="text-lg font-bold text-foreground">{formatCurrency(currentPrice?.purchasePrice)} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">سعر البيع</p><p className="text-lg font-bold text-primary">{formatCurrency(currentPrice?.sellingPrice)} ج.م</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">نسبة الربح</p><p className="text-lg font-bold text-success">{currentPrice?.profitPercentage ?? '-'}%</p></div>
                <div className="p-3 rounded-lg bg-muted/50"><p className="text-xs text-muted-foreground mb-1">الربح</p><p className="text-lg font-bold text-foreground">{currentPrice ? formatCurrency(currentPrice.sellingPrice - currentPrice.purchasePrice) : '-'} ج.م</p></div>
              </div>

              {priceLoading ? <LoadingState /> : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="flex gap-2 p-1 bg-muted rounded-lg w-fit">
                    <button type="button" onClick={() => setPriceMode('profit')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${priceMode === 'profit' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}>سعر الشراء + نسبة الربح</button>
                    <button type="button" onClick={() => setPriceMode('selling')} className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${priceMode === 'selling' ? 'bg-card text-foreground shadow' : 'text-muted-foreground'}`}>سعر الشراء + سعر البيع</button>
                  </div>

                  {error && <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">{error}</div>}

                  <div className="grid grid-cols-2 gap-4">
                    <FormInput label="سعر الشراء" type="number" value={form.purchasePrice} onChange={(v) => setForm({ ...form, purchasePrice: v })} required />
                    {priceMode === 'profit' ? (
                      <FormInput label="نسبة الربح (%)" type="number" value={form.profitPercentage} onChange={(v) => setForm({ ...form, profitPercentage: v })} required />
                    ) : (
                      <FormInput label="سعر البيع" type="number" value={form.sellingPrice} onChange={(v) => setForm({ ...form, sellingPrice: v })} required />
                    )}
                  </div>

                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">سعر البيع المتوقع</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(calculatedSelling)} ج.م</p>
                  </div>

                  <button type="submit" disabled={loading} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {loading ? 'جاري الحفظ...' : 'حفظ السعر'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
