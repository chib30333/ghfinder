import { Icon } from '@/lib/icons';
import { Button, Card, Countdown, Dot, IconBadge, InfoTip, ProgressBar, StateCard, Tooltip } from '@/components/ui';
import { HINTS } from '@/lib/hints';
import type { V } from '@/hooks/useApp';

function StatCard({ label, iconName, hint, children }: { label: string; iconName: string; hint: string; children: React.ReactNode }) {
  return (
    <Tooltip content={hint} focusable className="block h-full">
      <Card className="p-4 w-full h-full cursor-help">
        <div className="flex justify-between items-center text-muted text-[12px] font-medium">
          <span className="flex items-center gap-1.5">{label}<Icon name="info" size={12} className="text-muted" /></span>
          <Icon name={iconName} size={15} />
        </div>
        {children}
      </Card>
    </Tooltip>
  );
}

export function DashboardView({ v }: { v: V }) {
  return (
    <section aria-label="Overview" data-screen-label="Dashboard">
      <div className="flex items-end justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] flex items-center gap-2">Overview<InfoTip label={HINTS.dashPage} size={16} /></h1>
          <p className="mt-[5px] text-muted text-[13px]">Harvesting GitHub developers by US city · <span className="font-mono text-fg">{v.statCitiesDone}</span> cities crawled</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" size="lg" onClick={v.goDiscovery}>
            <Icon name="play" size={15} /> Run discovery
          </Button>
          <Button variant="primary" size="lg" onClick={v.goCampaigns}>
            <Icon name="plus" size={15} /> New campaign
          </Button>
        </div>
      </div>

      {v.dashError ? (
        <Card><StateCard variant="error" title="Couldn't load the overview" description="Check that the backend API is running, then retry." action={<Button variant="primary" onClick={v.retryDash}>Retry</Button>} /></Card>
      ) : v.dashLoading ? (
        <Card><StateCard variant="loading" title="Loading overview…" /></Card>
      ) : (
      <>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-[14px]">
        <StatCard label="Total leads" iconName="users" hint={HINTS.statTotalLeads}>
          <div className="font-mono text-[28px] font-semibold mt-2 tracking-[-0.02em]">{v.harvestedTotal}</div>
          <div className="flex items-center gap-2 mt-2">
            <svg width="72" height="22" viewBox="0 0 72 22" fill="none"><polyline points="0,18 10,16 20,17 30,12 40,13 50,8 60,6 72,3" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-success text-[12px] font-semibold">+8.2%</span>
          </div>
        </StatCard>

        <StatCard label="Leads with email" iconName="mail" hint={HINTS.statWithEmail}>
          <div className="font-mono text-[28px] font-semibold mt-2 tracking-[-0.02em]">{v.statEmails} <span className="text-[13px] text-muted">{v.emailPct}%</span></div>
          <div className="flex items-center gap-2 mt-2">
            <svg width="72" height="22" viewBox="0 0 72 22" fill="none"><polyline points="0,14 12,15 24,11 36,12 48,9 60,10 72,7" stroke="var(--success)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-success text-[12px] font-semibold">+3.1%</span>
          </div>
        </StatCard>

        <StatCard label="Social link found" iconName="link" hint={HINTS.statSocial}>
          <div className="font-mono text-[28px] font-semibold mt-2 tracking-[-0.02em]">{v.statSocial} <span className="text-[13px] text-muted">{v.socialPct}%</span></div>
          <div className="flex items-center gap-2 mt-2">
            <svg width="72" height="22" viewBox="0 0 72 22" fill="none"><polyline points="0,16 12,14 24,15 36,13 48,14 60,11 72,10" stroke="var(--info)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-info text-[12px] font-semibold">+1.4%</span>
          </div>
        </StatCard>

        <StatCard label="Cities crawled" iconName="globe" hint={HINTS.statCities}>
          <div className="flex items-center gap-3.5 mt-2">
            <svg width="52" height="52" viewBox="0 0 52 52"><circle cx="26" cy="26" r="22" fill="none" stroke="var(--border)" strokeWidth="6" /><circle cx="26" cy="26" r="22" fill="none" stroke="var(--accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray="138.2" strokeDashoffset={138.2 - (138.2 * v.citiesDonePct) / 100} transform="rotate(-90 26 26)" /></svg>
            <div>
              <div className="font-mono text-[22px] font-semibold">{v.statCitiesDone}<span className="text-muted text-[14px]">/{v.statCitiesTotal}</span></div>
              <div className="text-muted text-[12px]">{v.citiesDonePct}% complete</div>
            </div>
          </div>
        </StatCard>

        <StatCard label="Emails sent today" iconName="send" hint={HINTS.statSentToday}>
          <div className="font-mono text-[28px] font-semibold mt-2 tracking-[-0.02em]">{v.sentToday}</div>
          <div className="flex items-center gap-2 mt-2">
            <svg width="72" height="22" viewBox="0 0 72 22" fill="none"><polyline points="0,20 12,17 24,15 36,11 48,9 60,6 72,4" stroke="var(--warning)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span className="text-muted text-[12px]">of {v.dailyCapTotal} cap</span>
          </div>
        </StatCard>

        <StatCard label="GitHub API remaining" iconName="api" hint={HINTS.statApi}>
          <div className="font-mono text-[28px] font-semibold mt-2 tracking-[-0.02em]">{v.apiRemain}<span className="text-muted text-[14px]">/{v.apiLimit}</span></div>
          <ProgressBar pct={v.apiPct} tone={v.apiTone} className="mt-2.5" heightClass="h-1.5" />
          <div className="text-muted text-[11px] mt-1.5">
            {v.apiProblem ? <span className="text-danger">{v.apiProblem}</span>
              : v.apiResetAt ? <>resets in <Countdown to={v.apiResetAt} precise /></>
                : 'reading…'}
          </div>
        </StatCard>
      </div>

      <div data-stack className="grid grid-cols-[1.3fr_1fr] gap-[14px] mt-[14px]">
        <Card className="p-[18px]">
          <div className="flex justify-between items-center mb-3.5">
            <h3 className="text-[14px] font-semibold flex items-center gap-1.5">Crawl progress<InfoTip label={HINTS.dashCrawl} /></h3>
            <span className="text-[12px] text-muted">{v.statCitiesTotal} cities</span>
          </div>
          <div className="flex gap-2.5 mb-4">
            <div className="flex-1 text-center p-3 bg-surface-2 border border-line rounded-8"><div className="font-mono text-[20px] font-semibold text-success">{v.statCitiesDone}</div><div className="text-[11px] text-muted mt-0.5">Done</div></div>
            <div className="flex-1 text-center p-3 bg-surface-2 border border-line rounded-8"><div className="font-mono text-[20px] font-semibold text-warning">{v.statCitiesActive}</div><div className="text-[11px] text-muted mt-0.5">Active</div></div>
            <div className="flex-1 text-center p-3 bg-surface-2 border border-line rounded-8"><div className="font-mono text-[20px] font-semibold text-muted">{v.statCitiesPending}</div><div className="text-[11px] text-muted mt-0.5">Pending</div></div>
          </div>
          <div className="flex flex-col gap-[11px]">
            {v.crawlBars.map((c) => (
              <div key={c.key}>
                <div className="flex justify-between text-[12px] mb-[5px]">
                  <span className="flex items-center gap-2"><Dot tone={c.tone} />{c.city}</span>
                  <span className="font-mono text-muted">{c.found}</span>
                </div>
                <ProgressBar pct={c.pct} tone={c.tone} heightClass="h-1.5" />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-[18px]">
          <h3 className="text-[14px] font-semibold mb-3.5 flex items-center gap-1.5">Recent activity<InfoTip label={HINTS.dashActivity} /></h3>
          <div className="flex flex-col">
            {v.activity.map((a) => (
              <div key={a.key} className="flex gap-[11px] py-[9px] border-b border-line last:border-b-0">
                <IconBadge iconName={a.icon} tone={a.tone} size={26} iconSize={14} />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px]">{a.text}</div>
                  <div className="text-[11px] text-muted mt-px">{a.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
      </>
      )}
    </section>
  );
}
