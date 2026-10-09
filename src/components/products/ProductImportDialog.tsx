import { useRef, useState, type DragEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { Download, Upload, FileSpreadsheet, CheckCircle2, X, Loader2, FilePen, SkipForward, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { productsService } from '@/api/products';
import { extractApiError } from '@/api/client';
import type { ProductImportResult, ProductImportRowError } from '@/types';
import { Modal, FormError } from '@/components/shared/Modal';

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['.xlsx', '.xls'];

type Phase = 'pick' | 'uploading' | 'done' | 'rejected';

/**
 * Bulk product import: download the template, fill it, upload it.
 *
 * The backend validates every row and imports all-or-nothing, so a
 * rejected file can simply be fixed and uploaded again.
 */
export function ProductImportDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [progress, setProgress] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState('');
  const [rowErrors, setRowErrors] = useState<ProductImportRowError[]>([]);
  const [result, setResult] = useState<ProductImportResult | null>(null);

  const reset = () => {
    setFile(null);
    setPhase('pick');
    setProgress(0);
    setError('');
    setRowErrors([]);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const close = () => {
    if (phase === 'uploading') return;
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    if (downloading) return;
    setDownloading(true);
    try {
      const blob = await productsService.downloadImportTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'قالب-المنتجات.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(`تعذر تنزيل القالب: ${extractApiError(err).message}`);
    } finally {
      setDownloading(false);
    }
  };

  const pick = (f: File | undefined | null) => {
    setError('');
    setRowErrors([]);
    setPhase('pick');
    if (!f) return;
    const name = f.name.toLowerCase();
    if (!ACCEPTED.some((ext) => name.endsWith(ext))) {
      setFile(null);
      setError('نوع الملف غير مدعوم. اختر ملف Excel بصيغة .xlsx');
      return;
    }
    if (f.size === 0) {
      setFile(null);
      setError('الملف فارغ.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setFile(null);
      setError('حجم الملف أكبر من 5 ميجابايت.');
      return;
    }
    setFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const upload = async () => {
    if (!file || phase === 'uploading') return;
    setPhase('uploading');
    setProgress(0);
    setError('');
    setRowErrors([]);
    try {
      const res = await productsService.importFromExcel(file, setProgress);
      setResult(res);
      setPhase('done');
      toast.success(res.drafted > 0
        ? `تم إضافة ${res.created} منتج، و${res.drafted} منتج غير مكتمل`
        : `تم إضافة ${res.created} منتج بنجاح`);
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-drafts'] });
      queryClient.invalidateQueries({ queryKey: ['product-drafts-count'] });
      queryClient.invalidateQueries({ queryKey: ['low-stock'] });
    } catch (err) {
      const data = (err as AxiosError<{ message?: string; errors?: ProductImportRowError[] }>).response?.data;
      if (data && Array.isArray(data.errors) && data.errors.length > 0) {
        setRowErrors([...data.errors].sort((a, b) => a.row - b.row));
        setError(data.message ?? 'يوجد أخطاء في الملف');
        setPhase('rejected');
      } else {
        setError(extractApiError(err).message);
        setPhase('pick');
      }
    }
  };

  const errorRows = new Set(rowErrors.map((e) => e.row)).size;

  return (
    <Modal open={open} onClose={close} title="إضافة منتجات من ملف Excel" maxWidth="max-w-3xl" persistent busy={phase === 'uploading'}>
      {phase === 'done' && result ? (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
              <CheckCircle2 className="w-6 h-6 text-success mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{result.created}</p>
              <p className="text-xs text-muted-foreground">منتج جديد</p>
              {result.variantsAdded > 0 && <p className="text-xs text-muted-foreground">+ {result.variantsAdded} لون/مقاس لمنتجات موجودة</p>}
            </div>
            <div className="p-4 rounded-lg bg-warning/10 border border-warning/30">
              <FilePen className="w-6 h-6 text-warning mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{result.drafted}</p>
              <p className="text-xs text-muted-foreground">منتج غير مكتمل</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50 border">
              <SkipForward className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{result.skipped.length}</p>
              <p className="text-xs text-muted-foreground">صف تم تخطيه (مكرر)</p>
            </div>
          </div>

          {result.warnings.length > 0 && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm space-y-1">
              {result.warnings.map((w, i) => <p key={i} className="flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />{w}</p>)}
            </div>
          )}

          {result.products.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-foreground">
                المنتجات المضافة أو التي أُضيفت لها ألوان/مقاسات
                {result.withStock > 0 && <span className="font-normal text-muted-foreground"> · رصيد افتتاحي {result.totalQuantity} قطعة</span>}
              </p>
              <ul className="max-h-44 overflow-y-auto divide-y border rounded-lg text-sm">
                {result.products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <span className="font-medium truncate">{p.name}</span>
                    <span className="text-xs text-muted-foreground truncate">{p.variants.map((v) => v.label).join('، ')}</span>
                    <span className="text-xs whitespace-nowrap">الكمية: <span className="font-medium">{p.quantity ?? 0}</span></span>
                    <span className="font-mono text-xs text-muted-foreground" dir="ltr">{p.code}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.drafted > 0 && (
            <section className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">منتجات غير مكتملة <span className="font-normal text-muted-foreground">(لن تظهر في النظام حتى يتم إكمالها)</span></p>
                <button type="button" onClick={() => { close(); navigate('/product-drafts'); }} className="text-sm text-primary hover:underline whitespace-nowrap">فتح المنتجات غير المكتملة</button>
              </div>
              <ul className="max-h-48 overflow-y-auto divide-y border rounded-lg text-sm">
                {result.drafts.map((d) => (
                  <li key={d.id} className="px-3 py-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">الصف {d.sourceRow}</span>
                      <span className="font-medium truncate">{d.name ?? 'بدون اسم'}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {d.missingFields.map((m) => <span key={m} className="px-2 py-0.5 rounded-md text-xs bg-warning/15 text-warning border border-warning/30">ناقص: {m}</span>)}
                    </div>
                    {d.notes.length > 0 && <p className="text-xs text-muted-foreground">{d.notes.join(' · ')}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {result.skipped.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm font-semibold text-foreground">صفوف تم تخطيها</p>
              <ul className="max-h-36 overflow-y-auto divide-y border rounded-lg text-sm">
                {result.skipped.map((k, i) => (
                  <li key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-xs text-muted-foreground font-mono">الصف {k.row}</span>
                    <span className="font-medium truncate">{k.name ?? '-'}</span>
                    <span className="text-xs text-muted-foreground">{k.reason}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={reset} className="h-10 px-4 rounded-lg border border-input text-sm hover:bg-accent">استيراد ملف آخر</button>
            <button type="button" onClick={close} className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">تم</button>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Step 1 */}
          <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-muted/40 border">
            <div>
              <p className="font-semibold text-foreground">1. نزّل القالب واملأه</p>
              <p className="text-xs text-muted-foreground mt-1">
                القالب يحتوي على كل بيانات المنتج مع قوائم منسدلة وورقة تعليمات. المنتج المكتمل (الاسم، النوع، اللون، المقاس، الكمية الحالية، والسعر) يُضاف مباشرة، والناقص يُحفظ في «منتجات غير مكتملة» حتى تكمله. الموديل والحد الأدنى اختياريان.
              </p>
            </div>
            <button type="button" onClick={downloadTemplate} disabled={downloading} className="flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 disabled:opacity-50 shrink-0">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              تنزيل القالب
            </button>
          </section>

          {/* Step 2 */}
          <section className="space-y-3">
            <p className="font-semibold text-foreground">2. ارفع الملف بعد ملئه</p>
            <div
              role="button"
              tabIndex={0}
              onClick={() => phase !== 'uploading' && inputRef.current?.click()}
              onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && phase !== 'uploading') inputRef.current?.click(); }}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed text-center cursor-pointer transition-colors ${
                dragOver ? 'border-primary bg-primary/5' : 'border-input hover:border-primary/50 hover:bg-muted/30'
              }`}
            >
              <FileSpreadsheet className="w-8 h-8 text-muted-foreground" />
              {file ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{file.name}</span>
                  <span className="text-xs text-muted-foreground">({(file.size / 1024).toFixed(0)} KB)</span>
                  {phase !== 'uploading' && (
                    <button type="button" onClick={(e) => { e.stopPropagation(); reset(); }} aria-label="إزالة الملف" className="p-1 rounded hover:bg-accent">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <p className="text-sm text-foreground">اسحب الملف هنا أو اضغط للاختيار</p>
                  <p className="text-xs text-muted-foreground">Excel ‎(.xlsx)‎ حتى 5 ميجابايت و 1000 منتج</p>
                </>
              )}
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
                onChange={(e) => pick(e.target.files?.[0])}
              />
            </div>

            {phase === 'uploading' && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary transition-all" style={{ width: `${progress < 100 ? progress : 100}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">{progress < 100 ? `جاري رفع الملف... ${progress}%` : 'جاري التحقق من البيانات وإضافة المنتجات...'}</p>
              </div>
            )}
          </section>

          <FormError message={error} />

          {phase === 'rejected' && rowErrors.length > 0 && (
            <section className="space-y-2">
              <p className="text-sm text-foreground">
                <span className="font-semibold">{rowErrors.length} خطأ</span> في <span className="font-semibold">{errorRows} صف</span>. لم يتم إضافة أي منتج — صحّح الملف ثم ارفعه مرة أخرى.
              </p>
              <div className="max-h-72 overflow-y-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-right px-3 py-2 font-semibold w-16">الصف</th>
                      <th className="text-right px-3 py-2 font-semibold w-36">العمود</th>
                      <th className="text-right px-3 py-2 font-semibold">الخطأ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowErrors.map((e, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-3 py-2 font-mono">{e.row}</td>
                        <td className="px-3 py-2 text-muted-foreground">{e.column ?? '-'}</td>
                        <td className="px-3 py-2 text-destructive">{e.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={close} disabled={phase === 'uploading'} className="h-10 px-4 rounded-lg border border-input text-sm hover:bg-accent disabled:opacity-50">إلغاء</button>
            {phase === 'rejected' ? (
              // The user fixes the file on disk; the old File handle may be
              // stale, so ask for the corrected file instead of re-sending it.
              <button type="button" onClick={() => inputRef.current?.click()} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
                <Upload className="w-4 h-4" /> اختيار الملف بعد التصحيح
              </button>
            ) : (
              <button type="button" onClick={upload} disabled={!file || phase === 'uploading'} className="flex items-center gap-2 h-10 px-5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90 disabled:opacity-50">
                {phase === 'uploading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                رفع وإضافة المنتجات
              </button>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
