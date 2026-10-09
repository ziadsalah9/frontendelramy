import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, EyeOff, Trash2, Check, X, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { productTypesService } from '@/api/productTypes';
import { extractApiError } from '@/api/client';
import type { ItemType } from '@/types';
import { ConfirmDialog } from '@/components/shared/States';
import { FormSection } from '@/components/products/FormSection';
import { Badge } from '@/components/shared/DataTable';

const MAX_NAME = 50;

/**
 * Product types (ADMIN): add, rename (products follow), hide from new
 * products, or delete when no product uses it.
 */
export function ProductTypesSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['product-types', 'manage'], queryFn: productTypesService.getAllForAdmin });
  const [name, setName] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deleting, setDeleting] = useState<ItemType | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => ['product-types', 'products', 'product-drafts', 'activity-logs'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const run = async (action: () => Promise<unknown>, ok: string) => {
    if (busy) return false;
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      refresh();
      return true;
    } catch (err) {
      toast.error(extractApiError(err).message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const add = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return;
    if (await run(() => productTypesService.create(n), `تمت إضافة النوع «${n}»`)) setName('');
  };

  const saveRename = async (t: ItemType) => {
    const n = editName.trim();
    if (!n || n === t.name) return setEditId(null);
    if (await run(() => productTypesService.rename(t.id, n), `تم تغيير الاسم إلى «${n}»`)) setEditId(null);
  };

  return (
    <FormSection icon={Tag} title="أنواع المنتجات" hint="تغيير اسم نوع يغيّره في كل منتجاته. النوع المستخدم لا يُحذف، ويمكن إخفاؤه من قائمة المنتجات الجديدة.">
      <form onSubmit={add} className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="نوع جديد، مثال: كنب سرير" aria-label="اسم النوع الجديد"
          className="flex-1 h-10 px-3 rounded-lg border border-input bg-background text-sm" />
        <button type="submit" disabled={busy || !name.trim()} className="flex items-center gap-1 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </form>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        : error ? <p className="text-sm text-destructive">{extractApiError(error).message}</p>
        : (
          <ul className="divide-y rounded-lg border">
            {(data ?? []).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 p-2">
                {editId === t.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); void saveRename(t); }} className="flex flex-1 gap-2">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={MAX_NAME} aria-label="الاسم الجديد"
                      className="flex-1 h-9 px-2 rounded-lg border border-input bg-background text-sm" />
                    <button type="submit" aria-label="حفظ" disabled={busy} className="p-2 rounded-lg text-success hover:bg-success/10"><Check className="w-4 h-4" /></button>
                    <button type="button" aria-label="إلغاء" onClick={() => setEditId(null)} className="p-2 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                  </form>
                ) : (
                  <>
                    <span className={`flex-1 text-sm font-medium ${t.active ? '' : 'text-muted-foreground line-through'}`}>{t.name}</span>
                    <span className="text-xs text-muted-foreground">{t.products} منتج{t.drafts > 0 && ` · ${t.drafts} غير مكتمل`}</span>
                    {!t.active && <Badge variant="default">مخفي</Badge>}
                    <button type="button" title="تغيير الاسم" aria-label={`تغيير اسم ${t.name}`} onClick={() => { setEditId(t.id); setEditName(t.name); }}
                      className="p-2 rounded-lg hover:bg-accent"><Pencil className="w-4 h-4" /></button>
                    <button type="button" title={t.active ? 'إخفاء' : 'إظهار'} aria-label={`${t.active ? 'إخفاء' : 'إظهار'} ${t.name}`} disabled={busy}
                      onClick={() => void run(() => productTypesService.toggle(t.id), t.active ? `تم إخفاء «${t.name}»` : `تم إظهار «${t.name}»`)}
                      className="p-2 rounded-lg hover:bg-accent">{t.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    <button type="button" title={t.products + t.drafts > 0 ? 'مستخدم: يمكن إخفاؤه فقط' : 'حذف'} aria-label={`حذف ${t.name}`}
                      disabled={busy || t.products + t.drafts > 0} onClick={() => setDeleting(t)}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

      <ConfirmDialog open={!!deleting} destructive loading={busy} title="حذف نوع" confirmText="حذف"
        description={deleting ? `حذف النوع «${deleting.name}» نهائياً؟` : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (deleting && await run(() => productTypesService.remove(deleting.id), `تم حذف «${deleting.name}»`)) setDeleting(null); }} />
    </FormSection>
  );
}
