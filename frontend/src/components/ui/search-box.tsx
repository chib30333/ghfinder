import type { ChangeEventHandler } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';

export interface SearchBoxProps {
  value: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  placeholder?: string;
  className?: string;
  iconName?: string;
}

export function SearchBox({ value, onChange, placeholder, className, iconName = 'search' }: SearchBoxProps) {
  return (
    <div className={cn('flex items-center gap-2 h-[34px] px-3 bg-surface border border-line rounded-8', className)}>
      <Icon name={iconName} size={16} className="text-muted flex-none" />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="flex-1 min-w-0 bg-transparent border-none outline-none text-[13px] text-fg placeholder:text-muted"
      />
    </div>
  );
}
