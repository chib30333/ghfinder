import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import type { Tone } from '@/types';
import { toneQuietBg, toneText } from '@/lib/tone';

export interface IconBadgeProps {
  iconName: string;
  tone?: Tone;
  size?: number;
  iconSize?: number;
  rounded?: string;
  className?: string;
}

export function IconBadge({ iconName, tone = 'neutral', size = 26, iconSize, rounded = 'rounded-7', className }: IconBadgeProps) {
  return (
    <span
      className={cn('flex-none inline-flex items-center justify-center', rounded, toneQuietBg[tone], toneText[tone], className)}
      style={{ width: size, height: size }}
    >
      <Icon name={iconName} size={iconSize ?? Math.round(size * 0.54)} />
    </span>
  );
}
