import { cn } from '@/lib/utils';
import type { Tone } from '@/types';
import { toneSolidBg } from '@/lib/tone';

export interface DotProps {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}

export function Dot({ tone = 'neutral', pulse, className }: DotProps) {
  return (
    <span
      className={cn(
        'inline-block w-[7px] h-[7px] rounded-full flex-none',
        toneSolidBg[tone],
        pulse && 'animate-pulse-soft',
        className,
      )}
    />
  );
}
