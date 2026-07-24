import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  addGmailAccount,
  clearSession,
  deriveActivity,
  deriveCrawlBars,
  fetchAccounts,
  launchBrowser as svcLaunchBrowser,
  openMailbox as svcOpenMailbox,
  fetchCrawledCities,
  fetchCitiesByCountry,
  fetchCountries,
  loadCities as svcLoadCities,
  skipCity as svcSkipCity,
  setCityStatus as svcSetCityStatus,
  loadCountryCities as svcLoadCountryCities,
  loadAllCountryCities as svcLoadAllCountryCities,
  fetchExports,
  fetchLeadDetail,
  fetchLeads,
  fetchRecipientCount,

  fetchStats,
  listEnrichmentOptions,
  loadSession,
  loadProfile,
  saveProfile as svcSaveProfile,
  emptyProfile,
  updateSessionUser,
  requestPasswordReset,
  completePasswordReset,
  changePassword,
  signIn,
  signInWithGoogle,
  signUp,
  startCrawl,
  stopCrawl,
  DISCOVERY_STREAM_URL,
  saveCampaignTemplate,
  startCampaignSend,
  stopCampaignSend,
  fetchCampaignSendStatus,
  CAMPAIGN_STREAM_URL,
} from '@/services';
import type { JobLine, JobStatus, LeadSortKey, LeadSource, CountriesResponse, QueryMode, CityStatus } from '@/services';
import { fmt } from '@/lib/format';
import { hue, initials } from '@/lib/avatar';
import type {
  Account,
  AuthUser,
  AuthView,
  CdpState,
  City,
  ExportFile,
  Lead,
  Mode,
  Profile,
  Scope,
  Screen,
  SendRun,
  SendStatus,
  Stats,
  Tone,
} from '@/types';
import { useResource } from './useResource';
import { useRouter } from './useRouter';
import { useTheme } from './useTheme';
import { useToast } from './useToast';
import { AUTH_PATH, HOME_PATH, LOGIN_PATH, SCREEN_PATH, authViewFor, redirectFor, screenFor } from '@/lib/routes';

const SRC_TONE: Record<string, Tone> = { readme: 'info', profile: 'accent', commits: 'warning' };
const CITY_TONE: Record<City['status'], Tone> = { done: 'success', active: 'warning', pending: 'neutral', skipped: 'neutral' };
const ACCT_STATUS: Record<Account['status'], { label: string; tone: Tone }> = {
  sending: { label: 'Sending', tone: 'warning' },
  ready: { label: 'Ready', tone: 'success' },
  capped: { label: 'Capped', tone: 'danger' },
  idle: { label: 'Idle', tone: 'neutral' },
};
const SEND_TONE: Record<SendStatus, Tone> = {
  running: 'info',
  stopping: 'warning',
  stopped: 'neutral',
  done: 'success',
  failed: 'danger',
};
const SEND_LABEL: Record<SendStatus, string> = {
  running: 'running',
  stopping: 'stopping…',
  stopped: 'stopped',
  done: 'done',
  failed: 'failed',
};
const FILE_TONE: Record<ExportFile['kind'], Tone> = { txt: 'accent', csv: 'success', json: 'warning' };

const EMPTY_STATS: Stats = {
  citiesTotal: 0, citiesDone: 0, citiesActive: 0, citiesPending: 0,
  segmentsTotal: 0, usersTotal: 0, usersWithEmail: 0, usersWithSocial: 0,
};
const LEADS_PAGE = 50;
const SAFE_DAILY_CAP = 15;
const compact = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

// Per-account "sent today" tally. The Accounts roster comes from CDP discovery
// (which has no notion of sends), and the live per-account counts only exist
// inside an in-flight SendRun. We keep a small cumulative tally here — keyed by
// account email so it survives slot re-indexing — persisted to localStorage and
// reset each day, so the Daily-cap gauge reflects messages routed per account
// today across every run (and across reloads).
const SENT_DAILY_KEY = 'ghfinder.sentDaily';
type SentDaily = { date: string; byEmail: Record<string, number> };

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadSentDaily(): SentDaily {
  const today = todayKey();
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SENT_DAILY_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && p.date === today && p.byEmail && typeof p.byEmail === 'object' && !Array.isArray(p.byEmail)) {
          // Treat storage as untrusted: keep only finite, non-negative numeric
          // counts so a tampered/foreign value can't turn increments into string
          // concatenation ("5" + 1 → "51") or poison the gauge.
          const byEmail: Record<string, number> = {};
          for (const [k, v] of Object.entries(p.byEmail)) {
            if (typeof v === 'number' && Number.isFinite(v) && v >= 0) byEmail[k] = v;
          }
          return { date: today, byEmail };
        }
      }
    }
  } catch {
    /* corrupt or unavailable storage — start fresh */
  }
  return { date: today, byEmail: {} };
}

// De-dup high-water for the in-flight send: `key` is the backend run's startedAt,
// `counted` the highest sender message index ([index/total]) already folded into
// sentDaily. Persisted so a mid-run reload resumes without re-counting the SSE
// replay. Null when no send is (or was) in progress.
const SEND_PROGRESS_KEY = 'ghfinder.sendProgress';
type SendProgress = { key: number; counted: number } | null;

function loadSendProgress(): SendProgress {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(SEND_PROGRESS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p.key === 'number' && typeof p.counted === 'number' && Number.isFinite(p.counted) && p.counted >= 0) {
          return { key: p.key, counted: p.counted };
        }
      }
    }
  } catch {
    /* corrupt or unavailable storage */
  }
  return null;
}

// Recent city searches the operator has run in Discovery, most-recent-first.
// Purely a convenience history so the cities they searched stay visible as quick
// chips (and reappear as the default list) across reloads — no server ledger.
const RECENT_CITIES_KEY = 'ghfinder.recentCities';
const RECENT_CITIES_MAX = 8;

function loadRecentCities(): string[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(RECENT_CITIES_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (Array.isArray(p)) {
          // Treat storage as untrusted: keep only non-empty strings, deduped
          // case-insensitively and capped, so a tampered value can't bloat the UI.
          const seen = new Set<string>();
          const out: string[] = [];
          for (const t of p) {
            if (typeof t !== 'string') continue;
            const term = t.trim();
            const key = term.toLowerCase();
            if (term.length < 2 || seen.has(key)) continue;
            seen.add(key);
            out.push(term);
            if (out.length >= RECENT_CITIES_MAX) break;
          }
          return out;
        }
      }
    }
  } catch {
    /* corrupt or unavailable storage — start with no history */
  }
  return [];
}

// The Discovery "country view" (which country's cities are shown, and where in
// them) lives in component state, so a reload would snap back to the default
// crawled-cities list. Persist it so reloading keeps showing the loaded country
// at the same page/search — cleared when the operator hits "Clear".
const DISCOVERY_VIEW_KEY = 'ghfinder.discoveryView';
const DISCOVERY_PAGE_SIZES = [50, 100, 200];
const DISCOVERY_DEFAULT_PAGE_SIZE = 100;
interface DiscoveryView {
  country: string | null;
  page: number;
  pageSize: number;
  query: string;
}

function loadDiscoveryView(): DiscoveryView {
  const fallback: DiscoveryView = { country: null, page: 0, pageSize: DISCOVERY_DEFAULT_PAGE_SIZE, query: '' };
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(DISCOVERY_VIEW_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') {
          // Storage is untrusted: without a valid country there's nothing to
          // restore, so fall back to the default view and ignore any stale
          // page/search that would otherwise apply to it.
          const country = typeof p.country === 'string' && p.country.trim() ? p.country : null;
          if (!country) return fallback;
          const page = typeof p.page === 'number' && Number.isFinite(p.page) && p.page >= 0 ? Math.floor(p.page) : 0;
          const pageSize = DISCOVERY_PAGE_SIZES.includes(p.pageSize) ? p.pageSize : DISCOVERY_DEFAULT_PAGE_SIZE;
          const query = typeof p.query === 'string' ? p.query : '';
          return { country, page, pageSize, query };
        }
      }
    }
  } catch {
    /* corrupt or unavailable storage — default view */
  }
  return fallback;
}

interface AppState {
  collapsed: boolean;
  search: string;
  sortKey: LeadSortKey;
  sortDir: 'asc' | 'desc';
  fltSource: LeadSource;
  leadsPage: number;
  leadsPageSize: number;
  sel: Record<string, boolean>;
  drawer: Lead | null;
  drawerLoading: boolean;
  rawOpen: boolean;
  palette: boolean;
  confirm: boolean;
  pwModal: boolean;
  crawlStatus: JobStatus;
  crawlLines: JobLine[];
  segmentsOpen: boolean;
  queryMode: QueryMode;
  selectedCountry: string | null;
  cityViewCode: string | null;
  cityViewPage: number;
  cityViewPageSize: number;
  cityViewSearch: string;
  cityViewQuery: string;
  cityViewLoadingAll: boolean;
  discoveryCountry: string | null;
  discoveryPage: number;
  discoveryPageSize: number;
  discoverySearch: string;
  discoveryQuery: string;
  recentCities: string[];
  loadingCountry: boolean;
  searchingCountry: boolean;
  loadingCities: boolean;
  // Optimistic per-city status overrides keyed by city id, applied on top of the
  // fetched status until the next refetch confirms them. Set by the Done/Active/
  // Skip row buttons; reverted on API error.
  cityOverride: Record<number, City['status']>;
  dailyCap: number;
  enrich: boolean[];
  reposToScan: number;
  senders: boolean[];
  subject: string;
  body: string;
  tokenReveal: boolean;
  authed: boolean;
  authUser: AuthUser | null;
  profile: Profile;
  resetEmail: string;
  acctMenu: boolean;
  send: SendRun | null;
  sentDaily: SentDaily;
  sendProgress: SendProgress;
  mobileNav: boolean;
  cdp: CdpState;
  mode: Mode;
  scope: Scope;
  startIndex: number;
  count: number;
  senderIdentity: string;
  unsubLine: string;
  launching: boolean;
}

const DISCOVERY0 = loadDiscoveryView();

const INITIAL: AppState = {
  collapsed: false, search: '',
  sortKey: 'followers', sortDir: 'desc',
  fltSource: 'all', leadsPage: 0, leadsPageSize: LEADS_PAGE,
  sel: {}, drawer: null, drawerLoading: false, rawOpen: false, palette: false, confirm: false, pwModal: false,
  crawlStatus: 'idle', crawlLines: [], segmentsOpen: false,
  queryMode: 'city', selectedCountry: null,
  // City-view browse of a country's full city list — its own selection, paging,
  // and search, independent of the Discovery work-list view below.
  cityViewCode: null, cityViewPage: 0, cityViewPageSize: 100,
  cityViewSearch: '', cityViewQuery: '', cityViewLoadingAll: false,
  // Restore the persisted Discovery country view so a reload keeps showing the
  // loaded country (search box and fetch both seed from the committed query).
  discoveryCountry: DISCOVERY0.country,
  discoveryPage: DISCOVERY0.page, discoveryPageSize: DISCOVERY0.pageSize,
  discoverySearch: DISCOVERY0.query, discoveryQuery: DISCOVERY0.query,
  recentCities: loadRecentCities(),
  loadingCountry: false, searchingCountry: false, loadingCities: false, cityOverride: {},
  dailyCap: SAFE_DAILY_CAP, enrich: [true, true, true, true], reposToScan: 5,
  senders: [],
  subject: 'Hi, {{firstName}}',
  body: `
  How are you?
  I am Wei, a full-stack developer from China. I have gained extensive practical experience working as a full-stack engineer for local companies for about 8 years.
  I also have prior experience working on Upwork.
  I would like to resume working on remote job platforms like Upwork or Freelancer.com to increase my earnings.
  Unfortunately, my account was blocked last year.
  Additionally, developers from Asia tend to have lower hourly rates compared to US-based developers.
  Therefore, I am looking for someone to help me resume my activities on Upwork.

  I am willing to share 30% of my Upwork earnings and I would like to establish a long-term partnership with you.
  If you are able to assist, I would like to discuss the details.
  I would be happy to collaborate and contribute to our collaboration.

  I look forward to hearing from you soon to discuss this further.
  `,
  tokenReveal: false, authed: false, authUser: null, profile: emptyProfile(),
  resetEmail: 'operator@ghfinder.io',
  acctMenu: false, send: null, sentDaily: loadSentDaily(), sendProgress: loadSendProgress(), mobileNav: false,
  cdp: 'up', mode: 'draft', scope: 'all', startIndex: 0, count: 500,
  senderIdentity: 'Best regards',
  unsubLine: 'Wei',
  launching: false,
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export function useApp() {
  const [s, setState] = useState<AppState>(() => {
    const session = loadSession();
    if (!session) return INITIAL;
    return { ...INITIAL, authed: true, authUser: session.user, profile: loadProfile(session.user) };
  });
  const patch = (p: Partial<AppState>) => setState((st) => ({ ...st, ...p }));
  const update = (fn: (st: AppState) => Partial<AppState>) => setState((st) => ({ ...st, ...fn(st) }));
  const { path, navigate } = useRouter();
  const screen: Screen = screenFor(path) ?? 'dashboard';
  const authView: AuthView = authViewFor(path) ?? 'signin';

  useEffect(() => {
    const target = redirectFor(path, s.authed);
    if (target) navigate(target, { replace: true });
  }, [path, s.authed, navigate]);

  // Persist the per-account daily send tally so the Accounts Daily-cap gauge
  // survives reloads (and resets next day via loadSentDaily's date check).
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(SENT_DAILY_KEY, JSON.stringify(s.sentDaily));
    } catch {
      /* storage unavailable — the in-memory tally still drives the UI */
    }
  }, [s.sentDaily]);

  // Persist the send de-dup high-water so a mid-run reload knows how far it
  // already counted and won't double-count the SSE replay.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      if (s.sendProgress) localStorage.setItem(SEND_PROGRESS_KEY, JSON.stringify(s.sendProgress));
      else localStorage.removeItem(SEND_PROGRESS_KEY);
    } catch {
      /* storage unavailable */
    }
  }, [s.sendProgress]);

  // Persist the recent city-search history so the cities the operator searched
  // stay visible across reloads.
  useEffect(() => {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem(RECENT_CITIES_KEY, JSON.stringify(s.recentCities));
    } catch {
      /* storage unavailable — the in-memory history still drives the UI */
    }
  }, [s.recentCities]);

  // Persist the Discovery country view so reloading the page keeps showing the
  // loaded country at the same page/search instead of the default list. We store
  // the committed query (not the mid-typing box value) so a reload lands settled.
  useEffect(() => {
    try {
      if (typeof localStorage === 'undefined') return;
      // Only the country view is worth restoring, and writing from the default
      // (no-country) view would clobber a country view another tab saved (single
      // shared key, last-write-wins). "Clear" removes the key explicitly, so the
      // default view never needs to touch storage here.
      if (!s.discoveryCountry) return;
      localStorage.setItem(
        DISCOVERY_VIEW_KEY,
        JSON.stringify({
          country: s.discoveryCountry,
          page: s.discoveryPage,
          pageSize: s.discoveryPageSize,
          query: s.discoveryQuery,
        }),
      );
    } catch {
      /* storage unavailable — the in-memory view still drives the UI */
    }
  }, [s.discoveryCountry, s.discoveryPage, s.discoveryPageSize, s.discoveryQuery]);

  const { theme, setTheme, toggleTheme } = useTheme('dark');
  const { toast: toastState, showToast: toast, toastTone, toastIconName } = useToast();

  const stateRef = useRef(s);
  stateRef.current = s;
  // Live EventSource for the real CDP send job's log stream (null when idle).
  const sendEsRef = useRef<EventSource | null>(null);
  // Guard so the "reattach to an in-flight send after reload" probe runs once.
  const reconnectTriedRef = useRef(false);

  const statsRes = useResource(fetchStats, [], EMPTY_STATS);
  const stats = statsRes.data;

  const accountsRes = useResource(() => fetchAccounts(), [], { cdp: 'up' as const, endpoint: '', accounts: [] as Account[] });
  const accounts = accountsRes.data.accounts;

  const citiesRes = useResource(() => fetchCrawledCities(120), [], [] as City[]);
  const cityList = citiesRes.data;

  const countriesRes = useResource(fetchCountries, [], { regions: [], countries: [] } as CountriesResponse);
  const countryData = countriesRes.data;

  // `discoverySearch` is the immediate text-box value; `discoveryQuery` is the
  // debounced/committed value that actually drives the fetch. Committing resets
  // the page in the SAME state update so a search never fires a stale
  // wrong-offset request before the debounce settles.
  const discSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Push a searched term to the front of the recent-search history (deduped
  // case-insensitively, capped). Skips blanks and single characters so partial
  // typing never pollutes the list.
  const recordCitySearch = (raw: string) => {
    const term = raw.trim();
    if (term.length < 2) return;
    const key = term.toLowerCase();
    update((st) => ({
      recentCities: [term, ...st.recentCities.filter((t) => t.toLowerCase() !== key)].slice(0, RECENT_CITIES_MAX),
    }));
  };
  const commitDiscoverySearch = (q: string) => {
    patch({ discoverySearch: q });
    clearTimeout(discSearchTimer.current);
    // Record only the settled term (after the debounce) so intermediate
    // keystrokes don't each land in the history.
    discSearchTimer.current = setTimeout(() => {
      patch({ discoveryQuery: q, discoveryPage: 0 });
      recordCitySearch(q);
    }, 300);
  };
  useEffect(() => () => clearTimeout(discSearchTimer.current), []);

  const countryCitiesRes = useResource(
    () =>
      s.discoveryCountry
        ? fetchCitiesByCountry(s.discoveryCountry, {
          limit: s.discoveryPageSize,
          offset: s.discoveryPage * s.discoveryPageSize,
          search: s.discoveryQuery,
        })
        : Promise.resolve({ cities: [] as City[], total: 0 }),
    [s.discoveryCountry, s.discoveryPage, s.discoveryPageSize, s.discoveryQuery],
    { cities: [] as City[], total: 0 },
  );

  // A restored (or tampered) page can land beyond the country's current last
  // page — then the fetch returns an empty page while the table would show a
  // false "no cities" card with no pager to escape. Once the real total is known,
  // snap an out-of-range page back to the last valid page so it re-fetches
  // populated rows and the pager reappears.
  useEffect(() => {
    if (!s.discoveryCountry || countryCitiesRes.loading) return;
    const total = countryCitiesRes.data.total;
    if (total <= 0) return;
    const maxPage = Math.max(0, Math.ceil(total / s.discoveryPageSize) - 1);
    if (s.discoveryPage > maxPage) patch({ discoveryPage: maxPage });
  }, [s.discoveryCountry, s.discoveryPage, s.discoveryPageSize, countryCitiesRes.data.total, countryCitiesRes.loading]);

  // ---- City view -----------------------------------------------------------
  // A dedicated, read-only browse of every city loaded for a country: server-
  // paginated and searchable. It defaults to whichever country is selected on the
  // Countries page (s.selectedCountry) until the operator picks one from the
  // City-view dropdown (s.cityViewCode), after which the page tracks its own
  // selection independently of the Countries/Discovery views.
  const cityViewCode = s.cityViewCode ?? s.selectedCountry;
  const cityViewMeta = countryData.countries.find((c) => c.code === cityViewCode) ?? null;
  const cityViewCountryName = cityViewMeta?.name ?? null;

  const cityViewSearchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const commitCityViewSearch = (q: string) => {
    patch({ cityViewSearch: q });
    clearTimeout(cityViewSearchTimer.current);
    // Reset to page 0 in the SAME update that commits the query so a search never
    // fires a stale wrong-offset request before the debounce settles.
    cityViewSearchTimer.current = setTimeout(() => patch({ cityViewQuery: q, cityViewPage: 0 }), 300);
  };
  useEffect(() => () => clearTimeout(cityViewSearchTimer.current), []);

  const cityViewRes = useResource(
    () =>
      cityViewCountryName
        ? fetchCitiesByCountry(cityViewCountryName, {
          limit: s.cityViewPageSize,
          offset: s.cityViewPage * s.cityViewPageSize,
          search: s.cityViewQuery,
        })
        : Promise.resolve({ cities: [] as City[], total: 0 }),
    [cityViewCountryName, s.cityViewPage, s.cityViewPageSize, s.cityViewQuery],
    { cities: [] as City[], total: 0 },
  );

  // Switching to a smaller country (or a tampered page) can leave the page beyond
  // the last valid one — an empty page with no rows and a false "nothing here"
  // read. Once the real total is known, snap it back to the last populated page.
  useEffect(() => {
    if (!cityViewCountryName || cityViewRes.loading) return;
    const total = cityViewRes.data.total;
    if (total <= 0) return;
    const maxPage = Math.max(0, Math.ceil(total / s.cityViewPageSize) - 1);
    if (s.cityViewPage > maxPage) patch({ cityViewPage: maxPage });
  }, [cityViewCountryName, s.cityViewPage, s.cityViewPageSize, cityViewRes.data.total, cityViewRes.loading]);

  const exportsRes = useResource(fetchExports, [], [] as ExportFile[]);

  const recipRes = useResource(fetchRecipientCount, [], 0);
  const recipientsUnique = recipRes.data;

  const sampleRes = useResource(() => fetchLeads({ hasEmail: true, limit: LEADS_PAGE }), [], { leads: [] as Lead[], total: 0 });
  const sample: Lead | undefined = sampleRes.data.leads[0];

  const debouncedSearch = useDebounced(s.search, 300);
  const leadsRes = useResource(
    () => fetchLeads({
      search: debouncedSearch,
      hasEmail: true,
      source: s.fltSource,
      sort: { key: s.sortKey, dir: s.sortDir },
      limit: s.leadsPageSize,
      offset: s.leadsPage * s.leadsPageSize,
    }),
    [debouncedSearch, s.fltSource, s.sortKey, s.sortDir, s.leadsPageSize, s.leadsPage],
    { leads: [] as Lead[], total: 0 },
  );
  const filteredLeads = leadsRes.data.leads;
  const leadsTotal = leadsRes.data.total;

  const goTo = (to: string) => (e?: React.MouseEvent) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1)) return;
    if (e) e.preventDefault();
    navigate(to);
    patch({ palette: false, mobileNav: false });
  };
  const nav = (screen: Screen) => goTo(SCREEN_PATH[screen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setState((st) => ({ ...st, palette: !st.palette }));
      }
      if (e.key === 'Escape') patch({ palette: false, confirm: false, drawer: null, pwModal: false });
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      sendEsRef.current?.close();
      sendEsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (accounts.length && s.senders.length !== accounts.length) {
      patch({ senders: accounts.map(() => true) });
    }
  }, [accounts.length]);

  useEffect(() => {
    if (!s.authed || typeof window === 'undefined' || typeof EventSource === 'undefined') return;
    const onStatus = (ev: MessageEvent) => {
      try { patch({ crawlStatus: (JSON.parse(ev.data).status as JobStatus) ?? 'idle' }); } catch { }
    };
    const onLine = (ev: MessageEvent) => {
      try {
        const line = JSON.parse(ev.data) as JobLine;
        setState((prev) => ({ ...prev, crawlLines: [...prev.crawlLines.slice(-199), line] }));
      } catch { }
    };
    const onEnd = (ev: MessageEvent) => {
      try { patch({ crawlStatus: (JSON.parse(ev.data).status as JobStatus) ?? 'idle' }); } catch { }
    };

    let es: EventSource;
    let retry: ReturnType<typeof setTimeout>;
    let closed = false;
    const open = () => {
      es = new EventSource(DISCOVERY_STREAM_URL);
      es.addEventListener('status', onStatus);
      es.addEventListener('line', onLine);
      es.addEventListener('end', onEnd);
      es.onerror = () => {
        // The browser auto-retries transient drops itself (readyState CONNECTING).
        // A hard failure — e.g. the Vite proxy returning 500 while the backend is
        // down/restarting — closes the stream for good, so re-open it on a backoff.
        if (es.readyState === EventSource.CLOSED && !closed) {
          es.close();
          clearTimeout(retry);
          retry = setTimeout(open, 2000);
        }
      };
    };
    open();
    return () => { closed = true; clearTimeout(retry); es.close(); };
  }, [s.authed]);

  const sortBy = (k: LeadSortKey) => () =>
    update((st) => ({
      sortKey: k,
      sortDir: st.sortKey === k ? (st.sortDir === 'asc' ? 'desc' : 'asc') : 'desc',
      leadsPage: 0,
    }));

  // Accounts eligible to send from right now. A real send also drops any account
  // that has already hit today's per-account cap (from the client-side daily
  // tally); drafts don't consume the cap, so every enabled account stays in.
  const senderList = () => {
    const draft = s.mode === 'draft';
    const tally = s.sentDaily.date === todayKey() ? s.sentDaily.byEmail : {};
    return accounts.filter(
      (a, i) => s.senders[i] && a.status !== 'capped' && (draft || (tally[a.email] ?? 0) < s.dailyCap),
    );
  };
  const recipientCount = () => {
    const start = Math.max(0, s.startIndex | 0);
    if (s.scope === 'count') return Math.max(0, Math.min(s.count | 0, recipientsUnique - start));
    return Math.max(0, recipientsUnique - start);
  };

  // Reduce one streamed log line from the CDP sender into live run state: track
  // the current recipient/account, count confirmed messages, and surface the
  // same raw stdout/stderr the terminal shows.
  const applySendLine = (entry: { stream: 'stdout' | 'stderr'; line: string }) => {
    setState((st) => {
      const run = st.send;
      if (!run || (run.status !== 'running' && run.status !== 'stopping')) return st;
      const logs = [...run.logs, { stream: entry.stream, line: entry.line }].slice(-160);
      let sent = run.sent;
      let waiting = run.waiting;
      let current = run.current;
      let accts = run.accts;
      let monCounted = run.counted;
      let sentDaily = st.sentDaily;
      let sendProgress = st.sendProgress;
      const line = entry.line;
      let m: RegExpMatchArray | null;

      if ((m = line.match(/\[(\d+)\/(\d+)\]\s+via\s+\/u\/(\d+)\//))) {
        // Sender picked the next recipient, routing through account /u/<slot>/.
        // m[1] is the global 1-based message index (used to de-dup replays).
        current = { name: '', email: '', slot: Number(m[3]), index: Number(m[1]) };
        waiting = 0;
      } else if ((m = line.match(/^\s*>\s+(.+?)\s+<([^>]+)>/))) {
        // "> Name <email>" — the recipient of the message being composed.
        current = { name: m[1], email: m[2], slot: current?.slot ?? 0, index: current?.index ?? 0 };
      } else if (/^\s*Sent\.\s*$/.test(line) || /Draft (filled|saved)/i.test(line)) {
        // The SSE endpoint replays its whole buffer on every (re)connect, so gate
        // BOTH counters on their own high-water. The live monitor uses an
        // in-memory per-run water mark (resets on reload — that's fine, it's a
        // live view); the durable daily tally uses a PERSISTED water mark so a
        // reload (monCounted reset to 0) still can't double-count it.
        if (current && current.index > monCounted) {
          monCounted = current.index;
          sent += 1;
          const slot = current.slot;
          const acct = accts.find((a) => a.slot === slot);
          accts = accts.map((a) => (a.slot === slot ? { ...a, sent: a.sent + 1 } : a));
          // Roll REAL sends onto the sending account's cumulative daily tally
          // (keyed by the account email, not the recipient's). Feeds the Accounts
          // Daily-cap gauge, which is a protective Gmail *send* limit — drafts
          // don't consume it, so a dry run advances only the monitor above.
          const runKey = run.startedAt;
          const dailyCounted = sendProgress && sendProgress.key === runKey ? sendProgress.counted : 0;
          if (acct && !run.dry && current.index > dailyCounted) {
            const today = todayKey();
            const base = sentDaily.date === today ? sentDaily.byEmail : {};
            sentDaily = { date: today, byEmail: { ...base, [acct.email]: (base[acct.email] ?? 0) + 1 } };
            sendProgress = { key: runKey, counted: current.index };
          }
        }
      } else if ((m = line.match(/Waiting\s+([\d.]+)\s*s/i))) {
        waiting = parseFloat(m[1]) || 0;
      }
      return { ...st, sentDaily, sendProgress, send: { ...run, logs, sent, waiting, current, accts, counted: monCounted } };
    });
  };

  const closeSendStream = () => {
    sendEsRef.current?.close();
    sendEsRef.current = null;
  };

  const onSendEnd = (ev: MessageEvent) => {
    let data: { status?: string } = {};
    try { data = JSON.parse(ev.data); } catch { }
    setState((st) => {
      if (!st.send) return st;
      const status: SendStatus = data.status === 'stopped' ? 'stopped' : data.status === 'failed' ? 'failed' : 'done';
      const verb = st.send.dry ? 'drafted' : 'sent';
      return {
        ...st,
        send: {
          ...st.send, status, endedAt: Date.now(), current: null, waiting: 0,
          logs: [...st.send.logs, { stream: 'stdout' as const, line: 'Run ' + status + '. ' + fmt(st.send.sent) + ' message' + (st.send.sent === 1 ? '' : 's') + ' ' + verb + '.' }].slice(-160),
        },
      };
    });
    closeSendStream();
  };

  const openSendStream = () => {
    if (typeof EventSource === 'undefined') return;
    closeSendStream();
    const es = new EventSource(CAMPAIGN_STREAM_URL);
    sendEsRef.current = es;
    es.addEventListener('line', (ev) => { try { applySendLine(JSON.parse((ev as MessageEvent).data)); } catch { } });
    es.addEventListener('end', onSendEnd as EventListener);
    // 'status' (initial job snapshot) needs no handling; the browser auto-retries
    // transient drops, and a finished run is closed by the 'end' event above.
  };

  const startSend = () => {
    const dry = s.mode === 'draft';
    const cap = s.dailyCap;
    const tally = s.sentDaily.date === todayKey() ? s.sentDaily.byEmail : {};
    const enabled = senderList();
    if (!enabled.length) {
      toast(
        dry
          ? 'No accounts available to draft from'
          : "Every selected account has hit today's daily cap — clear the daily cap or raise it to send more",
        'warning',
      );
      return;
    }
    // Seed each account's monitor tally with what it already sent today (send mode
    // only — drafts don't consume the cap), so the live monitor shows the run
    // topping accounts up to the cap rather than starting every bar at 0.
    const accts = enabled.map((a) => ({
      slot: a.slot, email: a.email, sent: dry ? 0 : (tally[a.email] ?? 0), cap, blocked: false,
    }));
    // This run's capacity is the sum of each account's REMAINING headroom, so the
    // progress total matches how many messages the sender will actually send.
    const capacity = accts.reduce((sum, a) => sum + Math.max(0, cap - a.sent), 0);
    const total = Math.min(recipientCount(), capacity);

    // Fold the required footer (identity + opt-out) into the body exactly as the
    // live preview shows it, then persist it as the template the sender renders.
    const footer = [s.senderIdentity, s.unsubLine].map((x) => x.trim()).filter(Boolean).join('\n');
    const message = footer ? s.body + '\n\n' + footer : s.body;

    const all = s.scope === 'all';
    const count = s.scope === 'count' ? s.count : undefined;
    const index = s.startIndex > 0 ? s.startIndex : undefined;
    const perAccount = cap;
    const slots = accts.map((a) => a.slot);
    // Tell the sender how many each account already sent today so it caps each at
    // (perAccount − alreadySent) NEW messages this run instead of a fresh full batch.
    const sentOffsets: Record<number, number> = {};
    if (!dry) for (const a of accts) { if (a.sent > 0) sentOffsets[a.slot] = a.sent; }

    patch({
      confirm: false,
      send: {
        dry, status: 'running', startedAt: Date.now(), endedAt: null,
        sent: 0, total, accts, current: null, waiting: 0, counted: 0,
        logs: [
          { stream: 'stdout', line: '$ ghfinder send --' + (dry ? 'draft' : 'send') + ' --per-account ' + perAccount + (all ? ' --all' : ' --count ' + count) },
          { stream: 'stdout', line: dry ? 'Draft mode — each message fills a Gmail compose window over CDP; nothing is sent.' : 'Send mode — delivering via CDP-driven Gmail tabs on :9222.' },
          { stream: 'stdout', line: 'Starting the sender process…' },
        ],
      },
    });

    saveCampaignTemplate({ subject: s.subject, message })
      .then(() => startCampaignSend({ dryRun: dry, all, count, index, perAccount, accounts: slots, sentOffsets: dry ? undefined : sentOffsets }))
      .then((state) => {
        // Adopt the backend job's startedAt as the run key so the de-dup
        // high-water (sendProgress) lines up if the page is reloaded mid-run.
        const key = state?.startedAt;
        if (key != null) update((st) => (st.send ? { send: { ...st.send, startedAt: key } } : {}));
        openSendStream();
      })
      .catch((e) => {
        setState((st) => (st.send
          ? {
            ...st, send: {
              ...st.send, status: 'failed', endedAt: Date.now(), current: null, waiting: 0,
              logs: [...st.send.logs, { stream: 'stderr' as const, line: errMsg(e, 'Could not start the send') }].slice(-160)
            }
          }
          : st));
        toast(errMsg(e, 'Could not start the send'), 'danger');
      });
  };

  const stopSend = () => {
    update((st) => (st.send ? { send: { ...st.send, status: 'stopping' } } : {}));
    stopCampaignSend().catch((e) => toast(errMsg(e, 'Could not stop the send'), 'warning'));
  };

  const closeSend = () => {
    closeSendStream();
    patch({ send: null });
  };

  // After a reload (or first mount) reattach to a send that is still running on
  // the backend, so its post-reload messages keep flowing into the live monitor
  // and the daily tally. The SSE replay is de-duped by message index in
  // applySendLine, so re-counting already-tallied messages can't happen. Runs
  // once, only when no local run is active and the account roster has loaded
  // (needed to map /u/slot/ → email for the tally key).
  useEffect(() => {
    if (reconnectTriedRef.current) return;
    if (!s.authed || s.send || accountsRes.loading || accountsRes.error) return;
    // Latch synchronously to avoid concurrent probes; a transient failure clears
    // it in the catch so a later dependency change can retry.
    reconnectTriedRef.current = true;
    fetchCampaignSendStatus()
      .then((job) => {
        // Re-check inside the async callback: a run may have been started (or the
        // job finished) while the status GET was in flight — never clobber it.
        if (stateRef.current.send || !job.running || !Array.isArray(job.argv)) return;
        const argv = job.argv;
        const at = (flag: string) => { const i = argv.indexOf(flag); return i !== -1 ? argv[i + 1] : undefined; };
        const dry = !argv.includes('--send');
        const accArg = at('--accounts');
        const slots = accArg
          ? accArg.split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n))
          : accounts.map((a) => a.slot);
        // Only reattach once the roster actually covers the run's slots, so the
        // tally is keyed by real account emails (never a phantom '/u/N/' key).
        if (!slots.length || !slots.every((slot) => accounts.some((a) => a.slot === slot))) return;
        const cap = Number(at('--per-account')) > 0 ? Number(at('--per-account')) : s.dailyCap;
        const emailForSlot = (slot: number) => accounts.find((a) => a.slot === slot)?.email ?? '/u/' + slot + '/';
        const reAccts = slots.map((slot) => ({ slot, email: emailForSlot(slot), sent: 0, cap, blocked: false }));
        patch({
          send: {
            dry, status: 'running', startedAt: job.startedAt ?? Date.now(), endedAt: null,
            sent: 0, total: reAccts.length * cap, accts: reAccts, current: null, waiting: 0, counted: 0,
            logs: [{ stream: 'stdout', line: 'Reattached to a send already running on the backend (live counts resume from here)…' }],
          },
        });
        openSendStream();
        toast('Reattached to a send already in progress', 'info');
      })
      .catch(() => { reconnectTriedRef.current = false; /* transient — allow a retry */ });
  }, [s.authed, s.send, accountsRes.loading, accountsRes.error]);

  const navDef: [Screen, string, string | null][] = [
    ['dashboard', 'Dashboard', null],
    ['discovery', 'Discovery', stats.citiesActive ? String(stats.citiesActive) : null],
    ['countries', 'Countries', null],
    ['cities', 'City view', null],
    ['leads', 'Leads', stats.usersTotal ? compact(stats.usersTotal) : null],
    ['campaigns', 'Campaigns', null],
    ['accounts', 'Accounts', accounts.length ? String(accounts.length) : null],
    ['exports', 'Exports', null],
    ['settings', 'Settings', null],
  ];
  const navItems = navDef.map(([key, label, badge]) => ({
    key, label, badge, iconName: key, active: screen === key, go: nav(key), href: SCREEN_PATH[key],
  }));

  const leads = filteredLeads.map((u) => {
    const selected = !!s.sel[u.login];
    return {
      key: u.login, login: u.login, name: u.name, loc: u.loc, city: u.city,
      email: u.email, noEmail: !u.email,
      srcTag: u.src, srcTone: (u.src ? SRC_TONE[u.src] : 'neutral') as Tone,
      followers: fmt(u.followers), repos: u.repos, company: u.company || '—',
      avColor: hue(u.login), avInit: initials(u.name),
      hireLabel: u.hireable ? 'Yes' : 'No', hireTone: (u.hireable ? 'success' : 'neutral') as Tone,
      tg: u.tg, dc: u.dc, selected,
      toggle: () => update((st) => ({ sel: { ...st.sel, [u.login]: !st.sel[u.login] } })),
      copyEmail: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); toast(u.email ? 'Copied ' + u.email : 'No email on this lead', u.email ? 'success' : 'warning'); },
      openDetail: (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation();
        patch({ drawer: u, rawOpen: false, drawerLoading: true });
        fetchLeadDetail(u.login)
          .then((full) => setState((st) => (st.drawer && st.drawer.login === full.login ? { ...st, drawer: full, drawerLoading: false } : st)))
          .catch(() => setState((st) => (st.drawer && st.drawer.login === u.login ? { ...st, drawerLoading: false } : st)));
      },
      openGh: (e: React.MouseEvent) => { e.preventDefault(); toast('Opening github.com/' + u.login, 'info'); },
    };
  });
  const selCount = Object.values(s.sel).filter(Boolean).length;
  const allSel = filteredLeads.length > 0 && filteredLeads.every((u) => s.sel[u.login]);
  const srcTabs = (['all', 'readme', 'profile', 'commits'] as const).map((val) => ({
    key: val, label: val === 'all' ? 'All' : val, active: s.fltSource === val,
    go: () => patch({ fltSource: val, leadsPage: 0 }),
  }));

  const enrichLabels = listEnrichmentOptions();
  const enrich = enrichLabels.map((label, i) => ({
    key: label, label, hasNum: i === 1, num: s.reposToScan, checked: s.enrich[i],
    toggle: () => update((st) => { const e = st.enrich.slice(); e[i] = !e[i]; return { enrich: e }; }),
  }));

  const crawling = s.crawlStatus === 'running';
  // The crawler writes all output to stderr, so categorise by the line's own
  // [tag] prefix (city/user/search/done/warn/…) rather than the stream.
  const LOG_TONE: Record<string, Tone> = {
    city: 'accent', user: 'success', search: 'neutral', done: 'accent',
    summary: 'accent', stop: 'warning', skip: 'warning', warn: 'warning', error: 'danger',
  };
  const dLog = s.crawlLines.length
    ? s.crawlLines.slice(-10).map((l, i) => {
      const m = l.line.match(/^\s*\[(\w+)\]\s*(.*)$/s);
      const word = (m ? m[1] : l.stream === 'stderr' ? 'warn' : 'crawl').toLowerCase();
      return {
        key: i,
        tag: `[${word}]`,
        tone: (LOG_TONE[word] ?? (l.stream === 'stderr' ? 'warning' : 'accent')) as Tone,
        msg: m ? m[2] : l.line,
      };
    })
    : [{
      key: 0,
      tag: crawling ? '[crawl]' : '[idle]',
      tone: (crawling ? 'accent' : 'neutral') as Tone,
      msg: crawling ? 'starting crawler…' : 'crawler idle — press Start to begin a run',
    }];

  const cdpReal = accountsRes.data.cdp === 'up';
  const cdpUp = cdpReal && s.cdp !== 'down';
  const cdpEndpoint = accountsRes.data.endpoint || 'http://127.0.0.1:9222';
  const cdpEndpointShort = cdpEndpoint.replace(/^https?:\/\//, '');
  const discovered = accounts.length;
  // Gate the tally on the stored day: if the page has sat open past midnight with
  // no send/reload to reset it, don't show yesterday's counts as today's.
  const sentToday = s.sentDaily.date === todayKey() ? s.sentDaily.byEmail : {};
  const sentTodayTotal = Object.values(sentToday).reduce((sum, n) => sum + n, 0);
  // Drafts don't consume the daily cap; a real send skips accounts already at it.
  const draftMode = s.mode === 'draft';
  const capRemaining = (email: string) => Math.max(0, s.dailyCap - (sentToday[email] ?? 0));
  const eligibleToSend = (a: Account) => draftMode || capRemaining(a.email) > 0;
  const roster = accounts.map((a, i) => {
    const enabled = !!s.senders[i] && a.status !== 'capped';
    const sentCount = sentToday[a.email] ?? 0;
    const frac = a.cap ? sentCount / a.cap : 0;
    const near = frac >= 0.85;
    const capTone: Tone = a.status === 'capped' || frac >= 1 ? 'danger' : near ? 'warning' : 'accent';
    const live = cdpUp && a.status === 'sending';
    const st = ACCT_STATUS[a.status];
    return {
      key: a.slot, slot: '/u/' + a.slot + '/', email: a.email, title: a.title,
      color: hue(a.email), init: initials(a.email[0] + ' ' + a.email[1]),
      statusLabel: cdpUp ? st.label : 'Offline', statusTone: (cdpUp ? st.tone : 'neutral') as Tone,
      dotTone: (live ? 'warning' : cdpUp ? 'success' : 'neutral') as Tone, dotPulse: live,
      sent: fmt(sentCount), cap: fmt(a.cap), capPct: Math.min(100, Math.round(frac * 100)), capTone,
      enabled,
      toggleEnabled: () => { if (a.status === 'capped') { toast('/u/' + a.slot + '/ is capped for today', 'warning'); return; } update((st2) => { const x = st2.senders.slice(); x[i] = !x[i]; return { senders: x }; }); },
      openMailbox: () => {
        svcOpenMailbox(a.index)
          .then((r) => toast((r.focused ? 'Focused ' : 'Opened ') + a.email + ' in Chrome', 'info'))
          .catch((e) => toast(errMsg(e, 'Could not open mailbox'), 'danger'));
      },
      exclude: () => { update((st2) => { const x = st2.senders.slice(); x[i] = false; return { senders: x }; }); toast('/u/' + a.slot + '/ excluded from this run', 'warning'); },
    };
  });
  const enabledAccts = accounts.filter((a, i) => s.senders[i] && a.status !== 'capped' && eligibleToSend(a));
  const enabledCount = enabledAccts.length;

  const recip = recipientCount();
  const rotN = Math.max(1, enabledCount);
  const perAcctEst = Math.min(Math.ceil(recip / rotN), s.dailyCap);
  const rotation = enabledAccts.map((a, i) => {
    const base = Math.floor(recip / rotN);
    const rem = recip % rotN;
    const headroom = draftMode ? s.dailyCap : capRemaining(a.email);
    const share = Math.min(base + (i < rem ? 1 : 0), headroom);
    return { key: a.slot, slot: '/u/' + a.slot + '/', count: fmt(share), wPct: 100 / rotN, color: hue(a.email) };
  });

  const isDraft = draftMode;
  const hasSubject = !!s.subject.trim();
  const hasBody = !!s.body.trim();
  const hasIdentity = !!s.senderIdentity.trim();
  const hasUnsub = !!s.unsubLine.trim();
  const capOverGmail = s.dailyCap > SAFE_DAILY_CAP;
  const checklist = [
    { label: 'Chrome CDP connected', ok: cdpUp, hint: cdpUp ? cdpEndpointShort : 'offline — fix in Accounts' },
    { label: 'Accounts selected', ok: enabledCount > 0, hint: enabledCount + ' account' + (enabledCount !== 1 ? 's' : '') },
    { label: 'Subject + body present', ok: hasSubject && hasBody, hint: hasSubject && hasBody ? 'ready' : 'incomplete' },
    { label: 'Sender identity line', ok: hasIdentity, hint: hasIdentity ? 'ok' : 'required' },
    { label: 'Unsubscribe / opt-out line', ok: hasUnsub, hint: hasUnsub ? 'ok' : 'required' },
    { label: 'Recipients resolved', ok: recip > 0, hint: fmt(recip) + ' unique' },
  ].map((it, i) => ({
    key: i, ...it, iconName: it.ok ? 'check' : 'alert', tone: (it.ok ? 'success' : 'warning') as Tone,
  }));
  const preflightOk = checklist.every((it) => it.ok);
  const capacity = draftMode
    ? enabledCount * s.dailyCap
    : enabledAccts.reduce((sum, a) => sum + capRemaining(a.email), 0);
  const toSend = Math.min(recip, capacity || recip);
  const estSec = Math.round(toSend * 7.5);
  const estRuntime = Math.floor(estSec / 3600) + ':' + String(Math.round((estSec % 3600) / 60)).padStart(2, '0');
  const recap =
    'Send to ' + fmt(recip) + ' recipients, round-robin across ' + enabledCount + ' account' +
    (enabledCount !== 1 ? 's' : '') + ', ≤ ' + s.dailyCap + '/account, ~5–10s between each — est. runtime ' + estRuntime + '.';

  const senderChips = accounts.map((a, i) => {
    const capped = a.status === 'capped' || (!draftMode && capRemaining(a.email) <= 0);
    return {
      key: a.slot, slot: '/u/' + a.slot + '/', capped,
      on: !!s.senders[i] && !capped,
      toggle: () => { if (capped) { toast('/u/' + a.slot + "/ has hit today's daily cap", 'warning'); return; } update((st2) => { const x = st2.senders.slice(); x[i] = !x[i]; return { senders: x }; }); },
    };
  });

  const firstName = sample ? sample.name.split(' ')[0] : 'there';
  const previewSubject = s.subject.split('{{firstName}}').join(firstName);
  const previewBody = s.body.split('{{firstName}}').join(firstName);

  const exportsList = exportsRes.data.map((f) => ({
    key: f.name, name: f.name, type: f.type,
    records: f.records ? fmt(f.records) : '—', recordsRaw: f.records ?? 0,
    size: f.size, created: f.created,
    fileTone: FILE_TONE[f.kind],
    copyPath: () => toast('Copied ./exports/' + f.name, 'success'),
    downloadFile: () => toast('Downloading ' + f.name, 'info'),
  }));

  const dl = s.drawer;
  const dLead = dl
    ? {
      login: dl.login, name: dl.name, city: dl.city, fetched: dl.fetched, bio: dl.bio,
      avColor: hue(dl.login), avInit: initials(dl.name), followers: fmt(dl.followers), repos: dl.repos,
      email: dl.email, emailOrDash: dl.email || 'No email found',
      srcTag: dl.src, srcTone: (dl.src ? SRC_TONE[dl.src] : 'neutral') as Tone,
      blog: dl.blog || '—',
      tgPresent: dl.tg, dcPresent: dl.dc,
      raw: JSON.stringify(
        { login: dl.login, name: dl.name, location: dl.loc, email: dl.email, email_source: dl.src, followers: dl.followers, public_repos: dl.repos, hireable: dl.hireable, company: dl.company, blog: dl.blog, twitter: dl.tw, telegram: dl.tg, discord: dl.dc, source_city: dl.city },
        null, 2,
      ),
    }
    : null;

  const apiRemain = 1420;
  const apiPct = Math.round((apiRemain / 5000) * 100);
  const apiTone: Tone = apiPct > 40 ? 'success' : apiPct > 15 ? 'warning' : 'danger';


  const crawlBars = deriveCrawlBars(cityList).map((c, i) => ({ ...c, key: i }));
  const activity = deriveActivity(cityList).map((a, i) => ({ ...a, key: i }));
  const combinedDailyCap = accounts.length * s.dailyCap;
  // Share the durable per-day tally with the Accounts gauge so the two "today"
  // figures agree and survive the run closing / a reload (sentDaily persists and
  // resets daily), instead of reading the ephemeral in-flight run total.
  const sentTodayNum = Math.min(sentTodayTotal, combinedDailyCap || sentTodayTotal);
  const emailPct = stats.usersTotal ? +((stats.usersWithEmail / stats.usersTotal) * 100).toFixed(1) : 0;
  const socialPct = stats.usersTotal ? +((stats.usersWithSocial / stats.usersTotal) * 100).toFixed(1) : 0;
  const citiesDonePct = stats.citiesTotal ? Math.round((stats.citiesDone / stats.citiesTotal) * 100) : 0;

  const filteringByCountry = !!s.discoveryCountry;
  const activeCityList = filteringByCountry ? countryCitiesRes.data.cities : cityList;
  // The country view is filtered server-side; the default crawled-cities view
  // filters client-side off the same search box so a searched city narrows the list.
  const citySearchQ = filteringByCountry ? '' : s.discoverySearch.trim().toLowerCase();
  const visibleCityList = citySearchQ
    ? activeCityList.filter((c) => `${c.city} ${c.state}`.toLowerCase().includes(citySearchQ))
    : activeCityList;
  // Per-row status controls (Done / Active / Skip) shared by the Discovery and
  // City-view city tables. Each optimistically overrides the city's status, then
  // persists it; on API error the override reverts so the row snaps back.
  const CITY_ACTIONS: { status: City['status']; label: string; iconName: string }[] = [
    { status: 'done', label: 'Done', iconName: 'check' },
    { status: 'active', label: 'Active', iconName: 'play' },
    { status: 'skipped', label: 'Skip', iconName: 'skip' },
  ];
  const setCityStatus = (id: number, cityName: string, status: CityStatus) => {
    const prev = stateRef.current.cityOverride[id];
    if ((prev ?? null) === status) return;
    update((st) => ({ cityOverride: { ...st.cityOverride, [id]: status } }));
    svcSetCityStatus(id, status)
      .then(() => {
        const msg =
          status === 'skipped' ? `Skipped ${cityName} — crawler moves to the next city`
            : status === 'done' ? `Marked ${cityName} done`
              : status === 'active' ? `Marked ${cityName} active`
                : `${cityName} set to ${status}`;
        toast(msg, status === 'skipped' ? 'warning' : 'success');
      })
      .catch((e) => {
        update((st) => {
          const nx = { ...st.cityOverride };
          if (prev === undefined) delete nx[id]; else nx[id] = prev;
          return { cityOverride: nx };
        });
        toast(errMsg(e, 'Could not update city status'), 'danger');
      });
  };
  const cityStatusActions = (id: number, current: City['status'], cityName: string) =>
    CITY_ACTIONS.map((a) => ({
      key: a.status,
      label: a.label,
      iconName: a.iconName,
      // The button matching the city's current status is shown selected + disabled.
      current: current === a.status,
      onClick: () => setCityStatus(id, cityName, a.status),
    }));

  const cities = visibleCityList.map((c, i) => {
    const status = s.cityOverride[c.id] ?? c.status;
    return {
      ...c, key: i, status,
      found: c.found ? fmt(c.found) : '—', foundRaw: c.found ?? 0,
      statusTone: CITY_TONE[status],
      statusActions: cityStatusActions(c.id, status, c.city),
    };
  });

  const flagEmoji = (code: string) =>
    code.toUpperCase().replace(/[A-Z]/g, (ch) => String.fromCodePoint(127397 + ch.charCodeAt(0)));
  const countryRegions = countryData.regions
    .map((r) => ({
      id: r.id,
      label: r.label,
      countries: countryData.countries
        .filter((c) => c.region === r.id)
        .map((c) => ({
          key: c.code, code: c.code, name: c.name, flag: flagEmoji(c.code),
          // Formatted for readability (e.g. "9,638"); `loaded` marks countries
          // whose full list is already in the work list vs the curated preview.
          cityCount: fmt(c.cityCount), loaded: (c.loaded ?? 0) > 0,
          selected: s.selectedCountry === c.code,
          select: () => patch({ selectedCountry: c.code }),
        })),
    }))
    .filter((r) => r.countries.length > 0);
  const selCountry = countryData.countries.find((c) => c.code === s.selectedCountry) ?? null;
  const selectedCountryVM = selCountry
    ? {
      code: selCountry.code, name: selCountry.name, flag: flagEmoji(selCountry.code),
      region: countryData.regions.find((r) => r.id === selCountry.region)?.label ?? '',
      cityCount: fmt(selCountry.cityCount), loaded: (selCountry.loaded ?? 0) > 0,
    }
    : null;

  // City-view rows and the country picker's options, built here where flagEmoji
  // is in scope. Rows are read-only (no skip): this page is a browse, not the
  // crawl control surface Discovery provides.
  const cityViewRows = cityViewRes.data.cities.map((c, i) => {
    const status = s.cityOverride[c.id] ?? c.status;
    return {
      key: c.id || i,
      city: c.city,
      state: c.state,
      status,
      statusTone: CITY_TONE[status],
      found: c.found ? fmt(c.found) : '—',
      foundRaw: c.found ?? 0,
      updated: c.updated,
      statusActions: cityStatusActions(c.id, status, c.city),
    };
  });
  const cityViewCountryOptions = countryData.countries
    .map((c) => ({ code: c.code, name: c.name, flag: flagEmoji(c.code) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const cityViewRegion = cityViewMeta
    ? countryData.regions.find((r) => r.id === cityViewMeta.region)?.label ?? ''
    : '';

  const runCountry = () => {
    const code = stateRef.current.selectedCountry;
    if (!code) { toast('Select a country first', 'warning'); return; }
    if (stateRef.current.loadingCountry) return;
    patch({ loadingCountry: true });
    svcLoadCountryCities(code, stateRef.current.queryMode)
      .then((r) => {
        clearTimeout(discSearchTimer.current);
        patch({ loadingCountry: false, discoveryCountry: r.country, discoveryPage: 0, discoverySearch: '', discoveryQuery: '' });
        navigate(SCREEN_PATH.discovery);
        // Force a refresh even when re-running the same country at page 0 with no
        // search (identical state → no dep change → the resource would not refetch).
        countryCitiesRes.refetch();
        // Refresh the Countries page counts so the card reflects the loaded total.
        countriesRes.refetch();
        toast(
          r.inserted > 0
            ? 'Loaded ' + r.inserted + ' ' + r.country + ' cit' + (r.inserted === 1 ? 'y' : 'ies') + ' into the work list'
            : r.country + ' cities are already in the work list',
          'success',
        );
      })
      .catch((e) => { patch({ loadingCountry: false }); toast(errMsg(e, 'Could not load country cities'), 'danger'); });
  };

  // "Search all cities" — seed the country's ENTIRE city list (the full remote
  // gazetteer, e.g. ~9.6k German cities, not just the 12 curated hubs that
  // `runCountry` loads) into the work list, then open Discovery showing them all.
  // No crawl is started — this only pulls in the city names.
  const searchCountry = () => {
    const code = stateRef.current.selectedCountry;
    if (!code) { toast('Select a country first', 'warning'); return; }
    if (stateRef.current.searchingCountry || stateRef.current.loadingCountry) return;
    patch({ searchingCountry: true });
    svcLoadAllCountryCities(code, stateRef.current.queryMode)
      .then((r) => {
        clearTimeout(discSearchTimer.current);
        patch({
          searchingCountry: false,
          discoveryCountry: r.country,
          discoveryPage: 0,
          discoverySearch: '',
          discoveryQuery: '',
        });
        navigate(SCREEN_PATH.discovery);
        // Force a refresh even when the view state is unchanged (identical deps
        // wouldn't otherwise refetch the newly-seeded rows).
        countryCitiesRes.refetch();
        // Refresh the Countries page counts so the card reflects the real loaded
        // total (e.g. Germany 12 → 9,638) instead of the curated preview.
        countriesRes.refetch();
        toast(
          r.source === 'curated'
            ? "Couldn't reach the full city list — loaded " + r.country + "'s major cities instead"
            : 'Loaded all ' + fmt(r.total) + ' ' + r.country + ' cities into Discovery',
          r.source === 'curated' ? 'warning' : 'success',
        );
      })
      .catch((e) => { patch({ searchingCountry: false }); toast(errMsg(e, 'Could not fetch all cities'), 'danger'); });
  };

  // City-view empty state: seed the selected country's ENTIRE city list into the
  // work list (the full remote gazetteer, same source as "Search all cities"),
  // then refetch so the browse table populates — without leaving the City view.
  const loadCityViewAll = () => {
    const code = stateRef.current.cityViewCode ?? stateRef.current.selectedCountry;
    if (!code) { toast('Pick a country first', 'warning'); return; }
    if (stateRef.current.cityViewLoadingAll) return;
    patch({ cityViewLoadingAll: true });
    svcLoadAllCountryCities(code, stateRef.current.queryMode)
      .then((r) => {
        patch({ cityViewLoadingAll: false, cityViewPage: 0, cityViewSearch: '', cityViewQuery: '' });
        // Force a refresh even when the view state is unchanged (identical deps
        // wouldn't otherwise refetch the newly-seeded rows).
        cityViewRes.refetch();
        // Keep the Countries page counts in sync with the real loaded total.
        countriesRes.refetch();
        toast(
          r.source === 'curated'
            ? "Couldn't reach the full city list — loaded " + r.country + "'s major cities instead"
            : 'Loaded all ' + fmt(r.total) + ' ' + r.country + ' cities',
          r.source === 'curated' ? 'warning' : 'success',
        );
      })
      .catch((e) => { patch({ cityViewLoadingAll: false }); toast(errMsg(e, 'Could not fetch all cities'), 'danger'); });
  };

  const loadCitiesList = () => {
    if (stateRef.current.loadingCities) return;
    patch({ loadingCities: true });
    svcLoadCities(stateRef.current.queryMode)
      .then((r) => {
        patch({ loadingCities: false });
        citiesRes.refetch();
        toast(
          r.inserted > 0 ? 'Loaded ' + r.inserted + ' new cities into the work list' : 'Work list already up to date',
          r.inserted > 0 ? 'success' : 'info',
        );
      })
      .catch((e) => { patch({ loadingCities: false }); toast(errMsg(e, 'Could not load cities'), 'danger'); });
  };

  const sd = s.send;
  const sendVM = sd
    ? (() => {
      const el = Math.max(0, Math.floor(((sd.endedAt || Date.now()) - sd.startedAt) / 1000));
      const n = sd.accts.length || 1;
      return {
        send: true,
        sendStatusTone: SEND_TONE[sd.status], sendStatusPulse: sd.status === 'running',
        sendPct: sd.total ? Math.min(100, Math.round((sd.sent / sd.total) * 100)) : 0,
        sentFmt: fmt(sd.sent), totalFmt: fmt(sd.total),
        sendStarted: new Date(sd.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        sendElapsed: Math.floor(el / 60) + ':' + String(el % 60).padStart(2, '0'),
        curHas: !!sd.current, curName: sd.current?.name || '', curEmail: sd.current?.email || '',
        curSlot: sd.current ? '/u/' + sd.current.slot + '/' : '',
        waitingShow: sd.status === 'running' && sd.waiting > 0,
        waitingLabel: 'waiting ' + (sd.waiting || 0).toFixed(1) + 's…',
        monAccts: sd.accts.map((a) => ({
          key: a.slot, slot: '/u/' + a.slot + '/', email: a.email, sent: fmt(a.sent), cap: fmt(a.cap),
          wPct: a.cap ? Math.min(100, Math.round((a.sent / a.cap) * 100)) : 0, segWPct: 100 / n, color: hue(a.email),
          blocked: a.blocked,
        })),
        // Only the last 10 log lines are surfaced in the monitor.
        monLogs: sd.logs.slice(-10).map((l, i) => ({ key: String(i), line: l.line, stream: l.stream })),
        summarySent: fmt(sd.sent),
        summaryDur: Math.floor(el / 60) + 'm ' + (el % 60) + 's',
        summaryReason: sd.status === 'done' ? 'Completed' : sd.status === 'stopped' ? 'Stopped by operator' : sd.status === 'failed' ? 'Failed' : '—',
      };
    })()
    : {
      send: false as const, sendStatusTone: 'neutral' as Tone, sendStatusPulse: false, sendPct: 0,
      sentFmt: '0', totalFmt: '0', sendStarted: '', sendElapsed: '', curHas: false,
      curName: '', curEmail: '', curSlot: '', waitingShow: false, waitingLabel: '',
      monAccts: [] as { key: number; slot: string; email: string; sent: string; cap: string; wPct: number; segWPct: number; color: string; blocked: boolean }[],
      monLogs: [] as { key: string; line: string; stream: 'stdout' | 'stderr' }[],
      summarySent: '0', summaryDur: '', summaryReason: '',
    };

  return {
    theme,
    toggleTheme,
    themeIconName: theme === 'dark' ? 'sun' : 'moon',
    expanded: !s.collapsed,
    collapseIconName: s.collapsed ? 'chevR' : 'chev',
    toggleCollapse: (e: React.MouseEvent) => { e.preventDefault(); update((st) => ({ collapsed: !st.collapsed })); },
    nav: navItems,
    mobileNav: s.mobileNav,
    toggleMobileNav: (e: React.MouseEvent) => { e.stopPropagation(); update((st) => ({ mobileNav: !st.mobileNav })); },
    closeMobileNav: () => patch({ mobileNav: false }),

    openPalette: () => patch({ palette: true }),
    goAccounts: nav('accounts'), goDiscovery: nav('discovery'), goCampaigns: nav('campaigns'),
    apiRemain: fmt(apiRemain), apiPct, apiTone, apiReset: '34m',

    activeInit: initials(s.profile.name || s.profile.email || s.authUser?.name || ''),
    activeColor: hue(s.profile.email || s.authUser?.email || ''),
    activeAvatar: s.profile.avatar,
    acctMenu: s.acctMenu,
    toggleAcctMenu: (e: React.MouseEvent) => { e.stopPropagation(); update((st) => ({ acctMenu: !st.acctMenu })); },
    closeAcctMenu: () => patch({ acctMenu: false }),
    goProfile: () => { patch({ acctMenu: false }); navigate(SCREEN_PATH.profile); },
    openChangePassword: () => patch({ acctMenu: false, pwModal: true }),
    closeChangePassword: () => patch({ pwModal: false }),
    pwModalOpen: s.pwModal,
    submitChangePassword: async (currentPassword: string, newPassword: string) => {
      await changePassword(s.authUser?.email ?? '', currentPassword, newPassword);
      patch({ pwModal: false });
      toast('Password changed', 'success');
    },
    signOut: () => { closeSendStream(); clearSession(); patch({ authed: false, authUser: null, profile: emptyProfile(), acctMenu: false, send: null, drawer: null, palette: false, confirm: false, pwModal: false }); navigate(LOGIN_PATH); toast('Signed out', 'info'); },

    profile: s.profile,
    saveProfile: (next: Profile) => {
      svcSaveProfile(next);
      const identity: AuthUser = { name: next.name || next.email, email: next.email };
      updateSessionUser(identity);
      patch({ profile: next, authUser: identity });
      toast('Profile saved', 'success');
    },

    isDashboard: screen === 'dashboard', isDiscovery: screen === 'discovery', isCountries: screen === 'countries',
    isCities: screen === 'cities',
    isLeads: screen === 'leads',
    isCampaigns: screen === 'campaigns', isAccounts: screen === 'accounts', isExports: screen === 'exports', isSettings: screen === 'settings',
    isProfile: screen === 'profile',

    harvestedTotal: fmt(stats.usersTotal),
    sentToday: fmt(sentTodayNum), dailyCapTotal: fmt(combinedDailyCap),
    statEmails: fmt(stats.usersWithEmail), statSocial: fmt(stats.usersWithSocial),
    statCitiesDone: fmt(stats.citiesDone), statCitiesActive: fmt(stats.citiesActive),
    statCitiesPending: fmt(stats.citiesPending), statCitiesTotal: fmt(stats.citiesTotal),
    emailPct, socialPct, citiesDonePct,
    dashLoading: statsRes.loading && stats.usersTotal === 0,
    dashError: statsRes.error, retryDash: () => { statsRes.refetch(); citiesRes.refetch(); },
    crawlBars, activity,

    cities,
    // Only a genuine first/empty load shows the full-card spinner. On page/search
    // refetches the prior rows (and the DataTable's own SearchBox) stay mounted so
    // typing keeps focus; refetch feedback is a small spinner in the country banner.
    citiesLoading: (filteringByCountry ? countryCitiesRes.loading : citiesRes.loading) && activeCityList.length === 0,
    citiesError: filteringByCountry ? countryCitiesRes.error : citiesRes.error,
    retryCities: filteringByCountry ? countryCitiesRes.refetch : citiesRes.refetch,
    citiesEmpty: !citiesRes.loading && !citiesRes.error && activeCityList.length === 0,

    queryMode: s.queryMode,
    setQueryMode: (mode: QueryMode) => patch({ queryMode: mode }),
    loadCitiesList,
    citiesLoadingAction: s.loadingCities,

    // Work-list search box, controlled by the parent in both modes so a recent
    // chip can re-run it. In the country view the value drives the server query;
    // in the default view it drives the client-side filter above.
    citySearch: { value: s.discoverySearch, setValue: commitDiscoverySearch },
    recentSearches: s.recentCities.map((term) => ({
      term,
      run: () => commitDiscoverySearch(term),
      remove: () => update((st) => ({ recentCities: st.recentCities.filter((t) => t !== term) })),
    })),
    clearRecentSearches: () => patch({ recentCities: [] }),

    discoveryCountry: s.discoveryCountry,
    discoveryCountryFlag: (() => {
      const meta = countryData.countries.find((c) => c.name === s.discoveryCountry);
      return meta ? flagEmoji(meta.code) : '';
    })(),
    discoveryCityCount: filteringByCountry ? countryCitiesRes.data.total : 0,
    clearDiscoveryCountry: () => {
      clearTimeout(discSearchTimer.current);
      // Explicitly drop the persisted view so reloading after Clear lands on the
      // default list (the persist effect no longer writes once country is null).
      try {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(DISCOVERY_VIEW_KEY);
      } catch {
        /* storage unavailable */
      }
      patch({ discoveryCountry: null, discoveryPage: 0, discoverySearch: '', discoveryQuery: '' });
    },

    // Server-side pagination for the country work list (null in the default
    // crawled-cities view, which stays client-paginated). Lets the operator
    // page through e.g. the ~29.8k US cities 50/100/200 at a time.
    discoveryPaged: filteringByCountry
      ? {
        page: s.discoveryPage,
        pageSize: s.discoveryPageSize,
        total: countryCitiesRes.data.total,
        setPage: (p: number) => patch({ discoveryPage: Math.max(0, p) }),
        setPageSize: (n: number) => patch({ discoveryPageSize: n, discoveryPage: 0 }),
        search: s.discoverySearch,
        setSearch: commitDiscoverySearch,
        query: s.discoveryQuery,
        loading: countryCitiesRes.loading,
      }
      : null,

    goCountries: nav('countries'),
    countryRegions,
    countriesLoading: countriesRes.loading && countryData.countries.length === 0,
    countriesError: countriesRes.error, retryCountries: countriesRes.refetch,
    selectedCountry: selectedCountryVM, hasSelectedCountry: !!selectedCountryVM,
    runCountry, countryRunning: s.loadingCountry,
    countryRunLabel: s.loadingCountry ? 'Loading cities…' : 'Load cities & open Discovery',
    searchCountry, countrySearching: s.searchingCountry,
    countrySearchLabel: s.searchingCountry ? 'Loading all cities…' : 'Search all cities',

    // City-view page: browse a country's full city list, server-paginated.
    cityView: {
      countries: cityViewCountryOptions,
      code: cityViewCode,
      name: cityViewCountryName,
      flag: cityViewCode ? flagEmoji(cityViewCode) : '',
      region: cityViewRegion,
      hasCountry: !!cityViewCountryName,
      setCountry: (code: string) => {
        clearTimeout(cityViewSearchTimer.current);
        patch({ cityViewCode: code, cityViewPage: 0, cityViewSearch: '', cityViewQuery: '' });
      },
      rows: cityViewRows,
      total: cityViewRes.data.total,
      totalFmt: fmt(cityViewRes.data.total),
      page: s.cityViewPage,
      pageSize: s.cityViewPageSize,
      pageSizeOptions: [50, 100, 200],
      setPage: (p: number) => patch({ cityViewPage: Math.max(0, p) }),
      setPageSize: (n: number) => patch({ cityViewPageSize: n, cityViewPage: 0 }),
      search: s.cityViewSearch,
      setSearch: commitCityViewSearch,
      query: s.cityViewQuery,
      // Only a genuine first/empty load shows the full-card spinner; page/search
      // refetches keep the prior rows mounted and show a small header spinner.
      loading: cityViewRes.loading && cityViewRes.data.cities.length === 0,
      refetching: cityViewRes.loading,
      error: cityViewRes.error,
      retry: cityViewRes.refetch,
      // A selected country with nothing in the work list yet (and no active
      // search) — offer to seed its full city list right here.
      empty: !cityViewRes.loading && !cityViewRes.error && cityViewRes.data.total === 0 && !s.cityViewQuery.trim(),
      loadAll: loadCityViewAll,
      loadingAll: s.cityViewLoadingAll,
      goCountries: nav('countries'),
    },

    segmentsOpen: s.segmentsOpen, toggleSegments: () => update((st) => ({ segmentsOpen: !st.segmentsOpen })),
    crawling,
    toggleCrawl: () => {
      if (stateRef.current.crawlStatus === 'running') {
        stopCrawl().then(() => toast('Stopping crawler…', 'warning')).catch((e) => toast(errMsg(e, 'Could not stop crawler'), 'danger'));
      } else {
        patch({ crawlLines: [] });
        const country = stateRef.current.discoveryCountry;
        startCrawl(country ? { country } : {})
          .then(() => { patch({ crawlStatus: 'running' }); toast(country ? `Crawler started — ${country}` : 'Crawler started', 'success'); })
          .catch((e) => toast(errMsg(e, 'Could not start crawler'), 'danger'));
      }
    },
    crawlBtnLabel: crawling ? 'Stop crawler' : 'Start crawler', crawlBtnIconName: crawling ? 'stop' : 'play',
    enrich, logs: dLog, logDotTone: (crawling ? 'warning' : 'neutral') as Tone, logPulse: crawling,
    logStatus: crawling ? 'streaming' : s.crawlStatus === 'done' ? 'done' : s.crawlStatus === 'failed' ? 'failed' : 'idle',

    leadCount: fmt(leadsTotal), search: s.search, onSearch: (e: React.ChangeEvent<HTMLInputElement>) => patch({ search: e.target.value, leadsPage: 0 }),
    sourceTabs: srcTabs,
    hasFilters: s.fltSource !== 'all' || !!s.search,
    clearFilters: () => patch({ fltSource: 'all', search: '', leadsPage: 0 }),
    bulkOpen: selCount > 0, selectedCount: selCount,
    bulkAdd: () => toast('Added ' + selCount + ' leads to campaign', 'success'),
    bulkExport: () => toast('Exporting ' + selCount + ' leads', 'info'),
    clearSel: () => patch({ sel: {} }),
    toggleAll: () => update((st) => { const ns = { ...st.sel }; const all = filteredLeads.every((u) => ns[u.login]); filteredLeads.forEach((u) => (ns[u.login] = !all)); return { sel: ns }; }),
    allSelected: allSel,
    leads,
    leadSort: { columnId: s.sortKey, dir: s.sortDir },
    onLeadSort: (columnId: string) => sortBy(columnId as LeadSortKey)(),
    leadsLoading: leadsRes.loading && filteredLeads.length === 0,
    leadsError: leadsRes.error, retryLeads: leadsRes.refetch,
    noResults: !leadsRes.loading && !leadsRes.error && filteredLeads.length === 0,
    leadsPage: s.leadsPage,
    leadsPageSize: s.leadsPageSize,
    leadsTotalRaw: leadsTotal,
    leadsPageSizeOptions: [10, 20, 50, 100],
    onLeadsPageChange: (p: number) => patch({ leadsPage: Math.max(0, p) }),
    onLeadsPageSizeChange: (size: number) =>
      update((st) => ({ leadsPageSize: size, leadsPage: Math.floor((st.leadsPage * st.leadsPageSize) / size) })),

    subject: s.subject, body: s.body,
    onSubject: (e: React.ChangeEvent<HTMLInputElement>) => patch({ subject: e.target.value }),
    onBody: (e: React.ChangeEvent<HTMLTextAreaElement>) => patch({ body: e.target.value }),
    insertToken: () => update((st) => ({ body: (st.body || '') + ' {{firstName}}' })),
    tokenChip: '{{firstName}}',
    sampleEmail: sample?.email ?? '—', previewSubject, previewBody,
    previewIdentity: s.senderIdentity, previewUnsub: s.unsubLine,
    senderIdentity: s.senderIdentity, onIdentity: (e: React.ChangeEvent<HTMLInputElement>) => patch({ senderIdentity: e.target.value }),
    unsubLine: s.unsubLine, onUnsub: (e: React.ChangeEvent<HTMLTextAreaElement>) => patch({ unsubLine: e.target.value }),
    mode: s.mode, isDraft, setMode: (mode: Mode) => patch({ mode }),
    scopeAll: s.scope === 'all', scopeCount: s.scope === 'count',
    setScopeAll: () => patch({ scope: 'all' }), setScopeCount: () => patch({ scope: 'count' }),
    countDisabled: s.scope === 'all',
    startIndex: s.startIndex, onStartIndex: (e: React.ChangeEvent<HTMLInputElement>) => patch({ startIndex: Math.max(0, +e.target.value || 0) }),
    count: s.count, onCount: (e: React.ChangeEvent<HTMLInputElement>) => patch({ count: Math.max(0, +e.target.value || 0) }),
    dailyCap: s.dailyCap, onCap: (e: React.ChangeEvent<HTMLInputElement>) => patch({ dailyCap: Math.max(1, +e.target.value || 0) }), capOverGmail, safeDailyCap: SAFE_DAILY_CAP,
    senderChips, useAllAccounts: () => patch({ senders: accounts.map((a) => a.status !== 'capped') }),
    enabledCount, recip: fmt(recip), recipRaw: recip, rotation, perAcctEst: fmt(perAcctEst), estRuntime, recap,
    checklist, preflightOk, cdpUp, endpoint: cdpEndpointShort,
    launchDisabled: !preflightOk, launchLabel: isDraft ? 'Create drafts' : 'Start sending', launchIconName: isDraft ? 'mail' : 'send',
    modeNote: isDraft ? 'Draft mode fills each Gmail compose window so you can review before sending. Nothing leaves your outbox.' : 'Send mode delivers immediately via CDP-driven tabs. A confirmation is required before the first message.',
    launchBlockedNote: !cdpUp ? 'Chrome CDP offline — connect it in Accounts' : 'Resolve the pre-flight checklist to enable',
    openConfirm: () => { if (sd && (sd.status === 'running' || sd.status === 'stopping')) { toast('A run is already in progress', 'warning'); return; } if (!preflightOk) { toast(cdpUp ? 'Complete the pre-flight checklist first' : 'Chrome CDP is offline — fix it in Accounts', 'warning'); return; } patch({ confirm: true }); },

    discovered, discoveredFmt: fmt(discovered), endpointFull: cdpEndpoint,
    accountsLoading: accountsRes.loading, accountsError: accountsRes.error,
    retryCdp: () => { patch({ cdp: 'up' }); accountsRes.refetch(); toast('Reconnecting to Chrome…', 'info'); },
    simCdpDown: () => { patch({ cdp: 'down' }); toast('CDP link dropped (demo)', 'warning'); },
    roster, rosterEmpty: cdpUp && discovered === 0, cdpDown: !cdpUp,
    hasEnabled: enabledCount > 0, noEnabled: enabledCount === 0,
    refreshAccounts: () => { accountsRes.refetch(); toast('Refreshing accounts…', 'info'); },
    hasDailySends: sentTodayTotal > 0,
    clearDailyCap: () => {
      const had = sentTodayTotal > 0;
      patch({ sentDaily: { date: todayKey(), byEmail: {} }, sendProgress: null });
      toast(had ? "Daily send caps cleared — every account starts from 0 today" : 'No sends recorded today yet', had ? 'success' : 'info');
    },
    launching: s.launching,
    launchBrowser: () => {
      if (stateRef.current.launching) return;
      patch({ launching: true });
      toast('Launching Chrome…', 'info');
      svcLaunchBrowser()
        .then((r) => {
          patch({ launching: false, cdp: 'up' });
          accountsRes.refetch();
          toast(
            r.launched
              ? r.accounts.length
                ? 'Chrome launched — ' + r.accounts.length + ' account' + (r.accounts.length === 1 ? '' : 's') + ' found'
                : 'Chrome launched — add a Gmail account, then Refresh'
              : 'Chrome already running',
            'success',
          );
        })
        .catch((e) => { patch({ launching: false }); toast(errMsg(e, 'Could not launch Chrome'), 'danger'); });
    },
    addAccount: () => {
      addGmailAccount()
        .then(() => toast('Opened Google sign-in in Chrome — add your account, then Refresh', 'info'))
        .catch((e) => toast(errMsg(e, 'Could not open Google sign-in'), 'danger'));
    },

    exportsList,
    exportsLoading: exportsRes.loading && exportsRes.data.length === 0,
    exportsError: exportsRes.error, retryExports: exportsRes.refetch,
    exportsEmpty: !exportsRes.loading && !exportsRes.error && exportsRes.data.length === 0,

    tokenMask: s.tokenReveal ? 'ghp_9aB3xK7pQ2mL8vR4tN6yWc' : 'ghp_•••••••••••••••••••••••',
    tokenBtn: s.tokenReveal ? 'Hide' : 'Reveal', revealToken: () => update((st) => ({ tokenReveal: !st.tokenReveal })),
    setTheme,

    drawerOpen: !!dl, dLead, drawerLoading: s.drawerLoading, closeDrawer: () => patch({ drawer: null, drawerLoading: false }),
    rawOpen: s.rawOpen, toggleRaw: () => update((st) => ({ rawOpen: !st.rawOpen })),
    drawerCopy: () => toast(dl && dl.email ? 'Copied ' + dl.email : 'No email', 'success'),
    drawerAdd: () => toast('Added ' + (dl ? dl.name : '') + ' to campaign', 'success'),

    paletteOpen: s.palette, closePalette: () => patch({ palette: false }),

    confirmOpen: s.confirm, closeConfirm: () => patch({ confirm: false }),
    confirmTitle: isDraft ? 'Create drafts for ' + fmt(recip) + ' recipients?' : 'Send real email to ' + fmt(recip) + ' recipients?',
    confirmDesc: isDraft ? 'Draft mode fills each Gmail compose window — nothing is sent. You review and send manually.' : 'This delivers real email via your signed-in Gmail tabs over CDP. Recipients were sourced from GitHub by location; you are responsible for who you contact.',
    confirmIconName: isDraft ? 'mail' : 'alert', confirmTone: (isDraft ? 'accent' : 'danger') as Tone,
    confirmRecip: fmt(recip), confirmAccts: enabledCount, confirmCap: s.dailyCap, confirmModeLabel: isDraft ? 'Draft only' : 'Send for real',
    confirmBtnLabel: isDraft ? 'Create drafts' : 'Start sending',
    doSend: () => startSend(),

    ...sendVM,
    sendTitle: sd ? (sd.dry ? 'Draft run' : 'Live send') : '',
    sendStatusLabel: sd ? SEND_LABEL[sd.status] : '',
    sendActive: !!(sd && (sd.status === 'running' || sd.status === 'stopping')),
    sendTerminal: !!(sd && (sd.status === 'done' || sd.status === 'stopped' || sd.status === 'failed')),
    stopBtnLabel: sd && sd.status === 'stopping' ? 'Stopping…' : 'Stop',
    stopSend, closeSend,

    authed: s.authed, notAuthed: !s.authed,
    authUser: s.authUser, authUserName: s.authUser?.name ?? '', authUserEmail: s.authUser?.email ?? '',
    authView,
    authIsSignin: authView === 'signin', authIsSignup: authView === 'signup', authIsForgot: authView === 'forgot', authIsSent: authView === 'sent', authIsReset: authView === 'reset',
    resetEmail: s.resetEmail,
    hrefSignin: AUTH_PATH.signin, hrefSignup: AUTH_PATH.signup, hrefForgot: AUTH_PATH.forgot, hrefReset: AUTH_PATH.reset,
    goSignup: goTo(AUTH_PATH.signup),
    goSignin: goTo(AUTH_PATH.signin),
    goForgot: goTo(AUTH_PATH.forgot),
    goReset: goTo(AUTH_PATH.reset),
    submitSignin: async (email: string, password: string, remember: boolean) => {
      const session = await signIn(email, password, remember);
      patch({ authed: true, authUser: session.user, profile: loadProfile(session.user) });
      navigate(HOME_PATH);
      toast('Signed in', 'success');
    },
    submitSignup: async (name: string, email: string, password: string) => {
      const session = await signUp(name, email, password);
      patch({ authed: true, authUser: session.user, profile: loadProfile(session.user) });
      navigate(HOME_PATH);
      toast('Account created', 'success');
    },
    submitForgot: async (email: string) => {
      await requestPasswordReset(email);
      patch({ resetEmail: email });
      navigate(AUTH_PATH.sent);
    },
    submitReset: async (password: string) => {
      await completePasswordReset(s.resetEmail, password);
      navigate(AUTH_PATH.signin);
      toast('Password updated — sign in with your new password', 'success');
    },
    googleAuth: async () => {
      const session = await signInWithGoogle();
      patch({ authed: true, authUser: session.user, profile: loadProfile(session.user) });
      navigate(HOME_PATH);
      toast('Signed in with Google', 'success');
    },

    toast: toastState?.msg ?? null, toastTone, toastIconName,
  };
}

export type V = ReturnType<typeof useApp>;
