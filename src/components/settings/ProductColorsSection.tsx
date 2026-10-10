import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Eye, EyeOff, Trash2, Check, X, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { productColorsService } from '@/api/productColors';
import { extractApiError } from '@/api/client';
import type { ProductColor } from '@/types';
import { ConfirmDialog } from '@/components/shared/States';
import { FormSection } from '@/components/products/FormSection';
import { Badge } from '@/components/shared/DataTable';
import { ColorSwatch } from '@/components/shared/ColorSwatch';

const MAX_NAME = 50;
const DEFAULT_HEX = '#9ca3af';

/** Name + optional swatch: a native colour picker and a "no swatch" switch. */
function SwatchPicker({ hex, onChange, idPrefix }: { hex: string | null; onChange: (hex: string | null) => void; idPrefix: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={hex ?? DEFAULT_HEX} disabled={hex == null} onChange={(e) => onChange(e.target.value)} aria-label="درجة اللون"
        className="h-9 w-10 p-0.5 rounded-lg border border-input bg-background disabled:opacity-40 cursor-pointer" />
      <label htmlFor={`${idPrefix}-noswatch`} className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap cursor-pointer">
        <input id={`${idPrefix}-noswatch`} type="checkbox" checked={hex == null} onChange={(e) => onChange(e.target.checked ? null : DEFAULT_HEX)} />
        بدون درجة
      </label>
    </div>
  );
}

/**
 * Colours (ADMIN): add, edit (items follow a rename), hide from new
 * items, or delete when nothing uses it. Same rules as product types.
 */
export function ProductColorsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({ queryKey: ['product-colors', 'manage'], queryFn: productColorsService.getAllForAdmin });
  const [name, setName] = useState('');
  const [hex, setHex] = useState<string | null>(DEFAULT_HEX);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editHex, setEditHex] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ProductColor | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => ['product-colors', 'products', 'product-drafts', 'activity-logs'].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
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
    if (await run(() => productColorsService.create(n, hex), `تمت إضافة اللون «${n}»`)) {
      setName('');
      setHex(DEFAULT_HEX);
    }
  };

  const saveEdit = async (c: ProductColor) => {
    const n = editName.trim();
    if (!n || (n === c.name && editHex === c.hex)) return setEditId(null);
    if (await run(() => productColorsService.update(c.id, n, editHex), 'تم حفظ اللون')) setEditId(null);
  };

  return (
    <FormSection icon={Palette} title="الألوان" hint="تغيير اسم لون يغيّره في كل الأصناف. اللون المستخدم لا يُحذف، ويمكن إخفاؤه من قائمة الأصناف الجديدة.">
      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_NAME} placeholder="لون جديد، مثال: سماوي" aria-label="اسم اللون الجديد"
          className="flex-1 min-w-[10rem] h-10 px-3 rounded-lg border border-input bg-background text-sm" />
        <SwatchPicker hex={hex} onChange={setHex} idPrefix="new-color" />
        <button type="submit" disabled={busy || !name.trim()} className="flex items-center gap-1 h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium disabled:opacity-50">
          <Plus className="w-4 h-4" /> إضافة
        </button>
      </form>

      {isLoading ? <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        : error ? <p className="text-sm text-destructive">{extractApiError(error).message}</p>
        : (
          <ul className="divide-y rounded-lg border">
            {(data ?? []).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 p-2">
                {editId === c.id ? (
                  <form onSubmit={(e) => { e.preventDefault(); void saveEdit(c); }} className="flex flex-1 flex-wrap items-center gap-2">
                    <input autoFocus value={editName} onChange={(e) => setEditName(e.target.value)} maxLength={MAX_NAME} aria-label="الاسم الجديد"
                      className="flex-1 min-w-[8rem] h-9 px-2 rounded-lg border border-input bg-background text-sm" />
                    <SwatchPicker hex={editHex} onChange={setEditHex} idPrefix={`color-${c.id}`} />
                    <button type="submit" aria-label="حفظ" disabled={busy} className="p-2 rounded-lg text-success hover:bg-success/10"><Check className="w-4 h-4" /></button>
                    <button type="button" aria-label="إلغاء" onClick={() => setEditId(null)} className="p-2 rounded-lg hover:bg-accent"><X className="w-4 h-4" /></button>
                  </form>
                ) : (
                  <>
                    <ColorSwatch name={c.name} hex={c.hex} className="w-5 h-5" />
                    <span className={`flex-1 text-sm font-medium ${c.active ? '' : 'text-muted-foreground line-through'}`}>{c.name}</span>
                    <span className="text-xs text-muted-foreground">{c.items} صنف{c.drafts > 0 && ` · ${c.drafts} غير مكتمل`}</span>
                    {!c.active && <Badge variant="default">مخفي</Badge>}
                    <button type="button" title="تعديل" aria-label={`تعديل ${c.name}`} onClick={() => { setEditId(c.id); setEditName(c.name); setEditHex(c.hex); }}
                      className="p-2 rounded-lg hover:bg-accent"><Pencil className="w-4 h-4" /></button>
                    <button type="button" title={c.active ? 'إخفاء' : 'إظهار'} aria-label={`${c.active ? 'إخفاء' : 'إظهار'} ${c.name}`} disabled={busy}
                      onClick={() => void run(() => productColorsService.toggle(c.id), c.active ? `تم إخفاء «${c.name}»` : `تم إظهار «${c.name}»`)}
                      className="p-2 rounded-lg hover:bg-accent">{c.active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}</button>
                    <button type="button" title={c.items + c.drafts > 0 ? 'مستخدم: يمكن إخفاؤه فقط' : 'حذف'} aria-label={`حذف ${c.name}`}
                      disabled={busy || c.items + c.drafts > 0} onClick={() => setDeleting(c)}
                      className="p-2 rounded-lg text-destructive hover:bg-destructive/10 disabled:opacity-30 disabled:hover:bg-transparent"><Trash2 className="w-4 h-4" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}

      <ConfirmDialog open={!!deleting} destructive loading={busy} title="حذف لون" confirmText="حذف"
        description={deleting ? `حذف اللون «${deleting.name}» نهائياً؟` : ''}
        onCancel={() => setDeleting(null)}
        onConfirm={async () => { if (deleting && await run(() => productColorsService.remove(deleting.id), `تم حذف «${deleting.name}»`)) setDeleting(null); }} />
    </FormSection>
  );
}
