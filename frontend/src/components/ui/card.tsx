import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  clip?: boolean;
}

export function Card({ clip, className, ...rest }: CardProps) {
  return (
    <div
      className={cn('bg-surface border border-line rounded-10', clip && 'overflow-hidden', className)}
      {...rest}
    />
  );
}
