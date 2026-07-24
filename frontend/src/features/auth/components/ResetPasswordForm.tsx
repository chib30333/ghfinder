import { useState } from 'react';
import { Button, FieldError, Input, Spinner } from '@/components/ui';
import type { V } from '@/hooks/useApp';
import { AuthHeading } from './AuthFrame';

interface Values {
  password: string;
  confirm: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values): { isValid: boolean; errors: Errors } {
  const errors: Errors = {};
  if (!values.password) errors.password = 'Password is required.';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  if (!values.confirm) errors.confirm = 'Confirm your password.';
  else if (values.confirm !== values.password) errors.confirm = 'Passwords do not match.';
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function ResetPasswordForm({ v }: { v: V }) {
  const [values, setValues] = useState<Values>({ password: '', confirm: '' });
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
      await v.submitReset(values.password);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not update password.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading title="Set a new password" />
      <p className="text-muted text-[13.5px] leading-relaxed mb-[22px]">
        Choose a new password for <span className="text-fg font-mono">{v.resetEmail}</span>.
      </p>
      <form onSubmit={onSubmit} noValidate>
        <label className="block text-[12px] text-muted mb-3.5">
          New password
          <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="At least 8 characters" value={values.password} onChange={onField('password')} aria-invalid={!!errors.password} />
          <FieldError message={errors.password} />
        </label>
        <label className="block text-[12px] text-muted">
          Confirm password
          <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="Re-enter password" value={values.confirm} onChange={onField('confirm')} aria-invalid={!!errors.confirm} />
          <FieldError message={errors.confirm} />
        </label>
        <div aria-live="polite">
          <FieldError message={submitError} variant="submit" className="mb-1" />
        </div>
        <Button type="submit" variant="primary" full size="xl" className="mt-[18px]" disabled={submitting}>
          {submitting ? <><Spinner size={16} className="text-white" /> Updating…</> : 'Update password'}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted">
        <a href={v.hrefSignin} onClick={v.goSignin} className="font-semibold">← Back to sign in</a>
      </p>
    </>
  );
}
