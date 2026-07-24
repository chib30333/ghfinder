import { useState } from 'react';
import { Button, FieldError, Input, Spinner } from '@/components/ui';
import { isEmail } from '@/lib/validators';
import type { V } from '@/hooks/useApp';
import { AuthHeading } from './AuthFrame';

function validate(email: string): string | undefined {
  if (!email) return 'Email is required.';
  if (!isEmail(email)) return 'Enter a valid email.';
  return undefined;
}

export function ForgotForm({ v }: { v: V }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (submitError) setSubmitError(null);
    if (error) setError(validate(e.target.value));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(email);
    setError(err);
    if (err) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await v.submitForgot(email);
    } catch (submitErr) {
      setSubmitError(submitErr instanceof Error ? submitErr.message : 'Could not send reset link.');
      setSubmitting(false);
    }
  };

  return (
    <>
      <AuthHeading title="Reset password" subtitle="Enter your email and we'll send you a reset link." />
      <form onSubmit={onSubmit} noValidate>
        <label className="block text-[12px] text-muted">
          Email
          <Input type="email" surface="1" inputSize="xl" className="rounded-9 mt-1.5" value={email} onChange={onChange} aria-invalid={!!error} />
          <FieldError message={error} />
        </label>
        <div aria-live="polite">
          <FieldError message={submitError} variant="submit" className="mb-1" />
        </div>
        <Button type="submit" variant="primary" full size="xl" className="mt-[18px]" disabled={submitting}>
          {submitting ? <><Spinner size={16} className="text-white" /> Sending…</> : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-5 text-center text-[13px] text-muted">
        <a href={v.hrefSignin} onClick={v.goSignin} className="font-semibold">← Back to sign in</a>
      </p>
    </>
  );
}
