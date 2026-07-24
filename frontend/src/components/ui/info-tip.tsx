import type { ReactNode } from 'react';
import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

export interface InfoTipProps {
  label: ReactNode;
  size?: number;
  side?: 'top' | 'bottom';
  'aria-label'?: string;
  className?: string;
}

export function InfoTip({ label, size = 14, side = 'top', className, ...rest }: InfoTipProps) {
  return (
    <Tooltip content={label} side={side} className={cn('align-middle', className)}>
      <button
        type="button"
        aria-label={rest['aria-label'] ?? 'More information'}
        className="inline-flex items-center justify-center flex-none rounded-full text-muted cursor-help outline-none transition-colors hover:text-fg focus-visible:text-fg focus-visible:ring-2 focus-visible:ring-accent"
      >
        <Icon name="info" size={size} />
      </button>
    </Tooltip>
  );
}
