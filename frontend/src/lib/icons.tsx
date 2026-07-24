import type { ReactElement } from 'react';
import {
  Activity,
  AlertTriangle,
  AtSign,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  EllipsisVertical,
  File,
  FileDown,
  Filter,
  Flag,
  Globe,
  Info,
  LayoutDashboard,
  Link,
  type LucideIcon,
  Mail,
  Maximize2,
  Menu,
  MessageCircle,
  Moon,
  Play,
  Plus,
  Radar,
  Search,
  Send,
  Settings,
  Shield,
  SkipForward,
  Square,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  discovery: Radar,
  countries: Flag,
  cities: Building2,
  leads: Users,
  campaigns: Send,
  accounts: AtSign,
  exports: FileDown,
  menu: Menu,
  dots: EllipsisVertical,
  settings: Settings,
  search: Search,
  mail: Mail,
  link: Link,
  globe: Globe,
  info: Info,
  send: Send,
  api: Activity,
  users: User,
  play: Play,
  stop: Square,
  skip: SkipForward,
  plus: Plus,
  chev: ChevronDown,
  chevR: ChevronRight,
  sun: Sun,
  moon: Moon,
  copy: Copy,
  expand: Maximize2,
  download: Download,
  close: X,
  filter: Filter,
  check: Check,
  shield: Shield,
  file: File,
  alert: AlertTriangle,
  tg: Send,
  dc: MessageCircle,
};

export interface IconProps {
  name: string;
  size?: number;
  className?: string;
}

export function Icon({ name, size = 18, className }: IconProps): ReactElement {
  const Glyph = ICONS[name];
  if (!Glyph) {
    return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" />;
  }
  return <Glyph size={size} strokeWidth={1.8} className={className} aria-hidden="true" />;
}
