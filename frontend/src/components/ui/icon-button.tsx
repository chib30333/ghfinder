import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type IconButtonSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZE: Record<IconButtonSize, string> = {
  sm: 'w-7 h-7 rounded-6',
  md: 'w-[30px] h-[30px] rounded-7',
  lg: 'w-8 h-8 rounded-8',
  xl: 'w-[34px] h-[34px] rounded-8',
};

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: IconButtonSize;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ size = 'md', className, type = 'button', ...rest }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center flex-none border border-line bg-surface-2 text-muted hover:bg-surface cursor-pointer transition-colors disabled:opacity-50 disabled:pointer-events-none',
        SIZE[size],
        className,
      )}
      {...rest}
    />
  ),
);
IconButton.displayName = 'IconButton';
