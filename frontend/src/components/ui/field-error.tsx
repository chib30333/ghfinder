import { cn } from '@/lib/utils';

export interface FieldErrorProps {
  message?: string | null;
  variant?: 'field' | 'submit';
  className?: string;
}

export function FieldError({ message, variant = 'field', className }: FieldErrorProps) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className={cn(
        variant === 'field' ? 'mt-1.5 text-[11px] text-danger' : 'mt-3 text-[12.5px] text-danger',
        className,
      )}
    >
      {message}
    </p>
  );
}
