import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface ModalProps {
  onClose?: () => void;
  align?: 'center' | 'top';
  z?: 50 | 60;
  panelClassName?: string;
  scrimClassName?: string;
  children: ReactNode;
}

const Z: Record<50 | 60, string> = { 50: 'z-50', 60: 'z-[60]' };

export function Modal({ onClose, align = 'center', z = 60, panelClassName, scrimClassName, children }: ModalProps) {
  return (
    <div
      onClick={onClose}
      className={cn(
        'fixed inset-0 flex justify-center p-5 bg-black/55 animate-fade',
        Z[z],
        align === 'center' ? 'items-center' : 'items-start pt-[14vh]',
        scrimClassName,
      )}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn('w-full bg-surface border border-line rounded-12 shadow-modal', panelClassName)}
      >
        {children}
      </div>
    </div>
  );
}
