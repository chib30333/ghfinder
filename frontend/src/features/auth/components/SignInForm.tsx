import { useState } from 'react';
import { Button, CheckSquare, FieldError, Input, Spinner } from '@/components/ui';
import { isEmail } from '@/lib/validators';
import type { V } from '@/hooks/useApp';
import { AuthHeading, GoogleButton, OrDivider } from './AuthFrame';

interface Values {
  email: string;
  password: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values): { isValid: boolean; errors: Errors } {
  const errors: Errors = {};
  if (!values.email) errors.email = 'Email is required.';
  else if (!isEmail(values.email)) errors.email = 'Enter a valid email.';
  if (!values.password) errors.password = 'Password is required.';
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function SignInForm({ v }: { v: V }) {
  const [values, setValues] = useState<Values>({ email: 'operator@ghfinder.io', password: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [remember, setRemember] = useState(true);
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
      await v.submitSignin(values.email, values.password, remember);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign in failed.');
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await v.googleAuth();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign in failed.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading title="Sign in" subtitle="Welcome back. Enter your credentials to continue." />
      <GoogleButton onClick={onGoogle} label="Continue with Google" disabled={submitting} />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate>
        <label className="block text-[12px] text-muted mb-3.5">
          Email
          <Input type="email" surface="1" inputSize="xl" className="rounded-9 mt-1.5" value={values.email} onChange={onField('email')} aria-invalid={!!errors.email} />
          <FieldError message={errors.email} />
        </label>
        <label className="block text-[12px] text-muted">
          Password
          <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="••••••••" value={values.password} onChange={onField('password')} aria-invalid={!!errors.password} />
          <FieldError message={errors.password} />
        </label>
        <div className="flex items-center justify-between my-[18px]">
          <label className="flex items-center gap-2 text-[12.5px] text-muted cursor-pointer">
            <CheckSquare checked={remember} onClick={() => setRemember((r) => !r)} aria-label="Remember me" /> Remember me
          </label>
          <a href={v.hrefForgot} onClick={v.goForgot} className="text-[12.5px] font-medium">Forgot password?</a>
        </div>
        <div aria-live="polite">
          <FieldError message={submitError} variant="submit" className="mb-3" />
        </div>
        <Button type="submit" variant="primary" full size="xl" disabled={submitting}>
          {submitting ? <><Spinner size={16} className="text-white" /> Signing in…</> : 'Sign in'}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted">
        No account? <a href={v.hrefSignup} onClick={v.goSignup} className="font-semibold">Create one</a>
      </p>
    </>
  );
}
