# mars-demo-app

Main App Platform repo for Hugo Corbucci’s **MARS acceptance demo** app.

This repository owns the **app specification** and the wiring between components. Application code lives in sibling repos under `hugocorbucci`.

## Layout

| Piece | Repo | App Platform role |
| --- | --- | --- |
| App spec + ingress | **this repo** (`mars-demo-app`) | Source of truth for `doctl apps create/update` |
| Static UI | [`mars-demo-ui`](https://github.com/hugocorbucci/mars-demo-ui) | `static_sites.web` |
| API | [`mars-demo-api`](https://github.com/hugocorbucci/mars-demo-api) | `services.api` |
| Schema / migrations | [`mars-demo-db`](https://github.com/hugocorbucci/mars-demo-db) | `jobs.db-migrate` (`PRE_DEPLOY`) + managed DB `databases.db` |

## App spec

- Path: [`.do/app.yaml`](.do/app.yaml)
- App name: `mars-demo`
- Region: `nyc`
- Ingress: `/api` → API service, `/` → static UI
- Managed DB: PostgreSQL 16 (dev database component named `db`)
- Bindable env: API and migrate job receive `${db.DATABASE_URL}`

## Deploy

Prerequisites: DigitalOcean account, `doctl` authenticated, GitHub linked to App Platform, and the four `hugocorbucci/mars-demo-*` repos public (or DO GitHub app installed with access).

```bash
doctl apps create --spec .do/app.yaml
# later updates:
doctl apps update <app-id> --spec .do/app.yaml
```

Auto-deploy is enabled per component (`deploy_on_push: true`) so pushes to each component’s `main` trigger rebuilds.

## Demo failure scenarios (hooks for MARS)

Aligned with the Slack brief in `#tmp-insightsv2-aidc-mars-demo-hackathon`:

1. **Bad deployment / crash after usage** — set `DEMO_CRASH_AFTER_REQUESTS` on the API component (e.g. `5`) so the process exits after N successful requests.
2. **Latent DB bug** — migrations intentionally omit an index on a hot lookup column (`orders.customer_email`); the UI “Slow lookup” action exercises it.
3. **Traffic stress** — UI “Load test” button hammers `/api/orders`; MARS can propose scaling / limits.

## Why multi-repo?

Mirrors a common customer pattern: product UI, API, and DB ownership are separate, while one app-spec repo describes how App Platform assembles them.
