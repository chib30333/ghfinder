import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { Spinner } from './spinner';

export type StateVariant = 'loading' | 'error' | 'empty';

export interface StateCardProps {
  variant?: StateVariant;
  title: string;
  description?: string;
  iconName?: string;
  action?: ReactNode;
  className?: string;
}

export function StateCard({ variant = 'empty', title, description, iconName, action, className }: StateCardProps) {
  return (
    <div className={cn('flex flex-col items-center text-center px-5 py-14', className)}>
      <div className="w-11 h-11 mb-3.5 rounded-11 bg-surface-2 flex items-center justify-center text-muted">
        {variant === 'loading' ? (
          <Spinner size={22} />
        ) : (
          <Icon name={iconName ?? (variant === 'error' ? 'alert' : 'search')} size={20} />
        )}
      </div>
      <div className="font-semibold mb-1">{title}</div>
      {description && <div className="text-muted text-[13px] mb-3.5 max-w-sm">{description}</div>}
      {action && <div className="pt-0.5">{action}</div>}
    </div>
  );
}
