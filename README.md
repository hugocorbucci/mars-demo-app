# mars-demo-app

Parent repository for the **Mars Demo Shop** DigitalOcean App Platform demo (MARS acceptance scenarios).

App Platform app name: `mars-demo`  
Region: **tor** (App Platform slug; datacenter tor1)

## Layout

| Path | Role |
| --- | --- |
| `.do/base.yaml` | Parent-only bits: name, region, ingress, alerts |
| `components/mars-demo-ui` | Git submodule → UI fragment `.do/component.yaml` |
| `components/mars-demo-api` | Git submodule → API service fragment |
| `components/mars-demo-db` | Git submodule → `databases` + PRE_DEPLOY migrate job |
| `scripts/compose-app-spec.mjs` | Merges base + fragments → `.do/app.yaml` |
| `.do/app.yaml` | **Generated** full App Platform spec (commit after compose) |

## Compose locally

```bash
git submodule update --init --recursive
npm ci
npm run compose          # write .do/app.yaml
npm run compose:check    # fail if stale
doctl --context demo-mars-app apps spec validate .do/app.yaml
doctl --context demo-mars-app apps create --spec .do/app.yaml
```

### How fragments merge

1. Load `.do/base.yaml` as the root document.
2. For each submodule in `components/{mars-demo-ui,mars-demo-api,mars-demo-db}`, load `.do/component.yaml`.
3. Append array keys `services`, `static_sites`, `jobs`, `databases`, `workers`, `functions` from each fragment.
4. Fragments may not set parent-owned keys (`name`, `region`, `ingress`, …). Managed DB config lives in **mars-demo-db**.

## GitHub Actions

| Workflow | Repo | Purpose |
| --- | --- | --- |
| `compose-app-spec` | this repo | Update submodules to latest `main`, run compose, commit `.do/app.yaml` |
| `notify-parent-spec` | ui / api / db | On `.do/**` changes, `workflow_dispatch` the parent compose workflow |

Child → parent dispatch needs repo secret **`PARENT_DISPATCH_TOKEN`** (PAT with `repo` + `workflow` on `mars-demo-app`). Without it, the parent's 30‑minute schedule still refreshes submodules.

## Component repos

- https://github.com/hugocorbucci/mars-demo-ui
- https://github.com/hugocorbucci/mars-demo-api
- https://github.com/hugocorbucci/mars-demo-db
