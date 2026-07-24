import { useCallback, useEffect, useState } from 'react';

const readPath = () => (typeof window === 'undefined' ? '/' : window.location.pathname);

export interface Router {
  path: string;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
}

export function useRouter(): Router {
  const [path, setPath] = useState(readPath);

  useEffect(() => {
    const onPop = () => setPath(readPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const navigate = useCallback((to: string, opts?: { replace?: boolean }) => {
    if (to === readPath()) {
      setPath(to);
      return;
    }
    if (opts?.replace) window.history.replaceState(null, '', to);
    else window.history.pushState(null, '', to);
    setPath(to);
  }, []);

  return { path, navigate };
}
