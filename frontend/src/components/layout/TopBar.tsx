import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/lib/icons';
import { Avatar, Button, Countdown, IconButton, Kbd, ProgressBar } from '@/components/ui';
import { timeAgo } from '@/lib/format';
import { toneText } from '@/lib/tone';
import type { V } from '@/hooks/useApp';

const ACCT_MENU_W = 240;
const RATE_MENU_W = 296;
const GAP = 8;
const MARGIN = 8;

/**
 * Anchors a portalled popover to a trigger. The top bar carries a
 * `backdrop-filter`, which makes it a stacking context — anything rendered
 * inside it is trapped below the page content no matter how high its z-index,
 * so these panels have to live on document.body and be positioned by hand.
 */
function useAnchored(open: boolean, width: number, onClose: () => void) {
  const ref = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  const [pos, setPos] = useState({ left: 0, top: 0 });

  useEffect(() => {
    closeRef.current = onClose;
  });

  const place = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(MARGIN, Math.min(r.right - width, window.innerWidth - width - MARGIN));
    setPos({ left, top: r.bottom + GAP });
  }, [width]);

  // Layout effect so the panel is placed before paint — never a frame at (0,0).
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  return { ref, pos };
}

function Popover({ pos, width, onClose, children }: {
  pos: { left: number; top: number };
  width: number;
  onClose: () => void;
  children: ReactNode;
}) {
  if (typeof document === 'undefined') return null;
  return createPortal(
    <>
      <div onClick={onClose} className="fixed inset-0 z-[90]" />
      <div
        style={{ left: pos.left, top: pos.top, width }}
        className="fixed bg-surface border border-line rounded-10 shadow-menu z-[91] overflow-hidden animate-fade"
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

export function TopBar({ v }: { v: V }) {
  const [rateOpen, setRateOpen] = useState(false);
  const closeRate = useCallback(() => setRateOpen(false), []);

  const acct = useAnchored(v.acctMenu, ACCT_MENU_W, v.closeAcctMenu);
  const rate = useAnchored(rateOpen, RATE_MENU_W, closeRate);

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
        {}
        <button
          ref={rate.ref}
          data-ratemeter
          type="button"
          onClick={() => setRateOpen((o) => !o)}
          title="GitHub API rate limit — click for the full breakdown"
          aria-haspopup="dialog"
          aria-expanded={rateOpen}
          className="flex items-center gap-2 h-[34px] px-[11px] bg-surface-2 border border-line rounded-8 text-fg cursor-pointer transition-colors hover:bg-surface"
        >
          <Icon
            name={v.apiProblem ? 'alert' : 'api'}
            size={15}
            className={v.apiProblem ? 'text-danger' : 'text-muted'}
          />
          <ProgressBar pct={v.apiPct} tone={v.apiTone} className="w-16" heightClass="h-1.5" />
          <span className="font-mono text-[12px] text-fg">{v.apiRemain}</span>
          <span className="font-mono text-[11px] text-muted">
            ·{v.apiResetAt ? <Countdown to={v.apiResetAt} /> : '—'}
          </span>
        </button>

        {rateOpen && (
          <Popover pos={rate.pos} width={RATE_MENU_W} onClose={closeRate}>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-line">
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-fg">GitHub API budget</div>
                <div className="text-[11px] text-muted">
                  {v.apiCheckedAt
                    ? `Checked ${timeAgo(new Date(v.apiCheckedAt).toISOString())}`
                    : 'Reading…'}
                </div>
              </div>
              <IconButton
                onClick={v.refreshRateLimit}
                aria-label="Refresh rate limit"
                title="Refresh now"
                className="text-muted"
              >
                <Icon name="refresh" size={14} className={v.apiLoading ? 'animate-spin' : undefined} />
              </IconButton>
            </div>

            {v.apiProblem ? (
              <div className="px-3 py-3 text-[12px] text-danger flex items-start gap-2">
                <Icon name="alert" size={14} className="mt-px flex-none" />
                <span>{v.apiProblem}</span>
              </div>
            ) : v.apiWindows.length === 0 ? (
              <div className="px-3 py-3 text-[12px] text-muted">Reading the current window…</div>
            ) : (
              <div className="p-1">
                {v.apiWindows.map((w) => (
                  <div key={w.key} className="px-2.5 py-2">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12.5px] font-medium text-fg">{w.label}</span>
                      <span className={`ml-auto font-mono text-[12px] ${toneText[w.tone]}`}>{w.remain}</span>
                      <span className="font-mono text-[11px] text-muted">/ {w.limit}</span>
                    </div>
                    <ProgressBar pct={w.pct} tone={w.tone} className="mt-1.5" heightClass="h-1" />
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-muted">
                      <span className="truncate">{w.hint}</span>
                      <span className="ml-auto flex-none font-mono">
                        {w.used} used · <Countdown to={w.resetAt} precise />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Popover>
        )}

        {}
        <button
          ref={acct.ref}
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
          <Popover pos={acct.pos} width={ACCT_MENU_W} onClose={v.closeAcctMenu}>
            <div role="menu">
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
          </Popover>
        )}

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
