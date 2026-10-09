import { useState } from 'react';
import { Printer } from 'lucide-react';
import type { Product } from '@/types';
import { Modal } from '@/components/shared/Modal';
import { useStoreSettings } from '@/hooks/useStoreSettings';
import { printLabels } from '@/utils/print';
import { sanitizeInt } from '@/utils/validation';

const MAX_COPIES = 500;

/** Barcode stickers for a product's colours/sizes; copies default to the stock. */
export function LabelsDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const settings = useStoreSettings();
  const [copies, setCopies] = useState<Record<number, string>>({});
  const [forId, setForId] = useState<number | null>(null);
  if (product && forId !== product.id) {
    setForId(product.id);
    setCopies(Object.fromEntries(product.variants.filter((v) => v.active !== false).map((v) => [v.id, String(Math.max(v.quantity ?? 0, 0))])));
  }
  if (!product) return null;
  const variants = product.variants.filter((v) => v.active !== false);
  const total = variants.reduce((s, v) => s + (Number(copies[v.id]) || 0), 0);

  const print = () => {
    printLabels(
      variants.map((v) => ({
        productName: product.name,
        variantLabel: v.label === 'بدون لون أو مقاس' ? null : v.label,
        code: v.code,
        barcode: v.barcode,
        copies: Number(copies[v.id]) || 0,
      })),
      settings.data,
    );
  };

  return (
    <Modal open={!!product} onClose={onClose} title={`طباعة باركود: ${product.name}`}>
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">ملصق 40×25 مم لكل قطعة: اسم المحل، المنتج، اللون/المقاس والباركود (بدون سعر). العدد الافتراضي = الكمية الحالية.</p>
        <div className="rounded-lg border divide-y">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium">{v.label}</p>
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{v.barcode || v.code}</p>
              </div>
              <input
                aria-label={`عدد ملصقات ${v.label}`}
                inputMode="numeric"
                value={copies[v.id] ?? ''}
                onChange={(e) => setCopies((c) => ({ ...c, [v.id]: String(Math.min(Number(sanitizeInt(e.target.value)) || 0, MAX_COPIES)) }))}
                className="w-20 h-9 px-2 rounded-lg border border-input bg-background text-sm text-left"
                dir="ltr"
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">{total} ملصق</span>
          <button type="button" onClick={print} disabled={total === 0} className="flex items-center gap-2 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
            <Printer className="w-4 h-4" /> طباعة
          </button>
        </div>
      </div>
    </Modal>
  );
}
