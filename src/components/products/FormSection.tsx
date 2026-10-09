import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** A titled card that groups related fields inside a form dialog. */
export function FormSection({ icon: Icon, title, hint, children }: { icon: LucideIcon; title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border bg-card/50 p-4 space-y-4">
      <header className="flex items-start gap-2">
        <span className="mt-0.5 w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0"><Icon className="w-4 h-4" /></span>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}
