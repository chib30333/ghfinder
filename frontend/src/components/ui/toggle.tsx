import { cn } from '@/lib/utils';

export interface ToggleProps {
  checked: boolean;
  onClick?: (e: React.MouseEvent) => void;
  disabled?: boolean;
  className?: string;
  'aria-label'?: string;
}

export function Toggle({ checked, onClick, disabled, className, ...aria }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative inline-flex flex-none w-[34px] h-5 rounded-20 transition-colors cursor-pointer',
        checked ? 'bg-accent' : 'bg-line',
        disabled && 'cursor-default opacity-80',
        className,
      )}
      {...aria}
    >
      <span
        className={cn(
          'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
          checked ? 'left-[16px]' : 'left-0.5',
        )}
      />
    </button>
  );
}
