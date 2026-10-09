import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X, AlertCircle } from 'lucide-react';

/**
 * `persistent` is for forms: a stray backdrop click or Esc would throw
 * away a half-filled invoice, so only the X button closes it.
 * `busy` disables closing entirely while a request is in flight.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
  persistent = false,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
  persistent?: boolean;
  busy?: boolean;
}) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open || persistent || busy) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, persistent, busy]);

  // Focus moves into the dialog, Tab stays inside it, the page behind
  // does not scroll, and focus returns to the opener on close.
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    const focusables = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      );
    // Skip the X button so typing can start in the first field.
    const first = focusables().find((el) => el.getAttribute('aria-label') !== 'إغلاق') ?? focusables()[0];
    (first ?? dialog)?.focus();

    const onTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = focusables();
      if (items.length === 0) return;
      const [head, tail] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === head) {
        e.preventDefault();
        tail.focus();
      } else if (!e.shiftKey && document.activeElement === tail) {
        e.preventDefault();
        head.focus();
      }
    };
    window.addEventListener('keydown', onTab);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onTab);
      document.body.style.overflow = overflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in p-4"
      onClick={persistent || busy ? undefined : onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-card border rounded-xl shadow-xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto animate-in zoom-in-95`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-card z-10">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="إغلاق"
            className="p-1.5 rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Error banner shown at the top of a form, inside its modal. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-sm text-destructive">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

export function FormField({
  label,
  children,
  required,
  error,
  htmlFor,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
  error?: string;
  /** id of the control, so screen readers announce the label. */
  htmlFor?: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-destructive mr-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

export function FormInput({
  label,
  value,
  onChange,
  type = 'text',
  required,
  placeholder,
  error,
  dir,
  step,
  min,
  max,
  maxLength,
  inputMode,
  disabled,
  autoComplete,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
  dir?: 'rtl' | 'ltr';
  step?: string | number;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  inputMode?: 'decimal' | 'numeric' | 'text' | 'tel';
  disabled?: boolean;
  autoComplete?: string;
}) {
  const id = useId();
  return (
    <FormField htmlFor={id} label={label} required={required} error={error}>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        dir={dir}
        step={step}
        min={min}
        max={max}
        maxLength={maxLength}
        inputMode={inputMode}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={`w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all disabled:bg-muted/40 disabled:cursor-not-allowed ${
          error ? 'border-destructive' : 'border-input'
        }`}
      />
    </FormField>
  );
}

export function FormSelect({
  label,
  value,
  onChange,
  options,
  required,
  placeholder,
  error,
  disabled,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  options: { value: string | number; label: string }[];
  required?: boolean;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <FormField htmlFor={id} label={label} required={required} error={error}>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        aria-label={label || placeholder}
        aria-invalid={error ? true : undefined}
        className={`w-full h-10 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all disabled:bg-muted/40 disabled:cursor-not-allowed ${
          error ? 'border-destructive' : 'border-input'
        }`}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}

export function FormTextarea({
  label,
  value,
  onChange,
  required,
  placeholder,
  error,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  error?: string;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <FormField htmlFor={id} label={label} required={required} error={error}>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        maxLength={maxLength}
        rows={3}
        className="w-full px-3 py-2 rounded-lg border border-input bg-background text-sm focus:ring-2 focus:ring-ring focus:outline-none transition-all resize-none"
      />
    </FormField>
  );
}

export function SubmitButton({ loading, label, loadingLabel = 'جاري الحفظ...' }: { loading: boolean; label: string; loadingLabel?: string }) {
  return (
    <div className="flex gap-3 justify-end pt-4">
      <button
        type="submit"
        disabled={loading}
        className="px-6 py-2.5 rounded-lg bg-primary text-white font-medium text-sm hover:bg-primary/90 transition-all disabled:opacity-50"
      >
        {loading ? loadingLabel : label}
      </button>
    </div>
  );
}
