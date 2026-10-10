import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Search, UserPlus, UserCheck, Phone, MapPin, X, AlertTriangle, Loader2 } from 'lucide-react';
import type { Customer } from '@/types';
import { FormInput } from '@/components/shared/Modal';
import { sanitizePhone, MAX_NAME, MAX_ADDRESS } from '@/utils/validation';

export type CustomerMode = 'existing' | 'new';

export interface CustomerPickerValue {
  mode: CustomerMode;
  /** The chosen existing customer (mode = existing). */
  customerId: number | null;
  /** Typed details (mode = new). */
  name: string;
  phone: string;
  address: string;
}

export interface CustomerPickerErrors {
  customer?: string;
  name?: string;
  phone?: string;
  address?: string;
}

const MAX_RESULTS = 8;
const digits = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** Highlights the matched part of a value. */
function Highlight({ text, query, ltr }: { text: string; query: string; ltr?: boolean }) {
  const q = query.trim();
  const i = q ? text.toLowerCase().indexOf(q.toLowerCase()) : -1;
  if (i < 0) return <span dir={ltr ? 'ltr' : undefined}>{text}</span>;
  return (
    <span dir={ltr ? 'ltr' : undefined}>
      {text.slice(0, i)}
      <mark className="bg-primary/20 text-foreground rounded px-0.5">{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </span>
  );
}

/**
 * Customer section of the new-sale dialog: pick an existing customer by
 * searching their phone (or name), or enter a new one. A new customer whose
 * phone is already registered is caught here, because the backend would
 * otherwise attach the sale to the registered customer and ignore the
 * typed name.
 */
export function CustomerPicker({
  customers,
  loading,
  value,
  onChange,
  errors,
}: {
  customers: Customer[];
  loading: boolean;
  value: CustomerPickerValue;
  onChange: (v: CustomerPickerValue) => void;
  errors: CustomerPickerErrors;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  const usable = useMemo(() => customers.filter((c) => c.active !== false), [customers]);
  // Any customer can be the selected one: a hidden (deleted) customer reached
  // through the phone warning below is restored by the server on sale.
  const selected = value.customerId != null ? customers.find((c) => c.id === value.customerId) ?? null : null;

  // Phone digits search phone + secondary phone; anything else searches the name.
  const results = useMemo(() => {
    const q = query.trim();
    if (!q) return [];
    const qDigits = digits(q);
    const byPhone = qDigits.length >= 3 && qDigits.length === q.replace(/[\s+-]/g, '').length;
    return usable
      .filter((c) => byPhone
        ? digits(c.phone).includes(qDigits) || digits(c.secondaryPhone).includes(qDigits)
        : c.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, MAX_RESULTS);
  }, [query, usable]);

  useEffect(() => setActive(0), [query]);

  // Close the result list when clicking outside it.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (c: Customer) => {
    onChange({ ...value, mode: 'existing', customerId: c.id });
    setQuery('');
    setOpen(false);
  };

  const switchToNew = (prefillPhone?: string) => {
    onChange({ ...value, mode: 'new', customerId: null, phone: prefillPhone ?? value.phone });
    setOpen(false);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) setOpen(true);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault(); // never submit the invoice from here
      if (results[active]) choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  // New customer whose phone is already registered.
  const typedPhone = value.phone.trim();
  const phoneOwner = value.mode === 'new' && typedPhone
    ? customers.find((c) => c.phone === typedPhone) ?? null
    : null;
  const secondaryOwner = value.mode === 'new' && typedPhone && !phoneOwner
    ? usable.find((c) => c.secondaryPhone === typedPhone) ?? null
    : null;

  const tabCls = (on: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${on ? 'bg-card text-foreground shadow' : 'text-muted-foreground hover:text-foreground'}`;

  return (
    <div className="p-4 rounded-lg bg-muted/30 border space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">العميل</p>
        <div className="flex gap-1 p-1 bg-muted rounded-lg" role="tablist" aria-label="نوع العميل">
          <button type="button" role="tab" aria-selected={value.mode === 'existing'} onClick={() => { onChange({ ...value, mode: 'existing' }); setTimeout(() => inputRef.current?.focus(), 0); }} className={tabCls(value.mode === 'existing')}>
            <UserCheck className="w-4 h-4" /> عميل حالي
          </button>
          <button type="button" role="tab" aria-selected={value.mode === 'new'} onClick={() => switchToNew()} className={tabCls(value.mode === 'new')}>
            <UserPlus className="w-4 h-4" /> عميل جديد
          </button>
        </div>
      </div>

      {value.mode === 'existing' ? (
        selected ? (
          <div className="flex items-start gap-3 p-3 rounded-lg bg-success/10 border border-success/30">
            <div className="w-10 h-10 rounded-full bg-success/20 text-success flex items-center justify-center font-bold shrink-0">
              {selected.name.trim().charAt(0) || '؟'}
            </div>
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="font-semibold text-foreground truncate">{selected.name}</p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="w-3.5 h-3.5" />
                <span dir="ltr" className="font-mono">{selected.phone}</span>
                {selected.secondaryPhone && <span dir="ltr" className="font-mono">· {selected.secondaryPhone}</span>}
              </p>
              {selected.address && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="w-3.5 h-3.5" /><span className="truncate">{selected.address}</span></p>
              )}
            </div>
            <button type="button" onClick={() => { onChange({ ...value, customerId: null }); setTimeout(() => inputRef.current?.focus(), 0); }}
              className="flex items-center gap-1 h-8 px-2 rounded-lg text-xs text-muted-foreground hover:bg-accent shrink-0">
              <X className="w-3.5 h-3.5" /> تغيير
            </button>
          </div>
        ) : (
          <div ref={boxRef} className="relative">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                onKeyDown={onKeyDown}
                placeholder="ابحث برقم الهاتف أو الاسم..."
                aria-label="بحث عن عميل"
                aria-expanded={open}
                aria-autocomplete="list"
                autoComplete="off"
                className={`w-full h-11 pr-10 pl-10 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none ${errors.customer ? 'border-destructive' : 'border-input'}`}
              />
              {loading && <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {open && query.trim() && (
              <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border bg-card shadow-lg" role="listbox">
                {results.length === 0 ? (
                  <div className="p-4 text-center space-y-2">
                    <p className="text-sm text-muted-foreground">لا يوجد عميل مطابق لـ "{query.trim()}"</p>
                    <button type="button" onClick={() => switchToNew(digits(query).length >= 7 ? sanitizePhone(query.trim()) : undefined)}
                      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90">
                      <UserPlus className="w-4 h-4" /> إضافة كعميل جديد
                    </button>
                  </div>
                ) : (
                  results.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => choose(c)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-right border-b last:border-0 transition-colors ${i === active ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                        {c.name.trim().charAt(0) || '؟'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate"><Highlight text={c.name} query={query} /></p>
                        <p className="text-xs text-muted-foreground font-mono">
                          <Highlight text={c.phone} query={digits(query) || query} ltr />
                          {c.secondaryPhone && <> · <Highlight text={c.secondaryPhone} query={digits(query) || query} ltr /></>}
                        </p>
                      </div>
                      {c.address && <span className="hidden sm:block text-xs text-muted-foreground truncate max-w-[160px]">{c.address}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
            {errors.customer && <p className="mt-1 text-xs text-destructive">{errors.customer}</p>}
            {!query.trim() && !errors.customer && (
              <p className="mt-1 text-xs text-muted-foreground">اكتب 3 أرقام على الأقل من الهاتف، أو جزءاً من الاسم. استخدم الأسهم و Enter للاختيار.</p>
            )}
          </div>
        )
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormInput label="هاتف العميل" value={value.phone} onChange={(v) => onChange({ ...value, phone: sanitizePhone(v) })} required placeholder="01xxxxxxxxx" dir="ltr" inputMode="tel" maxLength={21} error={errors.phone} />
            <FormInput label="اسم العميل" value={value.name} onChange={(v) => onChange({ ...value, name: v })} required placeholder="اسم العميل" maxLength={MAX_NAME} error={errors.name} />
            <FormInput label="العنوان" value={value.address} onChange={(v) => onChange({ ...value, address: v })} placeholder="العنوان (اختياري)" maxLength={MAX_ADDRESS} error={errors.address} />
          </div>
          {phoneOwner && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30 text-sm">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                هذا الرقم مسجل بالفعل للعميل <strong>{phoneOwner.name}</strong>{phoneOwner.active === false && ' (محذوف)'}.
              </span>
              <button type="button" onClick={() => choose(phoneOwner)} className="h-8 px-3 rounded-lg bg-primary text-white text-xs font-medium hover:bg-primary/90">
                {phoneOwner.active === false ? 'استعادة واستخدام هذا العميل' : 'استخدام هذا العميل'}
              </button>
            </div>
          )}
          {secondaryOwner && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-muted border text-sm">
              <span>هذا الرقم هو الرقم الثانوي للعميل <strong>{secondaryOwner.name}</strong>. هل تقصده؟</span>
              <button type="button" onClick={() => choose(secondaryOwner)} className="h-8 px-3 rounded-lg border border-primary/40 text-primary text-xs font-medium hover:bg-primary/10">
                نعم، اختره
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
