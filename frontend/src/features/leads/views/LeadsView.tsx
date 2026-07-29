import { Icon } from '@/lib/icons';
import { cn } from '@/lib/utils';
import { Avatar, Badge, Button, Card, DataTable, IconButton, InfoTip, SearchBox, Toggle, type Column } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

type LeadRow = V['leads'][number];

function Trunc({ value, width }: { value: string; width: string }) {
  return (
    <span className={cn('block truncate', width)} title={value || undefined}>
      {value}
    </span>
  );
}

export function LeadsView({ v }: { v: V }) {
  const columns: Column<LeadRow>[] = [
    {
      id: 'login',
      header: 'Login',
      sortable: true,
      cell: (u) => (
        <span className="flex items-center gap-2.5">
          <Avatar color={u.avColor} initials={u.avInit} size={26} />
          <a
            href={u.ghUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={u.ghUrl}
            className="font-mono font-medium"
          >
            {u.login}
          </a>
        </span>
      ),
    },
    { id: 'name', header: 'Name', cell: (u) => <Trunc value={u.name} width="max-w-[150px]" /> },
    { id: 'loc', header: 'Location', className: 'text-muted', cell: (u) => <Trunc value={u.loc} width="max-w-[160px]" /> },
    {
      id: 'email',
      header: 'Email',
      cell: (u) =>
        u.email ? (
          <span className="flex items-center gap-1.5 max-w-[190px]">
            <span className="font-mono text-[12px] truncate min-w-0" title={u.email}>{u.email}</span>
            <Badge tone={u.srcTone} variant="tag">{u.srcTag}</Badge>
          </span>
        ) : (
          <span className="text-muted text-[12px]">—</span>
        ),
    },
    { id: 'status', header: 'Status', cell: (u) => <Badge tone={u.statusTone} dot>{u.status}</Badge> },
    { id: 'followers', header: 'Followers', sortable: true, align: 'right', className: 'font-mono', cell: (u) => u.followers },
    { id: 'repos', header: 'Repos', sortable: true, align: 'right', className: 'font-mono text-muted', cell: (u) => u.repos },
    { id: 'company', header: 'Company', className: 'text-muted', cell: (u) => <Trunc value={u.company} width="max-w-[150px]" /> },
    {
      id: 'actions',
      header: 'Actions',
      headerAlign: 'right',
      align: 'right',
      className: 'whitespace-nowrap',
      width: 'w-[140px]',
      cell: (u) => (
        <span className="inline-flex items-center gap-1.5">
          {/* On = done (contacted, out of the send queue); off = active. */}
          <Toggle
            checked={u.statusDone}
            onClick={(e) => { e.stopPropagation(); u.toggleStatus(); }}
            aria-label={u.statusDone ? `Mark ${u.login} active` : `Mark ${u.login} done`}
          />
          <IconButton size="sm" title="Copy email" onClick={u.copyEmail}><Icon name="copy" size={14} /></IconButton>
          <IconButton size="sm" title="Open details" onClick={u.openDetail}><Icon name="expand" size={13} /></IconButton>
        </span>
      ),
    },
  ];

  return (
    <section aria-label="Leads" data-screen-label="Leads">
      <div className="flex items-end justify-between mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">Leads<InfoTip label={HINTS.leadsPage} size={16} /></h1>
          <p className="mt-[5px] text-muted text-[13px]">
            <span className="font-mono text-fg">{v.leadCount}</span> matching leads
          </p>
        </div>
        <Button size="md">
          <Icon name="download" size={15} /> Export
        </Button>
      </div>

      <div className="flex items-center gap-2.5 flex-wrap mb-3.5">
        <SearchBox
          value={v.search}
          onChange={v.onSearch}
          placeholder="Search login, name, email…"
          className="min-w-[260px] flex-1 max-w-[340px]"
        />
        <div className="flex items-center h-[34px] bg-surface border border-line rounded-8 overflow-hidden">
          <span className="px-2.5 text-[11px] text-muted border-r border-line h-full flex items-center">Source</span>
          {v.sourceTabs.map((t) => (
            <span
              key={t.key}
              onClick={t.go}
              className={cn(
                'px-[11px] h-full flex items-center text-[12px] cursor-pointer transition-colors',
                t.active ? 'bg-accent text-white font-semibold' : 'text-muted hover:text-fg',
              )}
            >
              {t.label}
            </span>
          ))}
        </div>
        <Button variant="secondary" className="text-muted">
          <Icon name="filter" size={14} /> More filters
        </Button>
        {v.hasFilters && (
          <Button variant="ghost" onClick={v.clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {v.bulkOpen && (
        <div className="flex items-center gap-3 px-3.5 py-2.5 mb-3 bg-accent-quiet border border-accent rounded-8">
          <span className="text-[13px] font-semibold font-mono">{v.selectedCount} selected</span>
          <Button variant="primary" size="sm" onClick={v.bulkAdd}>
            <Icon name="plus" size={15} /> Add to campaign
          </Button>
          <Button variant="soft" size="sm" onClick={v.bulkExport}>
            Export selection
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto text-muted" onClick={v.clearSel}>
            Clear
          </Button>
        </div>
      )}

      <Card clip>
        <DataTable
          columns={columns}
          data={v.leads}
          rowKey={(u) => u.key}
          selectable
          isSelected={(u) => u.selected}
          onToggleRow={(u) => u.toggle()}
          allSelected={v.allSelected}
          onToggleAll={v.toggleAll}
          selectLabel={(u) => `Select ${u.login}`}
          sort={v.leadSort}
          onSortChange={v.onLeadSort}
          loading={v.leadsLoading}
          error={v.leadsError}
          errorState={{
            title: "Couldn't load leads",
            description: 'Check that the backend API is running, then retry.',
            action: <Button variant="primary" onClick={v.retryLeads}>Retry</Button>,
          }}
          emptyState={{
            title: 'No leads match your filters',
            description: 'Try widening your search or clearing filters.',
            action: <Button variant="primary" onClick={v.clearFilters}>Clear filters</Button>,
          }}
          stickyHeader
          minWidthClass="min-w-[1420px]"
          maxHeightClass="max-h-[calc(100vh-300px)]"
          paginated
          page={v.leadsPage}
          pageSize={v.leadsPageSize}
          totalRows={v.leadsTotalRaw}
          pageSizeOptions={v.leadsPageSizeOptions}
          onPageChange={v.onLeadsPageChange}
          onPageSizeChange={v.onLeadsPageSizeChange}
        />
      </Card>
    </section>
  );
}
