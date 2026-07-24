import { Button, Card, InfoTip, Input, Segmented, Toggle } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { Theme } from '@/types';
import type { V } from '@/hooks/useApp';

export function SettingsView({ v }: { v: V }) {
  return (
    <section aria-label="Settings" data-screen-label="Settings">
      <div className="mb-[18px]">
        <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">Settings<InfoTip label={HINTS.setPage} size={16} /></h1>
        <p className="mt-[5px] text-muted text-[13px]">Credentials, storage, and enrichment defaults.</p>
      </div>

      <div data-cardcols className="columns-2 gap-[14px] [&>*]:mb-[14px] [&>*]:break-inside-avoid">
        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5 flex items-center gap-1.5">GitHub API<InfoTip label={HINTS.setGithub} /></h3>
          <label className="text-[11px] text-muted">
            Personal access token
            <div className="flex gap-2 mt-1.5">
              <Input value={v.tokenMask} readOnly mono inputSize="lg" className="flex-1" />
              <Button variant="soft" className="h-9" onClick={v.revealToken}>{v.tokenBtn}</Button>
            </div>
          </label>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5 flex items-center gap-1.5">Storage<InfoTip label={HINTS.setStorage} /></h3>
          <div className="flex flex-col gap-3">
            <label className="text-[11px] text-muted">Database path<Input defaultValue="./data/ghfinder.db" mono inputSize="lg" className="mt-1.5" /></label>
            <label className="text-[11px] text-muted">Export directory<Input defaultValue="./exports" mono inputSize="lg" className="mt-1.5" /></label>
            <label className="text-[11px] text-muted">Users per file<Input defaultValue="1000" mono inputSize="lg" className="mt-1.5" /></label>
          </div>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-2 flex items-center gap-1.5">Enrichment defaults<InfoTip label={HINTS.setEnrichment} /></h3>
          <div className="flex flex-col">
            {v.enrich.map((e) => (
              <label key={e.key} className="flex items-center gap-2.5 py-2.5 cursor-pointer border-b border-line last:border-b-0">
                <Toggle checked={e.checked} onClick={e.toggle} />
                <span className="text-[13px]">{e.label}</span>
              </label>
            ))}
          </div>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-1.5">Appearance<InfoTip label={HINTS.setAppearance} /></h3>
          <div className="flex items-center justify-between">
            <span className="text-[13px]">Theme</span>
            <Segmented
              value={v.theme}
              onChange={(t: Theme) => v.setTheme(t)}
              options={[
                { value: 'dark', label: 'Dark' },
                { value: 'light', label: 'Light' },
              ]}
            />
          </div>
        </Card>
      </div>
    </section>
  );
}
