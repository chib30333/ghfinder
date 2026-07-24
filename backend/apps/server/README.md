# @ghfinder/server

Local HTTP API (REST + SSE) that exposes the `@ghfinder/core` engine to the web
UI. Fastify, bound to `127.0.0.1`.

## Why local-only
The engine needs the local machine: it drives Chrome over CDP for sending, owns
the local SQLite file, and holds the `GITHUB_TOKEN`. **Never expose this to the
internet.** Host/port default to `127.0.0.1:8787` (override with
`GHFINDER_API_HOST` / `GHFINDER_API_PORT`).

## Run
```bash
npm run server        # from the repo root  →  http://127.0.0.1:8787
```

## Endpoints

| Method & path | Purpose | Engine |
| --- | --- | --- |
| `GET /api/health` | liveness + resolved repo root | — |
| `GET /api/stats` | dashboard KPIs (cities/segments/users, email & social coverage) | `dashboardStats()` |
| `GET /api/leads` | filtered, sorted, paginated users | `listUsers()` |
| `GET /api/leads/:login` | one full profile (raw JSON parsed) | `getUserByLogin()` |
| `GET /api/cities` | city work-list + per-city lead counts | `listCities()` |
| `POST /api/cities/load` | load `us_cities.csv` into the queue `{queryMode}` | `loadCities()` |
| `GET /api/discovery/status` | crawl job state | jobs |
| `POST /api/discovery/start` | start a crawl `{limit?, maxProfiles?}` | CLI `run` (child) |
| `POST /api/discovery/stop` | stop the crawl | jobs |
| `GET /api/discovery/stream` | **SSE** live crawler log | jobs |
| `GET /api/campaigns/template` · `PUT` | read / save the `{{firstName}}` template | `loadTemplate` / `saveTemplate` |
| `GET /api/campaigns/recipients` | unique deduped recipient count | `usersWithEmail()` |
| `POST /api/campaigns/batches` | build GES `batch_*.json` `{size?}` | `buildBatches()` |
| `GET /api/campaigns/send/status` | send job state | jobs |
| `POST /api/campaigns/send/start` | start a send `{dryRun,all,count,index,perAccount,accounts}` | `apps/sender` (child) |
| `POST /api/campaigns/send/stop` | stop the send | jobs |
| `GET /api/campaigns/send/stream` | **SSE** live sender output | jobs |
| `GET /api/accounts` | signed-in Gmail `/u/N/` + CDP status | Chrome `:9222` |
| `GET /api/exports` | list `users_*.txt`, `link.csv`, GES batches | fs |
| `GET /api/exports/download` | download one artifact `{kind,name}` | fs |

### Query params — `GET /api/leads`
`search`, `hasEmail`, `hasSocial`, `hireable`, `emailSource` (readme/profile/commits),
`city`, `sort` (fetched_at·followers·public_repos·created_at·login·name),
`order` (asc/desc), `limit` (≤200), `offset`.

## Design notes
- **Long jobs run as child processes.** A crawl spawns the CLI's `run` command;
  a send spawns `apps/sender/src/index.mjs`. This reuses the tested, checkpointing code
  paths, isolates them from the API process, and makes "stop" a kill. Their
  stdout/stderr is line-buffered and fanned out over SSE.
- **Stop is best-effort on Windows.** The crawler checkpoints every page to
  SQLite, so a killed run just repeats the in-flight page on resume.
- **Concurrent DB access** is safe: WAL + `busy_timeout` let the API read while a
  crawl child writes.
- **SSE** is written to the raw socket with its own CORS header (hijacked replies
  bypass `@fastify/cors`), plus a 15s heartbeat.

## Layout
```
src/
  index.mjs        Fastify bootstrap + route registration
  sse.mjs          SSE helpers (startSSE, streamJob)
  jobs.mjs         child-process job registry (discovery, campaign)
  cdp.mjs          Gmail account discovery via Chrome :9222
  routes/          stats · leads · cities · discovery · campaigns · accounts · exports
```
