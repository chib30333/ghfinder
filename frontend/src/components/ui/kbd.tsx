import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface KbdProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export function Kbd({ children, className, ...rest }: KbdProps) {
  return (
    <span
      className={cn('font-mono text-[11px] bg-base border border-line rounded-5 px-1.5 py-0.5 text-muted', className)}
      {...rest}
    >
      {children}
    </span>
  );
}
