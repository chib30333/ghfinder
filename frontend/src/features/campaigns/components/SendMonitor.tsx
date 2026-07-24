import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { toneQuietBg, toneSolidBg, toneText } from '@/lib/tone';
import { Button, IconButton, InfoTip, Modal, ProgressBar } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

export function SendMonitor({ v }: { v: V }) {
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [v.monLogs]);

  return (
    <Modal panelClassName="max-w-[720px] max-h-[90vh] flex flex-col overflow-hidden" scrimClassName="p-6">
      <div className="flex items-center gap-2.5 px-[18px] py-4 border-b border-line">
        <h3 className="text-[15px] font-bold">{v.sendTitle}</h3>
        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-[3px] rounded-20 text-[11px] font-semibold', toneQuietBg[v.sendStatusTone], toneText[v.sendStatusTone])}>
          <span className={cn('w-1.5 h-1.5 rounded-full', toneSolidBg[v.sendStatusTone], v.sendStatusPulse && 'animate-pulse-soft')} />
          {v.sendStatusLabel}
        </span>
        <div className="ml-auto flex items-center gap-3.5 text-[11.5px] text-muted font-mono">
          <span>started {v.sendStarted}</span>
          <span>elapsed {v.sendElapsed}</span>
        </div>
        {v.sendActive && (
          <Button variant="dangerSoft" size="sm" onClick={v.stopSend}>
            {v.stopBtnLabel}
          </Button>
        )}
        {v.sendTerminal && (
          <IconButton onClick={v.closeSend} aria-label="Close"><Icon name="close" size={16} /></IconButton>
        )}
      </div>

      <div className="p-[18px] overflow-auto">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-[12px] text-muted">{v.sentFmt} of {v.totalFmt}</span>
          <span className="font-mono text-[13px]">{v.sendPct}%</span>
        </div>
        <ProgressBar pct={v.sendPct} tone="accent" heightClass="h-2" className="mb-2.5" />

        {v.curHas && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border border-line rounded-9">
            <span className="font-mono text-[11px] text-accent flex-none">{v.curSlot}</span>
            <div className="flex-1 min-w-0">
              <span className="text-[13px] font-medium">{v.curName}</span>{' '}
              <span className="font-mono text-[12px] text-muted">{v.curEmail}</span>
            </div>
            {v.waitingShow && (
              <span className="inline-flex items-center gap-1.5 text-[11.5px] text-warning">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse-soft" />
                {v.waitingLabel}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 mb-2 text-[10.5px] uppercase tracking-wide text-muted flex items-center gap-1.5">Per-account tally<InfoTip label={HINTS.sendTally} size={12} /></div>
        <div className="flex h-2 rounded-5 overflow-hidden mb-2.5">
          {v.monAccts.map((a) => (
            <div key={a.key} style={{ width: `${a.segWPct}%` }} className="bg-line border-r-2 border-surface relative">
              <div style={{ width: `${a.wPct}%`, background: a.color }} className="absolute inset-0" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
          {v.monAccts.map((a) => (
            <div key={a.key} className={cn('bg-surface-2 border rounded-9 p-[11px]', a.blocked ? 'border-danger opacity-75' : 'border-line')}>
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-[11px] text-accent">{a.slot}</span>
                <span className="font-mono text-[12px]">{a.sent}<span className="text-muted">/{a.cap}</span></span>
              </div>
              <div className="text-[10.5px] text-muted truncate mb-[7px]">{a.email}</div>
              {a.blocked ? (
                <span className="inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-danger">
                  <span className="w-1.5 h-1.5 rounded-full bg-danger flex-none" /> blocked for today
                </span>
              ) : (
                <ProgressBar pct={a.wPct} color={a.color} heightClass="h-[5px]" />
              )}
            </div>
          ))}
        </div>

        <div className="mt-4 mb-2 text-[10.5px] uppercase tracking-wide text-muted flex items-center gap-1.5">Log stream<InfoTip label={HINTS.sendLog} size={12} /></div>
        <div
          ref={logRef}
          role="log"
          aria-live="polite"
          aria-label="Send log stream"
          className="bg-base border border-line rounded-9 px-3.5 py-3 font-mono text-[11.5px] leading-[1.8] max-h-[220px] overflow-auto"
        >
          {v.monLogs.map((l) => (
            <div key={l.key} className={cn('whitespace-pre-wrap break-words', l.stream === 'stderr' ? 'text-danger' : 'text-muted')}>
              {l.line}
            </div>
          ))}
        </div>

        {v.sendTerminal && (
          <div className="mt-4 px-4 py-3.5 bg-surface-2 border border-line rounded-10">
            <div className="text-[13px] font-semibold mb-2.5">Run summary</div>
            <div className="grid grid-cols-3 gap-3">
              <div><div className="text-[11px] text-muted">Processed</div><div className="font-mono text-[16px] font-semibold mt-0.5">{v.summarySent}</div></div>
              <div><div className="text-[11px] text-muted">Duration</div><div className="font-mono text-[16px] font-semibold mt-0.5">{v.summaryDur}</div></div>
              <div><div className="text-[11px] text-muted">Exit reason</div><div className="text-[13px] font-semibold mt-1">{v.summaryReason}</div></div>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-2.5 px-[18px] py-4 border-t border-line">
        {v.sendActive && (
          <Button variant="dangerSoft" size="lg" className="ml-auto" onClick={v.stopSend}>
            {v.stopBtnLabel}
          </Button>
        )}
        {v.sendTerminal && (
          <Button variant="primary" size="lg" className="ml-auto" onClick={v.closeSend}>
            Done
          </Button>
        )}
      </div>
    </Modal>
  );
}
