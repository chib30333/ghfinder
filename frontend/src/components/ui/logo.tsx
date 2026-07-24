import { cn } from '@/lib/utils';

export function Logo({ size = 26, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn('flex-none rounded-7 bg-logo text-white font-bold font-mono inline-flex items-center justify-center', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.55) }}
      aria-hidden="true"
    >
      g
    </span>
  );
}
