import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { Button, Card, InfoTip, Segmented, Spinner, StateCard } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

export function CountriesView({ v }: { v: V }) {
  return (
    <section aria-label="Countries" data-screen-label="Countries">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">
          Countries<InfoTip label={HINTS.countriesPage} size={16} />
        </h1>
        <p className="mt-[5px] text-muted text-[13px]">
          Pick a country, then search all its cities in one click — or load them into the Discovery work list first.
        </p>
      </div>

      <div data-stack className="grid grid-cols-[1fr_340px] gap-[14px] items-start">
        <Card clip>
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-line">
            <h3 className="text-[14px] font-semibold mr-auto flex items-center gap-1.5">
              Country work list<InfoTip label={HINTS.countriesRegions} />
            </h3>
          </div>

          <div className="p-4">
            {v.countriesError ? (
              <StateCard
                variant="error"
                iconName="alert"
                title="Couldn't load countries"
                description="Check that the backend API is running, then retry."
                action={<Button variant="primary" onClick={v.retryCountries}>Retry</Button>}
              />
            ) : v.countriesLoading ? (
              <div className="flex items-center justify-center py-16"><Spinner /></div>
            ) : (
              <div className="flex flex-col gap-5">
                {v.countryRegions.map((region) => (
                  <div key={region.id}>
                    <div className="text-[11px] text-muted uppercase tracking-wide mb-2 flex items-center gap-2">
                      {region.label}
                      <span className="font-mono text-[10px] text-muted">{region.countries.length}</span>
                    </div>
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-2">
                      {region.countries.map((c) => (
                        <button
                          key={c.key}
                          type="button"
                          onClick={c.select}
                          aria-pressed={c.selected}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2.5 rounded-8 border text-left transition-colors cursor-pointer',
                            c.selected
                              ? 'bg-accent-quiet border-accent'
                              : 'bg-surface-2 border-line hover:bg-surface',
                          )}
                        >
                          <span className="text-[20px] leading-none flex-none" aria-hidden="true">{c.flag}</span>
                          <span className="min-w-0 flex-1">
                            <span className={cn('block text-[13px] font-medium truncate', c.selected && 'text-accent')}>
                              {c.name}
                            </span>
                            <span
                              className={cn('block text-[11px] font-mono', c.loaded ? 'text-accent' : 'text-muted')}
                              title={c.loaded ? 'All cities loaded into the work list' : undefined}
                            >
                              {c.cityCount} cities
                            </span>
                          </span>
                          {c.selected && <Icon name="check" size={15} className="flex-none text-accent" />}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        <div className="flex flex-col gap-[14px]">
          <Card className="p-4">
            <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">
              Run control<InfoTip label={HINTS.countriesRun} />
            </h3>

            {v.selectedCountry ? (
              <div className="flex items-center gap-3 p-3 rounded-8 bg-surface-2 border border-line mb-3">
                <span className="text-[26px] leading-none flex-none" aria-hidden="true">{v.selectedCountry.flag}</span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold truncate">{v.selectedCountry.name}</div>
                  <div className="text-[11.5px] text-muted">
                    {v.selectedCountry.region} · {v.selectedCountry.cityCount} cities
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-8 bg-surface-2 border border-line border-dashed mb-3 text-[12.5px] text-muted">
                Select a country from the list to load its cities.
              </div>
            )}

            <div className="mb-3">
              <div className="text-[11px] text-muted uppercase tracking-wide mb-1.5">Location query</div>
              <Segmented
                className="w-full flex"
                value={v.queryMode}
                onChange={v.setQueryMode}
                options={[
                  { value: 'city', label: 'city' },
                  { value: 'city-state', label: 'city, country' },
                ]}
              />
              <p className="mt-1.5 text-[11px] text-muted leading-relaxed">
                {v.queryMode === 'city'
                  ? 'Searches GitHub by city name only — location:"City".'
                  : 'Narrows the search to location:"City, Country" for tighter matches.'}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                full
                variant="primary"
                size="xl"
                disabled={!v.hasSelectedCountry || v.countrySearching || v.countryRunning}
                onClick={v.searchCountry}
              >
                {v.countrySearching ? <Spinner size={16} className="text-white" /> : <Icon name="search" size={15} />}
                {v.countrySearchLabel}
              </Button>

              <Button
                full
                variant="secondary"
                size="xl"
                disabled={!v.hasSelectedCountry || v.countrySearching || v.countryRunning}
                onClick={v.runCountry}
              >
                {v.countryRunning ? <Spinner size={16} /> : <Icon name="play" size={15} />}
                {v.countryRunLabel}
              </Button>
            </div>

            <p className="mt-3 text-[11.5px] text-muted leading-relaxed">
              <span className="text-fg font-medium">Search all cities</span> pulls in every city in the country — the full
              list, not just the major hubs shown here — and opens Discovery. <span className="text-fg font-medium">Load
              cities</span> seeds only those major hubs. Neither starts the crawler; do that in Discovery.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
}
