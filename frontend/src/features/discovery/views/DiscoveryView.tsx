import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { toneQuietBg, toneText } from '@/lib/tone';
import { Badge, Button, Card, DataTable, Dot, InfoTip, Input, Spinner, Toggle, type Column } from '@/components/ui';
import { CityStatusButtons } from '@/components/CityStatusButtons';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

type CityRow = V['cities'][number];

export function DiscoveryView({ v }: { v: V }) {
  const paged = v.discoveryPaged;
  const columns: Column<CityRow>[] = [
    { id: 'city', header: 'City', sortable: true, sortValue: (c) => c.city, className: 'font-medium', cell: (c) => c.city },
    { id: 'state', header: 'State', sortable: true, sortValue: (c) => c.state, className: 'font-mono text-muted', cell: (c) => c.state },
    { id: 'status', header: 'Status', cell: (c) => <Badge tone={c.statusTone} dot>{c.status}</Badge> },
    { id: 'found', header: 'Leads', sortable: true, sortValue: (c) => c.foundRaw, align: 'right', className: 'font-mono', cell: (c) => c.found },
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
    <section aria-label="Discovery" data-screen-label="Discovery">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">Discovery<InfoTip label={HINTS.discPage} size={16} /></h1>
        <p className="mt-[5px] text-muted text-[13px]">The harvester engine — crawl GitHub by location and enrich contacts.</p>
      </div>

      <div data-stack className="grid grid-cols-[1fr_340px] gap-[14px] items-start">
        <Card clip>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line flex-wrap">
            <h3 className="text-[14px] font-semibold mr-auto flex items-center gap-1.5">Cities work list<InfoTip label={HINTS.discCities} /></h3>
            <div className="flex bg-surface-2 border border-line rounded-7 p-0.5">
              {(['city', 'city-state'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => v.setQueryMode(mode)}
                  aria-pressed={v.queryMode === mode}
                  className={cn(
                    'px-2.5 py-1 rounded-5 text-[12px] font-mono cursor-pointer transition-colors',
                    v.queryMode === mode ? 'bg-accent text-white' : 'text-muted hover:text-fg',
                  )}
                >
                  {mode}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={v.loadCitiesList} disabled={v.citiesLoadingAction}>
              {v.citiesLoadingAction ? <Spinner size={14} /> : <Icon name="plus" size={15} />} Load cities
            </Button>
          </div>

          {v.discoveryCountry && (
            <div className="flex items-center gap-2.5 px-4 py-2.5 border-b border-line bg-accent-quiet">
              <span className="text-[16px] leading-none flex-none" aria-hidden="true">{v.discoveryCountryFlag}</span>
              <span className="text-[12.5px]">
                Showing <span className="font-semibold text-accent">{v.discoveryCountry}</span>
                <span className="text-muted">
                  {' · '}{v.discoveryCityCount.toLocaleString()}{' '}
                  {paged?.query?.trim() ? <>matching “{paged.query.trim()}”</> : 'cities'}
                </span>
              </span>
              {paged?.loading && <Spinner size={13} className="flex-none text-accent" />}
              <Button size="xs" variant="soft" className="ml-auto" onClick={v.clearDiscoveryCountry}>
                <Icon name="close" size={13} /> Clear
              </Button>
            </div>
          )}

          {v.recentSearches.length > 0 && (
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line flex-wrap">
              <span className="text-[11px] text-muted uppercase tracking-wide flex-none">Recent searches</span>
              {v.recentSearches.map((r) => (
                <span key={r.term} className="inline-flex items-center gap-1 h-6 pl-2.5 pr-1 rounded-full bg-surface-2 border border-line text-[12px]">
                  <button type="button" onClick={r.run} className="text-fg hover:text-accent cursor-pointer max-w-[140px] truncate">
                    {r.term}
                  </button>
                  <button
                    type="button"
                    onClick={r.remove}
                    aria-label={`Remove ${r.term} from recent searches`}
                    className="flex-none inline-flex items-center justify-center text-muted hover:text-fg cursor-pointer rounded-full p-0.5"
                  >
                    <Icon name="close" size={11} />
                  </button>
                </span>
              ))}
              <button type="button" onClick={v.clearRecentSearches} className="ml-auto text-[11px] text-muted hover:text-fg cursor-pointer flex-none">
                Clear
              </button>
            </div>
          )}

          <DataTable
            columns={columns}
            data={v.cities}
            rowKey={(c) => c.key}
            filterable
            filterPlaceholder={paged ? 'Search cities in this country…' : 'Search cities…'}
            filterValue={v.citySearch.value}
            onFilterChange={v.citySearch.setValue}
            paginated
            {...(paged
              ? {
                  pageSize: paged.pageSize,
                  pageSizeOptions: [50, 100, 200],
                  page: paged.page,
                  totalRows: paged.total,
                  onPageChange: paged.setPage,
                  onPageSizeChange: paged.setPageSize,
                }
              : {})}
            minWidthClass="min-w-[720px]"
            loading={v.citiesLoading}
            error={v.citiesError}
            errorState={{
              title: "Couldn't load cities",
              description: 'Check that the backend API is running, then retry.',
              action: <Button variant="primary" onClick={v.retryCities}>Retry</Button>,
            }}
            emptyState={{ iconName: 'globe', title: 'No cities crawled yet', description: 'Start a crawl to begin harvesting developers.' }}
          />

          <div className="border-t border-line">
            {}
            <button
              type="button"
              onClick={v.toggleSegments}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-fg cursor-pointer text-[13px] font-semibold text-left hover:bg-surface-2 transition-colors"
            >
              <Icon name="chev" size={18} className={cn('flex-none transition-transform', v.segmentsOpen ? 'rotate-0' : '-rotate-90')} />
              Engine internals — segment queue
              <span className="ml-auto text-[11px] text-muted font-normal">recursive created: window split</span>
            </button>
            {v.segmentsOpen && (
              <div className="px-4 pb-4">
                <div className="flex gap-2 mb-2.5 text-[11px]">
                  <span className={cn('px-[9px] py-[3px] rounded-6 font-semibold', toneQuietBg.warning, toneText.warning)}>split 14</span>
                  <span className={cn('px-[9px] py-[3px] rounded-6 font-semibold', toneQuietBg.danger, toneText.danger)}>capped 3</span>
                  <span className={cn('px-[9px] py-[3px] rounded-6 font-semibold', toneQuietBg.success, toneText.success)}>done 61</span>
                </div>
                <div className="font-mono text-[12px] bg-base border border-line rounded-8 p-3 text-muted leading-[1.9]">
                  <div><span className="text-fg">location:"Austin"</span> → 1,284 results &gt; 1000, splitting…</div>
                  <div className="pl-4">├ created:&lt;2018-01-01 · <span className="text-success">412 ✓ capped</span></div>
                  <div className="pl-4">├ created:2018..2021 · <span className="text-success">508 ✓ done</span></div>
                  <div className="pl-4">└ created:&gt;2021 · <span className="text-warning">364 ⟳ active</span></div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-[14px]">
          <Card className="p-4">
            <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">Run control<InfoTip label={HINTS.discRun} /></h3>
            <Button full variant={v.crawling ? 'dangerSoft' : 'primary'} size="xl" onClick={v.toggleCrawl}>
              <Icon name={v.crawlBtnIconName} size={15} /> {v.crawlBtnLabel}
            </Button>
            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <label className="text-[11px] text-muted">limit<Input defaultValue="100" inputSize="sm" mono className="mt-1 rounded-7" /></label>
              <label className="text-[11px] text-muted">max-profiles<Input defaultValue="5000" inputSize="sm" mono className="mt-1 rounded-7" /></label>
            </div>
            <div className="mt-3.5 flex flex-col gap-0.5">
              <div className="text-[11px] text-muted uppercase tracking-wide mb-1">Enrichment</div>
              {v.enrich.map((e) => (
                <label key={e.key} className="flex items-center gap-2.5 py-2 cursor-pointer">
                  <Toggle checked={e.checked} onClick={e.toggle} />
                  <span className="text-[13px]">{e.label}</span>
                  {e.hasNum && <Input defaultValue={e.num} inputSize="sm" mono className="ml-auto w-[52px] h-7 rounded-6 text-[12px]" />}
                </label>
              ))}
            </div>
          </Card>

          <Card clip>
            <div className="flex items-center gap-2 px-4 py-[11px] border-b border-line">
              <Dot tone={v.logDotTone} pulse={v.logPulse} />
              <h3 className="text-[13px] font-semibold flex items-center gap-1.5">Live log<InfoTip label={HINTS.discLog} size={13} /></h3>
              <span className="ml-auto text-[11px] text-muted">{v.logStatus}</span>
            </div>
            <div className="px-3.5 py-3 font-mono text-[11.5px] leading-[1.9] text-muted max-h-[220px] overflow-auto">
              {v.logs.map((l) => (
                <div key={l.key}><span className={toneText[l.tone]}>{l.tag}</span> {l.msg}</div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
