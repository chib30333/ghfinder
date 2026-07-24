import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { IconButton } from './icon-button';

export type MenuItemTone = 'default' | 'warning' | 'danger';

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  tone?: MenuItemTone;
  disabled?: boolean;
}

export interface MenuProps {
  items: MenuItem[];
  label: string;
  trigger?: ReactNode;
  align?: 'left' | 'right';
  width?: number;
}

const GAP = 6;
const MARGIN = 8;
const ITEM_H = 36;
const PANEL_PAD = 8;

const TONE: Record<MenuItemTone, string> = {
  default: 'text-fg hover:bg-surface-2',
  warning: 'text-warning hover:bg-danger-quiet',
  danger: 'text-danger hover:bg-danger-quiet',
};

export function Menu({ items, label, trigger, align = 'right', width = 180 }: MenuProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; flip: boolean }>({ left: 0, top: 0, flip: false });

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const estH = items.length * ITEM_H + PANEL_PAD;
    const flip = r.bottom + GAP + estH + MARGIN > window.innerHeight && r.top - GAP - estH > MARGIN;
    let left = align === 'right' ? r.right - width : r.left;
    left = Math.max(MARGIN, Math.min(left, window.innerWidth - width - MARGIN));
    setPos({ left, top: flip ? r.top - GAP : r.bottom + GAP, flip });
  }, [align, width, items.length]);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setOpen((was) => {
        if (!was) place();
        return !was;
      });
    },
    [place],
  );

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

  return (
    <>
      <IconButton ref={triggerRef} onClick={toggle} aria-label={label} aria-haspopup="menu" aria-expanded={open}>
        {trigger ?? <Icon name="dots" size={16} />}
      </IconButton>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            {}
            <div className="fixed inset-0 z-[90]" onClick={close} />
            <div
              role="menu"
              style={{ left: pos.left, top: pos.top, width, transform: pos.flip ? 'translateY(-100%)' : undefined }}
              className="fixed z-[91] bg-surface border border-line rounded-9 shadow-menu-sm p-1 animate-fade text-left"
            >
              {items.map((it) => (
                <div
                  key={it.key}
                  role="menuitem"
                  aria-disabled={it.disabled || undefined}
                  onClick={it.disabled ? undefined : () => { close(); it.onSelect(); }}
                  className={cn(
                    'px-2.5 py-2 rounded-6 text-[12.5px]',
                    it.disabled ? 'text-muted opacity-60 cursor-default' : cn('cursor-pointer', TONE[it.tone ?? 'default']),
                  )}
                >
                  {it.label}
                </div>
              ))}
            </div>
          </>,
          document.body,
        )}
    </>
  );
}
