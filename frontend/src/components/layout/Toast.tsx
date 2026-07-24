import { cn } from '@/lib/utils';
import { toneText } from '@/lib/tone';
import { Icon } from '@/lib/icons';
import type { V } from '@/hooks/useApp';

export function Toast({ v }: { v: V }) {
  if (!v.toast) return null;
  return (
    <div className="fixed bottom-[22px] left-1/2 -translate-x-1/2 z-[70] flex items-center gap-2.5 px-4 py-[11px] bg-surface-2 border border-line rounded-10 shadow-toast animate-toast">
      <span className={cn('flex', toneText[v.toastTone])}>
        <Icon name={v.toastIconName} size={15} />
      </span>
      <span className="text-[13px] font-medium">{v.toast}</span>
    </div>
  );
}
