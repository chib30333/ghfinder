# ghfinder — React + Vite + TypeScript

A desktop-class dashboard for sourcing developers on GitHub by location, enriching
their contacts, and running personalized multi-account Gmail outreach. This is the
React/TypeScript port of the ghfinder design.

## Stack

- **React 18** + **TypeScript**
- **Vite 5** (dev server + build)
- **Tailwind CSS 3** with design tokens wired to CSS custom properties, so runtime
  theme switching stays a one-attribute swap. `cn()` (clsx + tailwind-merge)
  composes conditional classes.
- Icons are inline SVG (`<Icon name size />`); no icon dependency.

## Getting started

```bash
npm install
npm run dev      # start the dev server (http://localhost:5173)
npm run build    # type-check (tsc --noEmit) + production build to dist/
npm run preview  # preview the production build
```

You land on the **sign-in** screen — any valid-looking credentials (or "Continue
with Google") sign you in; the forms are mocks, there is no backend.

## Project structure

Organized after the team guidelines (see `../guidelines/`), adapted from their
Next.js framing to this React + Vite app: every file lives in one bucket picked by
what it renders or does.

```
src/
  main.tsx                 App entry
  App.tsx                  Auth gate: <Shell> when signed in, else <AuthView>
  index.css                Tailwind directives + design tokens (dark/light) + responsive chrome
  lib/                     Pure helpers — cn, format, avatar, tone maps, validators, icons
  types/                   Canonical domain types, split by concept (lead, account, campaign…)
  services/                Data access returning domain types (seed stands in for the API)
  hooks/                   useApp (state + view-model), useTheme, useToast
  components/
    ui/                    Domain-agnostic primitives (Button, Input, Badge, Modal, StateCard…)
    layout/                App chrome — Shell, Sidebar, TopBar, CommandPalette, Toast
  features/<domain>/
    views/                 Page-level compositions (one per screen)
    components/            Feature-specific widgets (LeadDrawer, SendMonitor, auth forms…)
```

`features/` domains: `dashboard, discovery, leads, campaigns, accounts, exports,
settings, auth`.

## Architecture notes

- **Primitives, not inline markup.** Every button/input/badge/table cell goes
  through `components/ui`. Each primitive bakes its identity and exposes varying
  axes (size, variant, tone) as replacing props — add a visual state as a new
  `variant`, never a forked component (guidelines 02 & 07).
- **Semantic color via `tone`.** Components take a `Tone`
  (`accent | success | warning | danger | info | neutral`); the `lib/tone` maps
  resolve it to Tailwind token classes. No component hand-picks `bg-…/text-…`
  colors, and no arbitrary hex ever lands in a class.
- **Theming** is CSS custom properties on a `[data-theme]` wrapper. Tailwind color
  utilities (`bg-surface`, `text-accent`, …) resolve to `var(--token)`, so the
  toggle flips one attribute and the whole tree re-themes. Light + dark both defined.
- **Data through services.** Views/hooks never touch the seed arrays directly; they
  call `searchLeads()`, `listAccounts()`, etc. from `services/`, which return domain
  types — the seam where a real API drops in (guideline 03).
- **`useApp()`** holds all state and returns a flat, fully-typed view-model `V`
  (`type V = ReturnType<typeof useApp>`) consumed via a `v` prop. It composes the
  smaller `useTheme` / `useToast` hooks and reads from the services.
- **Forms** own their field state with a colocated pure `validate()` and render
  errors through the shared `<FieldError>` (guideline 05). See `features/auth`.
- **States.** Loading / error / empty use the shared `<StateCard>` (guideline 06).
- **One table, many features.** Every tabular surface — Leads, Exports, Discovery
  cities, and the Accounts sender roster — renders through the single
  `<DataTable>` primitive (`components/ui/data-table.tsx`). Features are opt-in
  props, never forked tables: column defs (`header` / `cell` / `align` / `width`
  / `sortable`), sorting (controlled via `sort`/`onSortChange`, e.g. Leads'
  server-driven sort, or internal via `sortValue`), row selection + select-all,
  a global filter box, page-based pagination, sticky header, horizontal/vertical
  scroll, integrated loading/error/empty StateCards, and a `footer` slot (Leads'
  load-more). Rows are the existing view-model objects — the `Column` cell
  renderer reads their computed fields directly.
- **Send simulation** — the Live Send Monitor is driven by a `setInterval` in
  `useApp` that emits SSE-style log lines, round-robins across enabled Gmail
  accounts, respects per-account caps, and supports stop / stopping / done. Swap
  `startSend`/`tick` for a real `fetch` + `EventSource`.

## Wiring a real backend

The seed in `services/seed.ts` stands in for the API. Repoint the service functions:

- `listAccounts()` → `GET /api/accounts` (+ CDP status).
- `searchLeads()` / `leadsWithEmail()` → `GET /api/leads`.
- `recipientCount()` in `useApp` → `GET /api/campaigns/recipients`.
- `startSend()` → `POST /api/campaigns/send/start`, then replace the interval with
  an `EventSource` on `GET /api/campaigns/send/stream`, pushing each `line` into
  `send.logs`.

Because every read is already funneled through `services/`, the UI does not change.

## Responsiveness & accessibility

Desktop-first (≥1280px). Below 820px the sidebar becomes an off-canvas drawer
(hamburger in the top bar), grids stack, and tables scroll horizontally. WCAG-AA
token contrast in both themes, visible focus rings, keyboard command palette
(⌘K / Ctrl-K), and ARIA labels on icon-only controls and the live log stream.
