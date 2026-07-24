import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';

export interface CheckSquareProps {
  checked: boolean;
  onClick?: (e: React.MouseEvent) => void;
  size?: 16 | 18;
  className?: string;
  'aria-label'?: string;
}

export function CheckSquare({ checked, onClick, size = 16, className, ...aria }: CheckSquareProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center flex-none rounded border-[1.5px] cursor-pointer transition-colors',
        size === 18 ? 'w-[18px] h-[18px]' : 'w-4 h-4',
        checked ? 'border-accent bg-accent text-white' : 'border-line bg-transparent',
        className,
      )}
      {...aria}
    >
      {checked && <Icon name="check" size={12} />}
    </button>
  );
}
