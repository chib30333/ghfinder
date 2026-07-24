import { cn } from '@/lib/utils';

export interface AvatarProps {
  color: string;
  initials: string;
  src?: string | null;
  size?: number;
  fontSize?: number;
  className?: string;
}

export function Avatar({ color, initials, src, size = 26, fontSize, className }: AvatarProps) {
  return (
    <span
      className={cn('flex-none rounded-full text-white inline-flex items-center justify-center font-semibold overflow-hidden', className)}
      style={{ background: src ? undefined : color, width: size, height: size, fontSize: fontSize ?? Math.round(size * 0.42) }}
    >
      {src ? <img src={src} alt="" className="w-full h-full object-cover" draggable={false} /> : initials}
    </span>
  );
}
