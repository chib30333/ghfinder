import { Icon } from '@/lib/icons';
import { Button } from '@/components/ui';

export interface StatusAction {
  key: string;
  label: string;
  iconName: string;
  // True for the button matching the row's current status: shown selected and
  // disabled, since re-applying the same status is a no-op.
  current: boolean;
  onClick: () => void;
}

// The inline status control rendered in a table row's actions cell — Done /
// Active / Skip for cities and discovery. Sets the row's status directly from
// the table. (Leads use a two-state toggle instead, since they are only ever
// active or done.)
export function StatusButtons({ actions }: { actions: StatusAction[] }) {
  return (
    <div className="inline-flex items-center gap-1 justify-end">
      {actions.map((a) => (
        <Button
          key={a.key}
          size="xs"
          variant={a.current ? 'accentQuiet' : 'soft'}
          disabled={a.current}
          aria-pressed={a.current}
          onClick={(e) => { e.stopPropagation(); a.onClick(); }}
          title={a.current ? `Currently ${a.label.toLowerCase()}` : `Mark ${a.label.toLowerCase()}`}
        >
          <Icon name={a.iconName} size={13} />
          {a.label}
        </Button>
      ))}
    </div>
  );
}
