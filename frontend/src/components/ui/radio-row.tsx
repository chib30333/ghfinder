import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface RadioRowProps {
  checked: boolean;
  onClick?: (e: React.MouseEvent) => void;
  children: ReactNode;
  className?: string;
}

export function RadioRow({ checked, onClick, children, className }: RadioRowProps) {
  return (
    <label onClick={onClick} className={cn('flex items-center gap-2.5 cursor-pointer text-[13px]', className)}>
      <span
        className={cn(
          'w-4 h-4 flex-none rounded-full border-[1.5px] flex items-center justify-center transition-colors',
          checked ? 'border-accent' : 'border-line',
        )}
      >
        <span className={cn('w-2 h-2 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-transparent')} />
      </span>
      {children}
    </label>
  );
}
