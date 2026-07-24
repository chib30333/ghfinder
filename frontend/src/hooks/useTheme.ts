import { useState } from 'react';
import type { Theme } from '@/types';

export function useTheme(initial: Theme = 'dark') {
  const [theme, setTheme] = useState<Theme>(initial);
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
  };
}
