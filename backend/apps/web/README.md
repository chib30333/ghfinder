# @ghfinder/web (scaffold)

The React + Vite dashboard. This folder is a placeholder for the frontend you are
about to build — see `design-prompt.md` at the repo root for the full design
brief and color tokens.

## Recommended stack
- **React + Vite + TypeScript**
- **Tailwind + shadcn/ui + lucide-react + Recharts**
- **TanStack Query** (data), **TanStack Table** (the dense Leads grid), a router

## Getting started
```bash
# from this folder
npm create vite@latest . -- --template react-ts
npm i
# then add Tailwind + shadcn/ui and wire src/styles/tokens.css to the design tokens
```

Vite dev server should proxy `/api` to the local `@ghfinder/server`. Drop the
color tokens from `design-prompt.md` into `src/styles/tokens.css`.

## Planned layout
```
src/
  main.tsx · app.tsx           # router + layout shell (sidebar / top bar)
  routes/                      # one folder per screen:
    dashboard/ discovery/ leads/ campaigns/ accounts/ exports/ settings/
  components/ · components/ui/  # shared widgets + shadcn primitives
  lib/  api.ts · sse.ts · query.ts · theme.ts
  hooks/ · types.ts            # DTOs mirroring @ghfinder/core
  styles/tokens.css            # the CSS variables from design-prompt.md
```
