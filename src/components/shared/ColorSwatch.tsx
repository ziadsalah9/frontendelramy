const MULTI = 'متعدد الألوان';

/**
 * A small round colour sample. "متعدد الألوان" gets a rainbow; a colour
 * saved without a swatch gets an empty dashed ring.
 */
export function ColorSwatch({ name, hex, className = 'w-3.5 h-3.5' }: { name?: string | null; hex: string | null | undefined; className?: string }) {
  if (hex) {
    return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full border border-black/15 ${className}`} style={{ backgroundColor: hex }} />;
  }
  if (name === MULTI) {
    return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full border border-black/15 bg-[conic-gradient(#ef4444,#f59e0b,#22c55e,#3b82f6,#a855f7,#ef4444)] ${className}`} />;
  }
  return <span aria-hidden="true" className={`inline-block shrink-0 rounded-full border border-dashed border-muted-foreground/60 ${className}`} />;
}
