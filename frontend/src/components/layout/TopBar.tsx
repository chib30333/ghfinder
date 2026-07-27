import { Icon } from '@/lib/icons';
import { Avatar, Button, IconButton, Kbd, ProgressBar } from '@/components/ui';
import type { V } from '@/hooks/useApp';

export function TopBar({ v }: { v: V }) {
  return (
    <header className="h-14 flex-none flex items-center gap-3 px-3.5 border-b border-line bg-[color-mix(in_srgb,var(--surface)_70%,transparent)] backdrop-blur-[8px]">
      <IconButton
        data-hamburger
        onClick={v.toggleMobileNav}
        aria-label="Open navigation"
        size="xl"
        className="hidden text-fg"
      >
        <Icon name="menu" size={18} />
      </IconButton>

      <Button
        data-searchbtn
        variant="soft"
        onClick={v.openPalette}
        className="justify-start gap-2.5 min-w-[280px] font-normal text-muted"
      >
        <Icon name="search" size={16} />
        <span data-searchlabel>Search leads, cities, accounts…</span>
        <Kbd data-searchkbd className="ml-auto">
          Ctrl + K
        </Kbd>
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <div
          data-ratemeter
          title="GitHub API rate limit"
          className="flex items-center gap-2 h-[34px] px-[11px] bg-surface-2 border border-line rounded-8"
        >
          <Icon name="api" size={15} className="text-muted" />
          <ProgressBar pct={v.apiPct} tone={v.apiTone} className="w-16" heightClass="h-1.5" />
          <span className="font-mono text-[12px] text-fg">{v.apiRemain}</span>
          <span className="font-mono text-[11px] text-muted">·{v.apiReset}</span>
        </div>

        <div className="relative">
          {}
          <button
            type="button"
            onClick={v.toggleAcctMenu}
            title="Account"
            aria-haspopup="menu"
            aria-expanded={v.acctMenu}
            className="flex items-center gap-2 h-[34px] pl-1.5 pr-2 bg-surface-2 border border-line rounded-8 text-fg cursor-pointer transition-colors hover:bg-surface"
          >
            <Avatar color={v.activeColor} initials={v.activeInit} src={v.activeAvatar} size={22} fontSize={10} />
            <span className="text-[12px] font-medium max-w-[130px] truncate">{v.authUserName}</span>
            <Icon name="chev" size={14} className="text-muted" />
          </button>

          {v.acctMenu && (
            <>
              <div onClick={v.closeAcctMenu} className="fixed inset-0 z-30" />
              <div role="menu" className="absolute top-[42px] right-0 w-60 bg-surface border border-line rounded-10 shadow-menu z-[100] overflow-hidden animate-fade">
                <div className="flex items-center gap-2.5 px-3 py-3 border-b border-line">
                  <Avatar color={v.activeColor} initials={v.activeInit} src={v.activeAvatar} size={34} fontSize={12} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold text-fg truncate">{v.authUserName}</div>
                    <div className="text-[11px] font-mono text-muted truncate">{v.authUserEmail}</div>
                  </div>
                </div>
                <div className="p-1">
                  <div
                    role="menuitem"
                    onClick={v.goProfile}
                    className="px-2.5 py-2 rounded-7 cursor-pointer text-[12.5px] hover:bg-surface-2"
                  >
                    Manage account
                  </div>
                  <div
                    role="menuitem"
                    onClick={v.openChangePassword}
                    className="px-2.5 py-2 rounded-7 cursor-pointer text-[12.5px] hover:bg-surface-2"
                  >
                    Change password
                  </div>
                  <div
                    role="menuitem"
                    onClick={v.signOut}
                    className="px-2.5 py-2 rounded-7 cursor-pointer text-[12.5px] text-danger hover:bg-danger-quiet"
                  >
                    Sign out
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        <IconButton
          onClick={v.toggleTheme}
          title="Toggle theme"
          aria-label="Toggle color theme"
          size="xl"
          className="text-fg"
        >
          <Icon name={v.themeIconName} size={16} />
        </IconButton>
      </div>
    </header>
  );
}
