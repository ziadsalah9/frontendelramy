import { useState, type FormEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { authService } from '@/api/auth';
import { extractApiError } from '@/api/client';
import { useAuth } from '@/hooks/useAuth';
import { Modal, FormError, FormInput, SubmitButton } from '@/components/shared/Modal';
import { passwordError } from '@/utils/validation';

type Field = 'current' | 'next' | 'confirm';
const EMPTY: Record<Field, string> = { current: '', next: '', confirm: '' };

/** The signed-in user changes their own password (any role). Other logins of the account stop working. */
export function ChangePasswordDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  const close = () => {
    if (saving) return;
    setForm(EMPTY);
    setErrors({});
    setError('');
    setShow(false);
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs: Partial<Record<Field, string>> = {};
    if (!form.current) errs.current = 'اكتب كلمة المرور الحالية';
    const policy = form.next ? passwordError(form.next) : 'اكتب كلمة المرور الجديدة';
    if (policy) errs.next = policy;
    else if (form.next === form.current) errs.next = 'كلمة المرور الجديدة يجب أن تختلف عن الحالية';
    if (!errs.next && form.confirm !== form.next) errs.confirm = 'التأكيد لا يطابق كلمة المرور الجديدة';
    setErrors(errs);
    setError('');
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      // The old token is revoked by the change; keep working with the new one.
      login(await authService.changePassword(form.current, form.next));
      toast.success('تم تغيير كلمة المرور');
      setSaving(false);
      setForm(EMPTY);
      setShow(false);
      onClose();
    } catch (err) {
      setError(extractApiError(err).message);
      setSaving(false);
    }
  };

  const type = show ? 'text' : 'password';
  return (
    <Modal open={open} onClose={close} title="تغيير كلمة المرور" persistent busy={saving}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} />
        <div className="relative">
          <FormInput label="كلمة المرور الحالية" type={type} value={form.current} onChange={(v) => setForm({ ...form, current: v })}
            required dir="ltr" autoComplete="current-password" error={errors.current} />
          <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'إخفاء كلمات المرور' : 'إظهار كلمات المرور'}
            className="absolute left-2 top-[34px] p-1 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <FormInput label="كلمة المرور الجديدة" type={type} value={form.next} onChange={(v) => setForm({ ...form, next: v })}
          required dir="ltr" autoComplete="new-password" placeholder="10 أحرف على الأقل، حرف ورقم" error={errors.next} />
        <FormInput label="تأكيد كلمة المرور الجديدة" type={type} value={form.confirm} onChange={(v) => setForm({ ...form, confirm: v })}
          required dir="ltr" autoComplete="new-password" error={errors.confirm} />
        <p className="text-xs text-muted-foreground">بعد التغيير يتم تسجيل خروج هذا الحساب من أي جهاز آخر.</p>
        <SubmitButton loading={saving} label="تغيير كلمة المرور" />
      </form>
    </Modal>
  );
}
