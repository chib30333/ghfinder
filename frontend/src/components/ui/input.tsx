import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type InputSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<InputSize, string> = {
  sm: 'h-8 px-2.5 text-[12.5px]',
  md: 'h-[34px] px-3 text-[13px]',
  lg: 'h-9 px-3 text-[13px]',
  xl: 'h-10 px-3 text-[13.5px]',
};

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: InputSize;
  surface?: '1' | '2';
  mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = 'md', surface = '2', mono, className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full border border-line rounded-8 text-fg outline-none placeholder:text-muted transition-colors',
        surface === '1' ? 'bg-surface' : 'bg-surface-2',
        SIZE[inputSize],
        mono && 'font-mono',
        className,
      )}
      {...rest}
    />
  ),
);
Input.displayName = 'Input';
