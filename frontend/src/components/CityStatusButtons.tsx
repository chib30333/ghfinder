import { Icon } from '@/lib/icons';
import { Button } from '@/components/ui';

export interface CityStatusAction {
  key: string;
  label: string;
  iconName: string;
  // True for the button matching the city's current status: shown selected and
  // disabled, since re-applying the same status is a no-op.
  current: boolean;
  onClick: () => void;
}

// The Done / Active / Skip control rendered in each city row's actions cell.
// Sets the city's crawl status directly from the table (Discovery + City view).
export function CityStatusButtons({ actions }: { actions: CityStatusAction[] }) {
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
