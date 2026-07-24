import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type Placement = 'top' | 'bottom';

const GAP = 8;
const OPEN_DELAY = 90;
const FLIP_TOP = 96;

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  side?: Placement;
  focusable?: boolean;
  className?: string;
  contentClassName?: string;
}

export function Tooltip({ content, children, side = 'top', focusable, className, contentClassName }: TooltipProps) {
  const id = useId();
  const wrapRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number; placement: Placement }>({ x: 0, y: 0, placement: side });

  const place = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const placement: Placement = side === 'top' && r.top < FLIP_TOP ? 'bottom' : side;
    setPos({
      x: r.left + r.width / 2,
      y: placement === 'top' ? r.top - GAP : r.bottom + GAP,
      placement,
    });
  }, [side]);

  const show = useCallback(() => {
    clearTimeout(timer.current);
    place();
    setOpen(true);
  }, [place]);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setOpen(false);
  }, []);

  const onEnter = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(show, OPEN_DELAY);
  }, [show]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onShift = () => setOpen(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onShift, true);
    window.addEventListener('resize', onShift);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onShift, true);
      window.removeEventListener('resize', onShift);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <span
      ref={wrapRef}
      className={cn('inline-flex', className)}
      tabIndex={focusable ? 0 : undefined}
      onMouseEnter={onEnter}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            id={id}
            role="tooltip"
            style={{
              left: pos.x,
              top: pos.y,
              transform: pos.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
            className={cn(
              'fixed z-[100] max-w-[260px] px-2.5 py-1.5 rounded-8 border border-line bg-surface text-fg text-[12px] leading-snug shadow-menu-sm animate-fade pointer-events-none',
              contentClassName,
            )}
          >
            {content}
          </div>,
          document.body,
        )}
    </span>
  );
}
