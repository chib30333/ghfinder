import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Tone } from '@/types';
import { toneQuietBg, toneSolidBg, toneText } from '@/lib/tone';

export type BadgeVariant = 'pill' | 'tag';

export interface BadgeProps {
  tone?: Tone;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

const VARIANT: Record<BadgeVariant, string> = {
  pill: 'gap-1.5 rounded-20 px-2.5 py-1 text-[11px]',
  tag: 'rounded-5 px-1.5 py-0.5 text-[10px] uppercase tracking-wide',
};

export function Badge({ tone = 'neutral', variant = 'pill', dot, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-semibold whitespace-nowrap',
        VARIANT[variant],
        toneQuietBg[tone],
        toneText[tone],
        className,
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-none', toneSolidBg[tone])} />}
      {children}
    </span>
  );
}
