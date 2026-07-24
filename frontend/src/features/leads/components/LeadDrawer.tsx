import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { Avatar, Badge, Button, Drawer, IconButton, Spinner } from '@/components/ui';
import type { V } from '@/hooks/useApp';

export function LeadDrawer({ v }: { v: V }) {
  const d = v.dLead;
  if (!d) return null;
  return (
    <Drawer onClose={v.closeDrawer}>
      <div className="flex items-center gap-3 p-[18px] border-b border-line sticky top-0 bg-surface z-[1]">
        <Avatar color={d.avColor} initials={d.avInit} size={44} fontSize={16} />
        <div className="flex-1 min-w-0">
          <div className="font-bold text-[16px]">{d.name}</div>
          <a href="#" className="font-mono text-[13px]">@{d.login}</a>
        </div>
        <IconButton size="lg" onClick={v.closeDrawer} aria-label="Close"><Icon name="close" size={16} /></IconButton>
      </div>

      <div className="p-[18px]">
        {v.drawerLoading && (
          <div className="mb-4 flex items-center gap-2 text-[12px] text-muted">
            <Spinner size={14} /> Loading full profile…
          </div>
        )}
        {d.bio && <p className="mb-4 text-[13px] leading-relaxed text-fg">{d.bio}</p>}

        <div className="grid grid-cols-2 gap-2.5 mb-[18px]">
          <div className="bg-surface-2 border border-line rounded-8 p-[11px]">
            <div className="text-[11px] text-muted">Followers</div>
            <div className="font-mono text-[18px] font-semibold mt-0.5">{d.followers}</div>
          </div>
          <div className="bg-surface-2 border border-line rounded-8 p-[11px]">
            <div className="text-[11px] text-muted">Public repos</div>
            <div className="font-mono text-[18px] font-semibold mt-0.5">{d.repos}</div>
          </div>
        </div>

        <div className="text-[11px] text-muted uppercase tracking-wide mb-2">Contact channels</div>
        <div className="flex flex-col gap-2 mb-[18px]">
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border border-line rounded-8">
            <Icon name="mail" size={15} className="text-muted" />
            <span className="font-mono text-[12.5px] flex-1">{d.emailOrDash}</span>
            {d.email && d.srcTag && <Badge tone={d.srcTone} variant="tag">{d.srcTag}</Badge>}
          </div>
          <div className="flex items-center gap-2.5 px-3 py-2.5 bg-surface-2 border border-line rounded-8">
            <Icon name="link" size={15} className="text-muted" />
            <span className="font-mono text-[12.5px]">{d.blog}</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-surface-2 border border-line rounded-8 text-[12.5px]">
              Telegram <span className={cn('ml-auto font-semibold', d.tgPresent ? 'text-success' : 'text-muted')}>{d.tgPresent ? 'present' : 'absent'}</span>
            </div>
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-surface-2 border border-line rounded-8 text-[12.5px]">
              Discord <span className={cn('ml-auto font-semibold', d.dcPresent ? 'text-success' : 'text-muted')}>{d.dcPresent ? 'present' : 'absent'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 text-[12px] text-muted mb-[18px]">
          <span>Source city: <span className="text-fg">{d.city}</span></span><span>·</span><span>Fetched {d.fetched}</span>
        </div>

        {}
        <button
          type="button"
          onClick={v.toggleRaw}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-surface-2 border border-line rounded-8 text-fg text-[12.5px] font-semibold cursor-pointer text-left hover:bg-surface transition-colors"
        >
          <Icon name="chev" size={18} className={cn('flex-none transition-transform', v.rawOpen ? 'rotate-0' : '-rotate-90')} />
          Raw JSON
        </button>
        {v.rawOpen && (
          <pre className="mt-2 p-3.5 bg-base border border-line rounded-8 font-mono text-[11.5px] leading-[1.7] text-muted overflow-auto">{d.raw}</pre>
        )}

        <div className="flex gap-2 mt-[18px]">
          <Button variant="soft" size="lg" full onClick={v.drawerCopy}>Copy email</Button>
          <Button variant="primary" size="lg" full onClick={v.drawerAdd}>Add to campaign</Button>
        </div>
      </div>
    </Drawer>
  );
}
