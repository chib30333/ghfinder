import { LoaderCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Spinner({ size = 20, className }: { size?: number; className?: string }) {
  return (
    <LoaderCircle
      size={size}
      strokeWidth={2.4}
      className={cn('animate-spin text-accent', className)}
      aria-hidden="true"
    />
  );
}
