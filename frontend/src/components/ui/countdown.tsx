import { useEffect, useState } from 'react';
import { countdown } from '@/lib/format';

export interface CountdownProps {
  /** Unix seconds to count down to. */
  to: number;
  precise?: boolean;
  className?: string;
}

/**
 * Ticks itself once a second so the surrounding view — the top bar, the
 * dashboard — never has to re-render on a timer just to keep a clock honest.
 */
export function Countdown({ to, precise, className }: CountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!to) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [to]);

  return <span className={className}>{countdown(to, now, precise)}</span>;
}
