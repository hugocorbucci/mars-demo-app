# mars-demo-app

Parent repository for the **Mars Demo Shop** DigitalOcean App Platform demo (MARS acceptance scenarios).

App Platform app name: `mars-demo`  
Region: **tor** (App Platform slug; datacenter tor1)

## Clone

```bash
git clone --recurse-submodules https://github.com/hugocorbucci/mars-demo-app.git
cd mars-demo-app
# or later: make submodules
```

There is no durable checkout required under Documents — clone this parent (submodules pull ui/api/db).

## Local run (Make)

Requires **git**, **Node ≥ 20**, **npm**, **Docker**, and **make**.

```bash
make help          # target list + defaults
make submodules    # init/update components/*
make dev           # Postgres + migrate + API :8080 + UI proxy :3000
```

Open **http://127.0.0.1:3000** — the proxy serves the UI and forwards `/api` to the API (same shape as App Platform ingress).

| Target | What it does |
| --- | --- |
| `make submodules` / `make init` | Git submodules (+ `init` also npm-installs) |
| `make compose` / `compose-check` | Regenerate / verify `.do/app.yaml` |
| `make db-up` / `db-down` / `db-logs` | Docker Compose Postgres 16 |
| `make migrate` | Apply `mars-demo-db` migrations |
| `make api` | API on `:8080` |
| `make ui` | Static UI only (no `/api` proxy) |
| `make proxy` | UI + `/api` → API |
| `make dev` | One-shot: db-up → migrate → api + proxy |
| `make validate-spec` | `doctl --context demo-mars-app apps spec validate` |

### Defaults

| Var | Default |
| --- | --- |
| `DATABASE_URL` | `postgres://mars:mars@127.0.0.1:5432/mars_demo` |
| `PGSSL` | `disable` |
| `PORT` | `8080` |
| `UI_PORT` | `3000` |

Override: `make migrate DATABASE_URL=postgres://…` or export in your shell.

Postgres is defined in [`docker-compose.yml`](docker-compose.yml). The local edge is [`scripts/dev-proxy.mjs`](scripts/dev-proxy.mjs) (no extra npm deps).

## Layout

| Path | Role |
| --- | --- |
| `Makefile` | Local UX |
| `docker-compose.yml` | Local Postgres |
| `.do/base.yaml` | Parent-only bits: name, region, ingress, alerts |
| `components/mars-demo-ui` | Git submodule → UI fragment |
| `components/mars-demo-api` | Git submodule → API fragment |
| `components/mars-demo-db` | Git submodule → `databases` + migrate job |
| `scripts/compose-app-spec.mjs` | Merges base + fragments → `.do/app.yaml` |
| `.do/app.yaml` | **Generated** full App Platform spec |

### How fragments merge

1. Load `.do/base.yaml`.
2. For each submodule, load `.do/component.yaml`.
3. Append `services`, `static_sites`, `jobs`, `databases`, `workers`, `functions`.
4. Managed DB config lives in **mars-demo-db** (not parent base).

## App Platform / GitHub Actions

```bash
doctl --context demo-mars-app apps create --spec .do/app.yaml
```

| Workflow | Repo | Purpose |
| --- | --- | --- |
| `compose-app-spec` | this repo | Update submodules, compose, commit `.do/app.yaml` |
| `notify-parent-spec` | ui / api / db | Dispatch parent compose when `.do/**` changes |

Child → parent dispatch needs secret **`PARENT_DISPATCH_TOKEN`**. Without it, the parent's 30‑minute schedule still refreshes.

## Component repos

- https://github.com/hugocorbucci/mars-demo-ui
- https://github.com/hugocorbucci/mars-demo-api
- https://github.com/hugocorbucci/mars-demo-db
