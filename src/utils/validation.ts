// Client-side rules mirroring the backend DTO / service validation, so the
// user gets an Arabic message before the request instead of a server error.

/** Same as the backend @Pattern on customer phone: optional "+", 7-20 digits. */
export const PHONE_RE = /^\+?\d{7,20}$/;

export const MAX_NAME = 200;
export const MAX_ADDRESS = 500;
export const MAX_NOTES = 500;
export const MAX_MODEL = 100;
export const MAX_INVOICE_NUMBER = 50;
export const MIN_PASSWORD = 10;

/**
 * Arabic-Indic (٠-٩) and Persian (۰-۹) digits to 0-9, and the Arabic
 * decimal separator (٫) to ".", so typing on an Arabic keyboard works.
 */
export const toLatinDigits = (v: string) =>
  v
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\u066B/g, '.');

/** Digits and a single decimal point only. */
export const sanitizeDecimal = (v: string) => toLatinDigits(v).replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

/** Digits only. */
export const sanitizeInt = (v: string) => toLatinDigits(v).replace(/[^0-9]/g, '');

/** Digits with an optional leading "+". */
export const sanitizePhone = (v: string) => toLatinDigits(v).replace(/[^0-9+]/g, '').replace(/(?!^)\+/g, '');

export function isValidPhone(phone: string): boolean {
  return PHONE_RE.test(phone.trim());
}

/** Backend UserServiceImpl: >= 10 chars with at least one letter and one digit. */
export function passwordError(password: string): string | null {
  if (password.length < MIN_PASSWORD) return `كلمة المرور يجب ألا تقل عن ${MIN_PASSWORD} أحرف`;
  if (!/[A-Za-z؀-ۿ]/.test(password) || !/\d/.test(password)) {
    return 'كلمة المرور يجب أن تحتوي على حرف ورقم على الأقل';
  }
  return null;
}

export function isPositiveInt(v: string): boolean {
  const n = Number(v);
  return v.trim() !== '' && Number.isInteger(n) && n > 0;
}

/** Case- and whitespace-tolerant, null-safe "contains" for list searches. */
export function matches(value: string | null | undefined, term: string): boolean {
  // Arabic digits match too: "٠١٠" finds the phone "010".
  const t = toLatinDigits(term.trim().toLowerCase());
  if (!t) return true;
  return toLatinDigits((value ?? '').toLowerCase()).includes(t);
}
