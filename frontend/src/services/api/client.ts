const BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

const REQUEST_TIMEOUT_MS = 12_000;

export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number, options?: { cause?: unknown }) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    if (options?.cause !== undefined) (this as { cause?: unknown }).cause = options.cause;
  }
}

export async function apiClient<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctl.abort(); }, REQUEST_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      cache: 'no-store',
      ...opts,
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', ...(opts.headers ?? {}) },
    });
  } catch (err) {
    throw new ApiError(
      timedOut
        ? `The ghfinder API did not respond within ${REQUEST_TIMEOUT_MS / 1000}s.`
        : 'Could not reach the ghfinder API.',
      0,
      { cause: err },
    );
  } finally {
    clearTimeout(timer);
  }
  const text = await res.text();
  if (!res.ok) {
    let message = `Request failed (${res.status}).`;
    try {
      const body = text ? JSON.parse(text) : null;
      if (body && typeof body.error === 'string') message = body.error;
    } catch { }
    throw new ApiError(message, res.status);
  }
  return (text ? JSON.parse(text) : null) as T;
}

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

export function qs(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
