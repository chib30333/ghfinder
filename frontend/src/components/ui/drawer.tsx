import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface DrawerProps {
  onClose?: () => void;
  children: ReactNode;
  className?: string;
}

export function Drawer({ onClose, children, className }: DrawerProps) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 bg-black/50 z-40 animate-fade-slow" />
      <aside
        className={cn(
          'fixed top-0 right-0 bottom-0 w-[440px] max-w-[92vw] bg-surface border-l border-line z-[41] overflow-auto animate-slide',
          className,
        )}
      >
        {children}
      </aside>
    </>
  );
}
