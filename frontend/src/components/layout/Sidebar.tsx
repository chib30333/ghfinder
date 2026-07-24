import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icons';
import { Badge, Logo } from '@/components/ui';
import type { V } from '@/hooks/useApp';

export function Sidebar({ v }: { v: V }) {
  return (
    <aside
      data-sidebar
      data-open={v.mobileNav ? 'true' : 'false'}
      className={cn(
        'flex-none flex flex-col bg-surface border-r border-line transition-[width] duration-150',
        v.expanded ? 'w-[232px]' : 'w-16',
      )}
    >
      <div className="flex items-center gap-2.5 h-14 px-4 border-b border-line">
        <Logo size={26} />
        {v.expanded && <span className="font-semibold text-[15px] tracking-[-0.01em]">ghfinder</span>}
      </div>

      <nav className="flex-1 py-2.5 px-2 flex flex-col gap-0.5" aria-label="Primary">
        {v.nav.map((item) => (
          <a
            key={item.key}
            href={item.href}
            onClick={item.go}
            aria-current={item.active ? 'page' : undefined}
            title={item.label}
            className={cn(
              'flex items-center gap-[11px] px-[11px] py-[9px] rounded-8 cursor-pointer whitespace-nowrap overflow-hidden transition-colors',
              item.active ? 'bg-accent-quiet text-accent font-semibold' : 'text-muted font-medium hover:bg-surface-2',
            )}
          >
            <Icon name={item.iconName} size={18} className="flex-none" />
            {v.expanded && <span>{item.label}</span>}
            {item.badge && v.expanded && (
              <Badge tone={item.active ? 'neutral' : 'accent'} className="ml-auto font-mono tabular-nums px-2 py-0.5">
                {item.badge}
              </Badge>
            )}
          </a>
        ))}
      </nav>

      <div className="py-2.5 px-2 border-t border-line">
        <a
          href="#"
          onClick={v.toggleCollapse}
          title="Collapse sidebar"
          className="flex items-center gap-[11px] px-[11px] py-[9px] rounded-8 text-muted cursor-pointer hover:bg-surface-2 transition-colors"
        >
          <Icon name={v.collapseIconName} size={18} className="flex-none" />
          {v.expanded && <span>Collapse</span>}
        </a>
      </div>
    </aside>
  );
}
