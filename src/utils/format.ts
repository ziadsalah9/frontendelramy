export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '0';
  const value = typeof amount === 'number' ? amount : Number(amount);
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  } catch {
    return dateString;
  }
}

/** Today as yyyy-MM-dd in the browser's local time zone (not UTC). */
export function todayLocalISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    ADMIN: 'مدير',
    EMPLOYEE: 'موظف',
  };
  return labels[role] ?? role;
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    CASH: 'نقدي',
    VISA: 'فيزا / بطاقة',
    INSTAPAY: 'إنستاباي',
    VODAFONE_CASH: 'فودافون كاش',
    MIXED: 'مختلط',
  };
  return labels[method] ?? method;
}

/** "أحمر / كبير" for an invoice line or variant; '' when neither is set. */
export function variantLabel(v: { color?: string | null; size?: string | null }): string {
  return [v.color, v.size].filter((x) => x && String(x).trim()).join(' / ');
}
