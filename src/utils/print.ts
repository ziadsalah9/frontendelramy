import JsBarcode from 'jsbarcode';
import type { SalesInvoice, StoreSettings } from '@/types';
import { formatCurrency, formatDate, getPaymentMethodLabel, variantLabel } from '@/utils/format';

// Printing for the 80mm receipt printer and the 40x25mm label printer.
// The page is written into a hidden iframe and printed from there, so the
// app's own layout never interferes and no pop-up blocker is involved.

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** CODE128 barcode as inline SVG markup (works for any code/barcode text). */
export function barcodeSvg(text: string, opts: { height?: number; width?: number; fontSize?: number; displayValue?: boolean } = {}): string {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  JsBarcode(svg, text, {
    format: 'CODE128',
    height: opts.height ?? 40,
    width: opts.width ?? 1.4,
    fontSize: opts.fontSize ?? 12,
    displayValue: opts.displayValue ?? true,
    margin: 0,
  });
  return svg.outerHTML;
}

function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentWindow!.document;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow!.focus();
    frame.contentWindow!.print();
    // Give the print dialog time to read the page before removing it.
    setTimeout(() => frame.remove(), 60_000);
  };
  if (doc.readyState === 'complete') setTimeout(go, 50);
  else frame.onload = go;
}

const BASE_CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Tahoma, 'Segoe UI', Arial, sans-serif; color: #000; direction: rtl; }
  svg { display: block; margin: 0 auto; max-width: 100%; }
`;

/** Customer receipt for an 80mm thermal printer. */
export function printReceipt(invoice: SalesInvoice, store?: StoreSettings | null) {
  const subtotal = invoice.items.reduce((s, i) => s + (i.total ?? 0), 0);
  const rows = invoice.items
    .map((i) => {
      const label = variantLabel(i);
      return `<tr>
        <td class="name">${esc(i.productName)}${label ? `<br><small>${esc(label)}</small>` : ''}${(i.returnedQuantity ?? 0) > 0 ? `<br><small>رُد ${i.returnedQuantity}</small>` : ''}</td>
        <td class="num">${i.quantity}</td>
        <td class="num">${formatCurrency(i.unitPrice)}</td>
        <td class="num">${formatCurrency(i.total)}</td>
      </tr>${i.discount > 0 ? `<tr><td colspan="4" class="disc">خصم ${formatCurrency(i.discount)}</td></tr>` : ''}`;
    })
    .join('');
  const line = (label: string, value: string, strong = false) =>
    `<div class="line${strong ? ' strong' : ''}"><span>${label}</span><span>${value}</span></div>`;

  printHtml(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(invoice.invoiceNumber)}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    ${BASE_CSS}
    body { width: 80mm; padding: 4mm 4mm 8mm; font-size: 12px; }
    .center { text-align: center; }
    h1 { font-size: 17px; margin: 0 0 2px; }
    .muted { font-size: 11px; }
    hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
    table { width: 100%; border-collapse: collapse; }
    th { font-size: 11px; border-bottom: 1px solid #000; padding: 2px 0; text-align: right; }
    td { padding: 3px 0; vertical-align: top; }
    td.num, th.num { text-align: left; white-space: nowrap; padding-right: 4px; }
    td.name small { font-size: 10px; }
    td.disc { font-size: 10px; text-align: left; }
    .line { display: flex; justify-content: space-between; padding: 1px 0; }
    .strong { font-weight: bold; font-size: 14px; }
  </style></head><body>
    <div class="center">
      <h1>${esc(store?.storeName ?? '')}</h1>
      ${store?.address ? `<div class="muted">${esc(store.address)}</div>` : ''}
      ${store?.phone ? `<div class="muted" dir="ltr">${esc(store.phone)}</div>` : ''}
    </div>
    <hr>
    ${line('فاتورة', `<span dir="ltr">${esc(invoice.invoiceNumber)}</span>`)}
    ${line('التاريخ', esc(formatDate(invoice.createdAt)))}
    ${invoice.cashierName ? line('الكاشير', esc(invoice.cashierName)) : ''}
    ${invoice.customer ? line('العميل', `${esc(invoice.customer.name)} <span dir="ltr">${esc(invoice.customer.phone)}</span>`) : ''}
    <hr>
    <table><thead><tr><th>الصنف</th><th class="num">كمية</th><th class="num">سعر</th><th class="num">إجمالي</th></tr></thead><tbody>${rows}</tbody></table>
    <hr>
    ${line('إجمالي الأصناف', formatCurrency(subtotal))}
    ${invoice.discount > 0 ? line('خصم الفاتورة', formatCurrency(invoice.discount)) : ''}
    ${line('الإجمالي', `${formatCurrency(invoice.total)} ج.م`, true)}
    ${line('المدفوع', `${formatCurrency(invoice.paid)} (${esc(getPaymentMethodLabel(invoice.paymentMethod))})`)}
    ${(invoice.remaining ?? 0) > 0 ? line('المتبقي', `${formatCurrency(invoice.remaining)} ج.م`, true) : ''}
    ${(invoice.returnedTotal ?? 0) > 0 ? line('مرتجعات', formatCurrency(invoice.returnedTotal)) : ''}
    <hr>
    ${barcodeSvg(invoice.invoiceNumber, { height: 36, width: 1.3, fontSize: 11 })}
    ${store?.receiptFooter ? `<p class="center muted">${esc(store.receiptFooter)}</p>` : ''}
  </body></html>`);
}

export interface LabelItem {
  productName: string;
  variantLabel?: string | null;
  code: string;
  barcode?: string | null;
  copies: number;
}

/** Barcode stickers, one 40x25mm label per piece (no price, so a price change needs no new labels). */
export function printLabels(items: LabelItem[], store?: StoreSettings | null) {
  const labels = items
    .flatMap((it) => Array.from({ length: Math.max(0, it.copies) }, () => it))
    .map((it) => `<div class="label">
        <div class="top"><span class="store">${esc(store?.storeName ?? '')}</span></div>
        <div class="name">${esc(it.productName)}${it.variantLabel ? ` - ${esc(it.variantLabel)}` : ''}</div>
        ${barcodeSvg(it.barcode || it.code, { height: 26, width: 1.2, fontSize: 9 })}
      </div>`)
    .join('');
  printHtml(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>باركود</title>
  <style>
    @page { size: 40mm 25mm; margin: 0; }
    ${BASE_CSS}
    .label { width: 40mm; height: 25mm; padding: 1.2mm 1.5mm; overflow: hidden; page-break-after: always; break-after: page; }
    .top { display: flex; justify-content: space-between; font-size: 7px; }
    .name { font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin: 0.5mm 0; }
    svg { height: 14mm; }
  </style></head><body>${labels}</body></html>`);
}
