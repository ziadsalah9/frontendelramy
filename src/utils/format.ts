export function formatCurrency(amount: number | undefined | null): string {
  if (amount === undefined || amount === null) return '0';
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount);
}

export function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  try {
    return new Intl.DateTimeFormat('ar-EG', {
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
    CARD: 'بطاقة',
    TRANSFER: 'تحويل',
    CREDIT: 'آجل',
  };
  return labels[method] ?? method;
}

export function getTransferStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    PENDING: 'قيد التنفيذ',
    COMPLETED: 'مكتمل',
    CANCELLED: 'ملغي',
  };
  return labels[status] ?? status;
}
