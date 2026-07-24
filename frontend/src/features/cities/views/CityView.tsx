import { Icon } from '@/lib/icons';
import { Badge, Button, Card, DataTable, InfoTip, Spinner, StateCard, type Column } from '@/components/ui';
import { CityStatusButtons } from '@/components/CityStatusButtons';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

type CityRow = V['cityView']['rows'][number];

export function CityView({ v }: { v: V }) {
  const cv = v.cityView;
  const query = cv.query.trim();

  const columns: Column<CityRow>[] = [
    { id: 'city', header: 'City', sortable: true, sortValue: (c) => c.city, className: 'font-medium', cell: (c) => c.city },
    { id: 'state', header: 'State', sortable: true, sortValue: (c) => c.state, className: 'font-mono text-muted', cell: (c) => c.state },
    { id: 'status', header: 'Status', cell: (c) => <Badge tone={c.statusTone} dot>{c.status}</Badge> },
    { id: 'found', header: 'Leads', align: 'right', className: 'font-mono', cell: (c) => c.found },
    { id: 'updated', header: 'Updated', align: 'right', className: 'text-muted text-[12px]', cell: (c) => c.updated },
    {
      id: 'actions',
      header: 'Status controls',
      headerAlign: 'right',
      align: 'right',
      width: 'w-[236px]',
      cell: (c) => <CityStatusButtons actions={c.statusActions} />,
    },
  ];

  return (
    <section aria-label="City view" data-screen-label="City view">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">
          City view<InfoTip label={HINTS.cityViewPage} size={16} />
        </h1>
        <p className="mt-[5px] text-muted text-[13px]">
          Browse every city loaded for a country — search across the full list and page through it.
        </p>
      </div>

      <Card clip>
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line flex-wrap">
          <h3 className="text-[14px] font-semibold flex items-center gap-1.5">
            Cities<InfoTip label={HINTS.cityViewCities} />
          </h3>
          <div className="ml-auto flex items-center gap-2">
            {cv.refetching && <Spinner size={14} className="text-accent" />}
            <label htmlFor="cityview-country" className="text-[11px] text-muted uppercase tracking-wide">
              Country
            </label>
            <select
              id="cityview-country"
              value={cv.code ?? ''}
              onChange={(e) => cv.setCountry(e.target.value)}
              className="h-8 rounded-8 border border-line bg-surface-2 pl-2.5 pr-2 text-[13px] text-fg cursor-pointer outline-none focus-visible:border-accent max-w-[220px]"
            >
              <option value="" disabled>Select a country…</option>
              {cv.countries.map((c) => (
                <option key={c.code} value={c.code}>{c.flag} {c.name}</option>
              ))}
            </select>
          </div>
        </div>

        {cv.hasCountry && (
          <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line bg-accent-quiet">
            <span className="text-[16px] leading-none flex-none" aria-hidden="true">{cv.flag}</span>
            <span className="text-[12.5px]">
              Showing <span className="font-semibold text-accent">{cv.name}</span>
              <span className="text-muted">
                {cv.region ? ` · ${cv.region}` : ''}
                {' · '}{cv.totalFmt}{' '}
                {query ? <>matching “{query}”</> : 'cities'}
              </span>
            </span>
          </div>
        )}

        {!cv.hasCountry ? (
          <StateCard
            variant="empty"
            iconName="globe"
            title="Pick a country"
            description="Choose a country above — or select one on the Countries page — to see all of its cities."
            action={<Button variant="primary" onClick={cv.goCountries}>Go to Countries</Button>}
          />
        ) : cv.empty ? (
          <StateCard
            variant="empty"
            iconName="globe"
            title={`No cities loaded for ${cv.name} yet`}
            description="Load this country’s full city list into the work list to browse it here."
            action={
              <Button variant="primary" onClick={cv.loadAll} disabled={cv.loadingAll}>
                {cv.loadingAll ? <Spinner size={14} className="text-white" /> : <Icon name="plus" size={15} />}
                Load all cities
              </Button>
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={cv.rows}
            rowKey={(c) => c.key}
            filterable
            filterPlaceholder="Search cities in this country…"
            filterValue={cv.search}
            onFilterChange={cv.setSearch}
            paginated
            pageSize={cv.pageSize}
            pageSizeOptions={cv.pageSizeOptions}
            page={cv.page}
            totalRows={cv.total}
            onPageChange={cv.setPage}
            onPageSizeChange={cv.setPageSize}
            minWidthClass="min-w-[720px]"
            loading={cv.loading}
            error={cv.error}
            errorState={{
              title: "Couldn't load cities",
              description: 'Check that the backend API is running, then retry.',
              action: <Button variant="primary" onClick={cv.retry}>Retry</Button>,
            }}
            emptyState={{ iconName: 'globe', title: 'No cities', description: 'This country has no cities loaded.' }}
          />
        )}
      </Card>
    </section>
  );
}
