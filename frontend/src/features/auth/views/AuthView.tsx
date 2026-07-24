import { Button, IconBadge } from '@/components/ui';
import type { V } from '@/hooks/useApp';
import { AuthFrame, AuthHeading } from '../components/AuthFrame';
import { SignInForm } from '../components/SignInForm';
import { SignUpForm } from '../components/SignUpForm';
import { ForgotForm } from '../components/ForgotForm';
import { ResetPasswordForm } from '../components/ResetPasswordForm';

function SentBody({ v }: { v: V }) {
  return (
    <>
      <IconBadge iconName="check" tone="success" size={46} iconSize={20} rounded="rounded-12" className="mb-4" />
      <AuthHeading title="Check your inbox" />
      <p className="text-muted text-[13.5px] leading-relaxed mb-[22px]">
        We sent a password reset link to <span className="text-fg font-mono">{v.resetEmail}</span>. It expires in 30 minutes.
      </p>
      <Button variant="primary" full size="xl" onClick={v.goReset}>Open reset link</Button>
      <Button variant="secondary" full size="xl" className="mt-2.5" onClick={v.goSignin}>Back to sign in</Button>
    </>
  );
}

export function AuthView({ v }: { v: V }) {
  return (
    <AuthFrame>
      {v.authIsSignin && <SignInForm v={v} />}
      {v.authIsSignup && <SignUpForm v={v} />}
      {v.authIsForgot && <ForgotForm v={v} />}
      {v.authIsSent && <SentBody v={v} />}
      {v.authIsReset && <ResetPasswordForm v={v} />}
    </AuthFrame>
  );
}
