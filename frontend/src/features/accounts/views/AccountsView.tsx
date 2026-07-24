import { Icon } from '@/lib/icons';
import { Avatar, Badge, Button, Card, CheckSquare, DataTable, Dot, InfoTip, Menu, ProgressBar, StateCard, type Column } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

type AcctRow = V['roster'][number];

export function AccountsView({ v }: { v: V }) {
  const columns: Column<AcctRow>[] = [
    {
      id: 'slot',
      header: 'Slot',
      sortable: true,
      sortValue: (a) => a.slot,
      cell: (a) => <span className="font-mono text-[11px] px-[7px] py-[3px] rounded-6 bg-surface-2 border border-line text-muted">{a.slot}</span>,
    },
    {
      id: 'account',
      header: 'Account',
      sortable: true,
      sortValue: (a) => a.email,
      className: 'min-w-0',
      cell: (a) => (
        <span className="flex items-center gap-2.5 min-w-0">
          <Avatar color={a.color} initials={a.init} size={30} fontSize={11} />
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <Dot tone={a.dotTone} pulse={a.dotPulse} />
              <span className="text-[13px] font-mono font-medium truncate">{a.email}</span>
            </span>
            <span className="block text-[11px] text-muted truncate mt-0.5">{a.title}</span>
          </span>
        </span>
      ),
    },
    { id: 'status', header: 'Status', sortable: true, sortValue: (a) => a.statusLabel, cell: (a) => <Badge tone={a.statusTone}>{a.statusLabel}</Badge> },
    {
      id: 'cap',
      header: 'Daily cap',
      sortable: true,
      sortValue: (a) => a.capPct,
      cell: (a) => (
        <div className="w-[120px]">
          <div className="flex justify-between font-mono text-[11px] mb-[5px]">
            <span>{a.sent}<span className="text-muted">/{a.cap}</span></span>
            <span className="text-muted">{a.capPct}%</span>
          </div>
          <ProgressBar pct={a.capPct} tone={a.capTone} heightClass="h-[5px]" />
        </div>
      ),
    },
    {
      id: 'include',
      header: 'Include',
      align: 'center',
      cell: (a) => <CheckSquare checked={a.enabled} onClick={a.toggleEnabled} size={18} aria-label="Include in run" />,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (a) => (
        <Menu
          label="Account actions"
          items={[
            { key: 'open', label: 'Open this mailbox', onSelect: a.openMailbox },
            { key: 'exclude', label: 'Exclude from this run', tone: 'warning', onSelect: a.exclude },
          ]}
        />
      ),
    },
  ];

  return (
    <section aria-label="Senders and connection" data-screen-label="Accounts">
      <div data-pagehead className="flex items-end justify-between gap-4 mb-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">Senders &amp; connection<InfoTip label={HINTS.acctPage} size={16} /></h1>
          <p className="mt-[5px] text-muted text-[13px]">Gmail accounts driven over Chrome DevTools Protocol. Sending rotates round-robin across every enabled account.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={v.clearDailyCap} disabled={!v.hasDailySends} title="Reset every account's sent-today count to 0">Clear daily cap</Button>
          <Button onClick={v.refreshAccounts}>Refresh</Button>
        </div>
      </div>

      {v.accountsError ? (
        <Card>
          <StateCard
            variant="error"
            title="Couldn't reach the accounts API"
            description="Check that the backend API is running, then retry."
            action={<Button variant="primary" onClick={v.retryCdp}>Retry</Button>}
          />
        </Card>
      ) : v.accountsLoading ? (
        <Card><StateCard variant="loading" title="Discovering Gmail accounts…" /></Card>
      ) : (
      <>
      {v.cdpUp && (
        <div className="flex items-center gap-3 px-4 py-[13px] mb-4 bg-success-quiet border border-success rounded-10">
          <span className="w-7 h-7 flex-none rounded-8 bg-surface flex items-center justify-center text-success"><Icon name="check" size={16} /></span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold">Chrome CDP connected</div>
            <div className="text-[12px] text-muted">Endpoint <span className="font-mono text-fg">{v.endpointFull}</span> · <span className="font-mono text-fg">{v.discoveredFmt}</span> mailboxes discovered</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={v.addAccount}><Icon name="plus" size={14} /> Add Gmail account</Button>
            <Button variant="secondary" size="sm" className="bg-transparent text-muted" onClick={v.simCdpDown} title="Demo: drop the connection">Simulate down</Button>
          </div>
        </div>
      )}

      {v.cdpDown && (
        <div className="p-4 mb-4 bg-danger-quiet border border-danger rounded-10">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 flex-none rounded-8 bg-surface flex items-center justify-center text-danger"><Icon name="alert" size={16} /></span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-semibold">Chrome debugging port not reachable</div>
              <div className="text-[12px] text-muted">Sending is disabled everywhere until the browser is connected.</div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="md" className="h-8" onClick={v.launchBrowser} disabled={v.launching}>
                <Icon name="globe" size={14} /> {v.launching ? 'Launching…' : 'Launch Chrome'}
              </Button>
              <Button variant="danger" size="md" className="h-8" onClick={v.retryCdp}>Retry</Button>
            </div>
          </div>
          <div className="mt-3 px-3.5 py-3 bg-base border border-line rounded-8 text-[12.5px] text-muted leading-[1.9]">
            <div className="text-fg font-semibold mb-1">How to connect</div>
            <div>Press <span className="text-fg font-semibold">Launch Chrome</span> to start a debug browser automatically — or do it by hand:</div>
            <div>1 · Launch Chrome with <span className="font-mono text-fg">--remote-debugging-port=9222</span></div>
            <div>2 · Sign into one or more Gmail accounts in that window</div>
            <div>3 · Keep the window open, then press <span className="text-fg font-semibold">Retry</span></div>
          </div>
        </div>
      )}

      {v.cdpUp && (
        <>
          <Card clip className="mb-4">
            <DataTable
              columns={columns}
              data={v.roster}
              rowKey={(a) => a.key}
              filterable
              filterPlaceholder="Filter accounts…"
              filterText={(a) => `${a.email} ${a.title} ${a.slot}`}
              emptyState={{
                iconName: 'users',
                title: 'No accounts discovered',
                description: 'Sign into one or more Gmail accounts in the debug Chrome, then refresh.',
                action: (
                  <div className="flex items-center gap-2">
                    <Button variant="primary" onClick={v.addAccount}><Icon name="plus" size={15} /> Add Gmail account</Button>
                    <Button onClick={v.refreshAccounts}>Refresh</Button>
                  </div>
                ),
              }}
            />
          </Card>

          <div data-stack className="grid grid-cols-[1fr_300px] gap-[14px] items-start">
            <Card className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14px] font-semibold flex items-center gap-1.5">Rotation preview<InfoTip label={HINTS.acctRotation} /></h3>
                <span className="text-[12px] text-muted"><span className="font-mono text-fg">{v.recip}</span> recipients · <span className="font-mono text-fg">{v.enabledCount}</span> accounts</span>
              </div>
              {v.hasEnabled && (
                <>
                  <div className="flex h-[34px] rounded-8 overflow-hidden border border-line">
                    {v.rotation.map((r) => (
                      <div
                        key={r.key}
                        style={{ width: `${r.wPct}%`, background: `color-mix(in srgb, ${r.color} 22%, var(--surface))` }}
                        className="flex flex-col items-center justify-center border-r border-line"
                      >
                        <span className="font-mono text-[10px] text-muted">{r.slot}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex h-2 rounded-5 overflow-hidden mt-1.5">
                    {v.rotation.map((r) => (
                      <div key={r.key} style={{ width: `${r.wPct}%`, background: r.color }} className="border-r-2 border-surface" />
                    ))}
                  </div>
                  <div className="mt-3 text-[13px] text-muted">Round-robin splits to <span className="font-mono text-fg">≈ {v.perAcctEst}</span> messages per account.</div>
                </>
              )}
              {v.noEnabled && <div className="p-5 text-center text-muted text-[13px]">Enable at least one account to preview rotation.</div>}
            </Card>

            <div className="flex gap-2.5 bg-warning-quiet border border-warning rounded-10 p-3.5">
              <Icon name="shield" size={16} className="text-warning flex-none" />
              <span className="text-[12px] text-fg leading-snug">Per-account caps are protective daily limits. Gmail throttles new accounts fast — {v.safeDailyCap} messages/account/day is the safe ceiling to protect deliverability.</span>
            </div>
          </div>
        </>
      )}
      </>
      )}
    </section>
  );
}
