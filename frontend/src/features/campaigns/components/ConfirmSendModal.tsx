import { Button, IconBadge, Modal } from '@/components/ui';
import type { V } from '@/hooks/useApp';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

export function ConfirmSendModal({ v }: { v: V }) {
  return (
    <Modal onClose={v.closeConfirm} panelClassName="max-w-[440px] overflow-hidden">
      <div className="px-5 pt-5">
        <IconBadge iconName={v.confirmIconName} tone={v.confirmTone} size={40} iconSize={18} rounded="rounded-10" className="mb-3.5" />
        <h3 className="text-[16px] font-bold mb-1.5">{v.confirmTitle}</h3>
        <p className="text-[13px] text-muted leading-relaxed">{v.confirmDesc}</p>
      </div>
      <div className="mx-5 my-4 px-3.5 py-3 bg-surface-2 border border-line rounded-8 flex flex-col gap-2 text-[12.5px]">
        <Row label="Recipients" value={`${v.confirmRecip} unique`} />
        <Row label="Sender accounts" value={`${v.confirmAccts} rotating`} />
        <Row label="Daily cap / account" value={String(v.confirmCap)} />
        <Row label="Mode" value={v.confirmModeLabel} />
      </div>
      <div className="flex gap-2.5 px-5 pb-5">
        <Button variant="soft" size="lg" full className="h-10" onClick={v.closeConfirm}>Cancel</Button>
        <Button variant={v.isDraft ? 'primary' : 'danger'} size="lg" full className="h-10" onClick={v.doSend}>
          {v.confirmBtnLabel}
        </Button>
      </div>
    </Modal>
  );
}
