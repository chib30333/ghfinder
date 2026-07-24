import { Icon } from '@/lib/icons';
import { Badge, Button, Card, DataTable, IconBadge, IconButton, InfoTip, type Column } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

type ExportRow = V['exportsList'][number];

export function ExportsView({ v }: { v: V }) {
  const columns: Column<ExportRow>[] = [
    {
      id: 'name',
      header: 'File',
      sortable: true,
      sortValue: (f) => f.name,
      cell: (f) => (
        <span className="flex items-center gap-2.5">
          <IconBadge iconName="file" tone={f.fileTone} size={28} iconSize={15} />
          <span className="font-mono text-[12.5px]">{f.name}</span>
        </span>
      ),
    },
    { id: 'type', header: 'Type', sortable: true, sortValue: (f) => f.type, cell: (f) => <Badge tone="neutral" variant="tag">{f.type}</Badge> },
    { id: 'records', header: 'Records', sortable: true, sortValue: (f) => f.recordsRaw, align: 'right', className: 'font-mono', cell: (f) => f.records },
    { id: 'size', header: 'Size', align: 'right', className: 'font-mono text-muted', cell: (f) => f.size },
    { id: 'created', header: 'Created', align: 'right', className: 'text-muted text-[12px]', cell: (f) => f.created },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      cell: (f) => (
        <span className="inline-flex gap-1">
          <IconButton size="sm" title="Copy path" onClick={f.copyPath}><Icon name="copy" size={14} /></IconButton>
          <IconButton size="sm" title="Download" onClick={f.downloadFile}><Icon name="download" size={15} /></IconButton>
        </span>
      ),
    },
  ];

  return (
    <section aria-label="Exports" data-screen-label="Exports">
      <div className="mb-4">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">Exports<InfoTip label={HINTS.expPage} size={16} /></h1>
        <p className="mt-[5px] text-muted text-[13px]">Generated artifacts — batch user files, social link CSVs, and GES payloads.</p>
      </div>

      <Card clip>
        <DataTable
          columns={columns}
          data={v.exportsList}
          rowKey={(f) => f.key}
          filterable
          filterPlaceholder="Filter files…"
          filterText={(f) => `${f.name} ${f.type}`}
          paginated
          minWidthClass="min-w-[640px]"
          loading={v.exportsLoading}
          error={v.exportsError}
          errorState={{
            title: "Couldn't load exports",
            description: 'Check that the backend API is running, then retry.',
            action: <Button variant="primary" onClick={v.retryExports}>Retry</Button>,
          }}
          emptyState={{ iconName: 'file', title: 'No exports yet', description: 'Run an export from the CLI or a crawl to generate batch files.' }}
        />
      </Card>
    </section>
  );
}
