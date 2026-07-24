import { useState } from 'react';
import { Button, FieldError, IconBadge, Input, Modal, Spinner } from '@/components/ui';
import { AuthError } from '@/services';
import type { V } from '@/hooks/useApp';

interface Values {
  current: string;
  next: string;
  confirm: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values): { isValid: boolean; errors: Errors } {
  const errors: Errors = {};
  if (!values.current) errors.current = 'Enter your current password.';
  if (!values.next) errors.next = 'New password is required.';
  else if (values.next.length < 8) errors.next = 'Use at least 8 characters.';
  else if (values.next === values.current) errors.next = 'Choose a password different from the current one.';
  if (!values.confirm) errors.confirm = 'Confirm your new password.';
  else if (values.confirm !== values.next) errors.confirm = 'Passwords do not match.';
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function ChangePasswordModal({ v }: { v: V }) {
  const [values, setValues] = useState<Values>({ current: '', next: '', confirm: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onField = (field: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...values, [field]: e.target.value };
    setValues(next);
    if (submitError) setSubmitError(null);
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: validate(next).errors[field] }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = validate(values);
    setErrors(res.errors);
    if (!res.isValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await v.submitChangePassword(values.current, values.next);
    } catch (err) {
      // The only server-side failure is a wrong current password.
      if (err instanceof AuthError) setErrors((prev) => ({ ...prev, current: err.message }));
      else setSubmitError(err instanceof Error ? err.message : 'Could not change password.');
      setSubmitting(false);
    }
  };

  return (
    <Modal onClose={v.closeChangePassword} panelClassName="max-w-[420px] overflow-hidden">
      <form onSubmit={onSubmit} noValidate>
        <div className="px-5 pt-5">
          <IconBadge iconName="shield" tone="accent" size={40} iconSize={18} rounded="rounded-10" className="mb-3.5" />
          <h3 className="text-[16px] font-bold mb-1.5">Change password</h3>
          <p className="text-[13px] text-muted leading-relaxed">Update the password for <span className="text-fg font-mono">{v.authUserEmail}</span>.</p>
        </div>
        <div className="px-5 py-4 flex flex-col gap-3.5">
          <label className="block text-[12px] text-muted">
            Current password
            <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="••••••••" value={values.current} onChange={onField('current')} aria-invalid={!!errors.current} autoFocus />
            <FieldError message={errors.current} />
          </label>
          <label className="block text-[12px] text-muted">
            New password
            <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="At least 8 characters" value={values.next} onChange={onField('next')} aria-invalid={!!errors.next} />
            <FieldError message={errors.next} />
          </label>
          <label className="block text-[12px] text-muted">
            Confirm new password
            <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="Re-enter new password" value={values.confirm} onChange={onField('confirm')} aria-invalid={!!errors.confirm} />
            <FieldError message={errors.confirm} />
          </label>
          <div aria-live="polite">
            <FieldError message={submitError} variant="submit" />
          </div>
        </div>
        <div className="flex gap-2.5 px-5 pb-5">
          <Button type="button" variant="soft" size="lg" full className="h-10" onClick={v.closeChangePassword} disabled={submitting}>Cancel</Button>
          <Button type="submit" variant="primary" size="lg" full className="h-10" disabled={submitting}>
            {submitting ? <><Spinner size={16} className="text-white" /> Saving…</> : 'Update password'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
