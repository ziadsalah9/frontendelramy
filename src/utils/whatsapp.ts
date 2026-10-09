/**
 * wa.me link with a ready message. Egyptian local numbers (01xxxxxxxxx)
 * become international (201xxxxxxxxx); others are used as typed.
 */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `20${digits.slice(1)}`;
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
