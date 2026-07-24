import { useState } from 'react';
import { Button, FieldError, Input, Spinner } from '@/components/ui';
import { isEmail } from '@/lib/validators';
import { AuthError } from '@/services';
import type { V } from '@/hooks/useApp';
import { AuthHeading, GoogleButton, OrDivider } from './AuthFrame';

interface Values {
  name: string;
  email: string;
  password: string;
}
type Errors = Partial<Record<keyof Values, string>>;

function validate(values: Values): { isValid: boolean; errors: Errors } {
  const errors: Errors = {};
  if (!values.name.trim()) errors.name = 'Full name is required.';
  if (!values.email) errors.email = 'Email is required.';
  else if (!isEmail(values.email)) errors.email = 'Enter a valid email.';
  if (!values.password) errors.password = 'Password is required.';
  else if (values.password.length < 8) errors.password = 'Use at least 8 characters.';
  return { isValid: Object.keys(errors).length === 0, errors };
}

export function SignUpForm({ v }: { v: V }) {
  const [values, setValues] = useState<Values>({ name: '', email: '', password: '' });
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
      await v.submitSignup(values.name, values.email, values.password);
    } catch (err) {
      if (err instanceof AuthError && err.field) {
        setErrors((prev) => ({ ...prev, [err.field as keyof Values]: err.message }));
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Could not create account.');
      }
      setSubmitting(false);
    }
  };

  const onGoogle = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await v.googleAuth();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Sign up failed.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading title="Create your account" subtitle="Start sourcing developers in minutes." />
      <GoogleButton onClick={onGoogle} label="Sign up with Google" disabled={submitting} />
      <OrDivider />
      <form onSubmit={onSubmit} noValidate>
        <label className="block text-[12px] text-muted mb-3.5">
          Full name
          <Input surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="Alex Operator" value={values.name} onChange={onField('name')} aria-invalid={!!errors.name} />
          <FieldError message={errors.name} />
        </label>
        <label className="block text-[12px] text-muted mb-3.5">
          Work email
          <Input type="email" surface="1" inputSize="xl" className="rounded-9 mt-1.5" value={values.email} onChange={onField('email')} aria-invalid={!!errors.email} />
          <FieldError message={errors.email} />
        </label>
        <label className="block text-[12px] text-muted">
          Password
          <Input type="password" surface="1" inputSize="xl" className="rounded-9 mt-1.5" placeholder="At least 8 characters" value={values.password} onChange={onField('password')} aria-invalid={!!errors.password} />
          <FieldError message={errors.password} />
        </label>
        <div aria-live="polite">
          <FieldError message={submitError} variant="submit" className="mb-1" />
        </div>
        <Button type="submit" variant="primary" full size="xl" className="mt-[18px]" disabled={submitting}>
          {submitting ? <><Spinner size={16} className="text-white" /> Creating account…</> : 'Create account'}
        </Button>
      </form>
      <p className="mt-4 text-center text-[11.5px] text-muted leading-normal">By continuing you agree to the Terms of Service and Privacy Policy.</p>
      <p className="mt-4 text-center text-[13px] text-muted">
        Have an account? <a href={v.hrefSignin} onClick={v.goSignin} className="font-semibold">Sign in</a>
      </p>
    </>
  );
}
