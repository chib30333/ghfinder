import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'soft'
  | 'ghost'
  | 'danger'
  | 'dangerSoft'
  | 'accentQuiet';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent border-accent text-white hover:bg-accent-hover hover:border-accent-hover font-semibold',
  secondary: 'bg-surface border-line text-fg hover:bg-surface-2 font-medium',
  soft: 'bg-surface-2 border-line text-fg hover:bg-surface font-medium',
  ghost: 'bg-transparent border-transparent text-accent hover:bg-surface-2 font-medium',
  danger: 'bg-danger border-transparent text-white hover:opacity-90 font-semibold',
  dangerSoft: 'bg-danger-quiet border-danger text-danger hover:opacity-90 font-semibold',
  accentQuiet: 'bg-accent-quiet border-accent text-accent hover:opacity-90 font-semibold',
};

const SIZE: Record<ButtonSize, string> = {
  xs: 'h-[26px] px-2.5 text-[11.5px] gap-1.5',
  sm: 'h-[30px] px-3 text-xs gap-1.5',
  md: 'h-[34px] px-3 text-[13px] gap-2',
  lg: 'h-[38px] px-4 text-[13px] gap-2',
  xl: 'h-[42px] px-4 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'secondary', size = 'md', full, className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center whitespace-nowrap rounded-8 border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none',
        VARIANT[variant],
        SIZE[size],
        full && 'w-full',
        className,
      )}
      {...rest}
    />
  ),
);
Button.displayName = 'Button';
