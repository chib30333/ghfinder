import { cn } from '@/lib/utils';
import type { Tone } from '@/types';
import { toneSolidBg } from '@/lib/tone';

export interface ProgressBarProps {
  pct: number;
  tone?: Tone;
  color?: string;
  heightClass?: string;
  trackClass?: string;
  className?: string;
}

export function ProgressBar({ pct, tone = 'accent', color, heightClass = 'h-1.5', trackClass, className }: ProgressBarProps) {
  const width = `${Math.max(0, Math.min(100, pct))}%`;
  return (
    <div className={cn('rounded-full bg-line overflow-hidden', heightClass, trackClass, className)}>
      <div
        className={cn('h-full rounded-full transition-all', !color && toneSolidBg[tone])}
        style={{ width, background: color }}
      />
    </div>
  );
}
