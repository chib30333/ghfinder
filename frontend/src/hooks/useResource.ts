import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface Resource<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useResource<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  initial: T,
): Resource<T> {
  const [data, setData] = useState<T>(initial);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const reqId = useRef(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refetch = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    fetcherRef.current().then(
      (result) => {
        if (id === reqId.current) {
          setData(result);
          setLoading(false);
        }
      },
      (err: unknown) => {
        if (id === reqId.current) {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
          setLoading(false);
        }
      },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  return { data, loading, error, refetch };
}
