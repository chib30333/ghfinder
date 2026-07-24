import { useEffect, useRef } from 'react';
import { Icon } from '@/lib/icons';
import { Kbd, Modal } from '@/components/ui';
import type { V } from '@/hooks/useApp';

export function CommandPalette({ v }: { v: V }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <Modal onClose={v.closePalette} align="top" z={50} panelClassName="max-w-[560px] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-line">
        <Icon name="search" size={16} className="text-muted" />
        {}
        <input
          ref={inputRef}
          placeholder="Jump to a screen or run an action…"
          className="flex-1 bg-transparent border-none outline-none text-[15px] text-fg placeholder:text-muted"
        />
        <Kbd>esc</Kbd>
      </div>
      <div className="p-2 max-h-[340px] overflow-auto">
        <div className="text-[10.5px] text-muted uppercase tracking-wide px-2.5 pt-2 pb-1">Navigate</div>
        {v.nav.map((item) => (
          <div
            key={item.key}
            onClick={item.go}
            className="flex items-center gap-2.5 px-2.5 py-2 rounded-8 cursor-pointer text-fg hover:bg-surface-2"
          >
            <Icon name={item.iconName} size={18} className="text-muted" />
            <span className="text-[13.5px]">{item.label}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
