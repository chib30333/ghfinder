import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { Button, Card, IconBadge, InfoTip, Input, RadioRow, Segmented, Textarea } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { Mode } from '@/types';
import type { V } from '@/hooks/useApp';

export function CampaignsView({ v }: { v: V }) {
  return (
    <section aria-label="Campaigns" data-screen-label="Campaigns">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">New campaign<InfoTip label={HINTS.campPage} size={16} /></h1>
        <p className="mt-[5px] text-muted text-[13px]">Personalized cold outreach across rotating Gmail senders.</p>
      </div>

      <div data-stack className="grid grid-cols-[1fr_380px] gap-[14px] items-start">
        {}
        <div className="flex flex-col gap-[14px]">
          <Card className="p-4">
            <div className="flex items-center mb-3">
              <h3 className="text-[14px] font-semibold flex items-center gap-1.5">Template<InfoTip label={HINTS.campTemplate} /></h3>
              <Button variant="accentQuiet" size="xs" className="ml-auto font-mono" onClick={v.insertToken}>
                {v.tokenChip}
              </Button>
            </div>
            <label className="text-[11px] text-muted">Subject<Input value={v.subject} onChange={v.onSubject} inputSize="lg" className="mt-1.5" /></label>
            <label className="text-[11px] text-muted block mt-3">Message<Textarea value={v.body} onChange={v.onBody} rows={7} className="mt-1.5" /></label>
            <div className="mt-3.5 pt-3.5 border-t border-dashed border-line">
              <div className="text-[10.5px] uppercase tracking-wide text-muted mb-2">Required footer</div>
              <label className="text-[11px] text-muted block">Sender identity line<Input value={v.senderIdentity} onChange={v.onIdentity} className="mt-1.5" /></label>
              <label className="text-[11px] text-muted block mt-2.5">Unsubscribe / opt-out line<Textarea value={v.unsubLine} onChange={v.onUnsub} rows={2} className="mt-1.5 text-[12.5px]" /></label>
            </div>
          </Card>

          <Card clip>
            <div className="px-4 py-[11px] border-b border-line flex items-center gap-2">
              <h3 className="text-[13px] font-semibold flex items-center gap-1.5">Live preview<InfoTip label={HINTS.campPreview} size={13} /></h3>
              <span className="text-[11px] text-muted">→ {v.sampleEmail}</span>
            </div>
            <div className="p-4">
              <div className="text-[11px] text-muted mb-0.5">Subject</div>
              <div className="font-semibold mb-3.5">{v.previewSubject}</div>
              <div className="text-[13px] leading-[1.7] whitespace-pre-wrap text-fg">{v.previewBody}</div>
              <div className="mt-4 pt-3 border-t border-line text-[12px] text-muted leading-relaxed">
                <div className="text-fg">{v.previewIdentity}</div>
                <div className="mt-1">{v.previewUnsub}</div>
              </div>
            </div>
          </Card>
        </div>

        {}
        <div className="flex flex-col gap-[14px]">
          <Card className="p-4">
            <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">Scope<InfoTip label={HINTS.campScope} /></h3>
            <div className="flex flex-col gap-2">
              <RadioRow checked={v.scopeAll} onClick={v.setScopeAll}>Everyone from #index</RadioRow>
              <RadioRow checked={v.scopeCount} onClick={v.setScopeCount}>A fixed count from #index</RadioRow>
            </div>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <label className="text-[11px] text-muted">Start index<Input value={v.startIndex} onChange={v.onStartIndex} type="number" mono className="mt-1.5 rounded-7" /></label>
              <label className="text-[11px] text-muted">Count<Input value={v.count} onChange={v.onCount} type="number" mono disabled={v.countDisabled} className={cn('mt-1.5 rounded-7', v.countDisabled && 'opacity-50')} /></label>
            </div>
            <div className="mt-2.5 px-[11px] py-2.5 bg-surface-2 rounded-8 text-[12px] text-muted">
              Resolves to <span className="font-mono text-fg">{v.recip}</span> unique recipients.
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center mb-2.5">
              <h3 className="text-[14px] font-semibold flex items-center gap-1.5">Sending accounts<InfoTip label={HINTS.campSenders} /></h3>
              <Button variant="soft" size="xs" className="ml-auto" onClick={v.useAllAccounts}>Use all</Button>
            </div>
            <div className="flex flex-wrap gap-[7px]">
              {v.senderChips.map((c) => (
                <span
                  key={c.key}
                  onClick={c.toggle}
                  className={cn(
                    'inline-flex items-center px-2.5 py-[5px] rounded-20 text-[12px] font-semibold font-mono cursor-pointer border transition-colors',
                    c.on ? 'bg-accent-quiet text-accent border-accent' : c.capped ? 'bg-surface-2 text-muted border-line' : 'bg-surface-2 text-fg border-line',
                  )}
                >
                  {c.slot}
                </span>
              ))}
            </div>
            <label className="block mt-4 text-[11px] text-muted">
              <span className="flex justify-between">
                <span>Per-account daily limit — stop each account at N messages/day</span>
                <span className="font-mono text-fg">{v.dailyCap}</span>
              </span>
              {}
              <input type="range" min={1} max={50} step={1} value={v.dailyCap} onChange={v.onCap} className="w-full mt-2 accent-accent" />
            </label>
            {v.capOverGmail ? (
              <div className="mt-2 px-[11px] py-2 bg-warning-quiet rounded-7 text-[11.5px] text-warning leading-snug">
                Above the safe {v.safeDailyCap}/account/day limit. Gmail throttles new accounts fast — higher caps risk deliverability and account blocks.
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-muted">{v.safeDailyCap} messages/account/day is the safe ceiling — Gmail throttles new accounts fast, so staying at or under protects deliverability.</div>
            )}
          </Card>

          <Card className="p-4">
            <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">Pre-flight<InfoTip label={HINTS.campPreflight} /></h3>
            <div className="flex flex-col gap-2.5">
              {v.checklist.map((ck) => (
                <div key={ck.key} className="flex items-center gap-2.5">
                  <IconBadge iconName={ck.iconName} tone={ck.tone} size={22} iconSize={13} rounded="rounded-6" />
                  <span className="text-[12.5px] flex-1">{ck.label}</span>
                  <span className="text-[11px] text-muted font-mono">{ck.hint}</span>
                </div>
              ))}
            </div>
            <div className="mt-3.5 px-3 py-[11px] bg-surface-2 rounded-8 text-[12.5px] text-fg leading-snug">{v.recap}</div>
          </Card>

          <Card className="p-4">
            <h3 className="text-[14px] font-semibold mb-2.5 flex items-center gap-1.5">Mode<InfoTip label={HINTS.campMode} /></h3>
            <Segmented
              className="w-full flex mb-1.5"
              value={v.mode}
              onChange={(mode: Mode) => v.setMode(mode)}
              options={[
                { value: 'draft', label: 'Draft only' },
                { value: 'send', label: 'Send', activeClass: 'bg-danger text-white' },
              ]}
            />
            <p className="mb-3 text-[11.5px] text-muted leading-snug">{v.modeNote}</p>
            <Button full size="xl" variant={v.isDraft ? 'primary' : 'danger'} disabled={v.launchDisabled} onClick={v.openConfirm}>
              <Icon name={v.launchIconName} size={15} /> {v.launchLabel}
            </Button>
            {v.launchDisabled && <p className="mt-2 text-[11px] text-warning text-center">{v.launchBlockedNote}</p>}
            <div className="mt-3 px-3 py-2.5 bg-info-quiet rounded-8 text-[11.5px] text-muted leading-normal">
              <span className="text-info font-semibold">Source:</span> recipients came from GitHub leads harvested by location. You are accountable for who you contact.
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
