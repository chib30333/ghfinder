import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { DashboardView } from '@/features/dashboard/views/DashboardView';
import { DiscoveryView } from '@/features/discovery/views/DiscoveryView';
import { CountriesView } from '@/features/countries/views/CountriesView';
import { CityView } from '@/features/cities/views/CityView';
import { LeadsView } from '@/features/leads/views/LeadsView';
import { CampaignsView } from '@/features/campaigns/views/CampaignsView';
import { AccountsView } from '@/features/accounts/views/AccountsView';
import { ExportsView } from '@/features/exports/views/ExportsView';
import { SettingsView } from '@/features/settings/views/SettingsView';
import { ProfileView } from '@/features/profile/views/ProfileView';
import { LeadDrawer } from '@/features/leads/components/LeadDrawer';
import { SendMonitor } from '@/features/campaigns/components/SendMonitor';
import { ConfirmSendModal } from '@/features/campaigns/components/ConfirmSendModal';
import { ChangePasswordModal } from '@/features/auth/components/ChangePasswordModal';
import type { V } from '@/hooks/useApp';

export function Shell({ v }: { v: V }) {
  return (
    <>
      {v.mobileNav && <div data-navscrim onClick={v.closeMobileNav} className="fixed inset-0 bg-black/50 z-[45] animate-fade" />}
      <Sidebar v={v} />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar v={v} />
        <main className="flex-1 overflow-auto min-h-0">
          <div data-content className="max-w-[1520px] mx-auto px-7 pt-6 pb-16">
            {v.isDashboard && <DashboardView v={v} />}
            {v.isDiscovery && <DiscoveryView v={v} />}
            {v.isCountries && <CountriesView v={v} />}
            {v.isCities && <CityView v={v} />}
            {v.isLeads && <LeadsView v={v} />}
            {v.isCampaigns && <CampaignsView v={v} />}
            {v.isAccounts && <AccountsView v={v} />}
            {v.isExports && <ExportsView v={v} />}
            {v.isSettings && <SettingsView v={v} />}
            {v.isProfile && <ProfileView v={v} />}
          </div>
        </main>
      </div>

      {v.drawerOpen && <LeadDrawer v={v} />}
      {v.paletteOpen && <CommandPalette v={v} />}
      {v.confirmOpen && <ConfirmSendModal v={v} />}
      {v.pwModalOpen && <ChangePasswordModal v={v} />}
      {v.send && <SendMonitor v={v} />}
    </>
  );
}
