# Mars Demo Shop — local Make UX (parent repo + git submodules).
# Requires: git, node >= 20, npm, docker (for Postgres), make.

SHELL := /bin/bash
.DEFAULT_GOAL := help

ROOT        := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
UI          := $(ROOT)/components/mars-demo-ui
API         := $(ROOT)/components/mars-demo-api
DB          := $(ROOT)/components/mars-demo-db

# Local defaults (match docker-compose.yml + App Platform ports).
export DATABASE_URL ?= postgres://mars:mars@127.0.0.1:5432/mars_demo
export PGSSL        ?= disable
export PORT         ?= 8080
export UI_PORT      ?= 3000
export API_URL      ?= http://127.0.0.1:$(PORT)

COMPOSE := docker compose -f $(ROOT)/docker-compose.yml

.PHONY: help submodules init compose compose-check \
	install db-up db-down db-logs migrate seed \
	stress-lookup stress-api \
	api ui proxy dev stop \
	validate-spec clean

help: ## Show targets
	@awk 'BEGIN {FS = ":.*##"; printf "Mars Demo Shop — make targets\n\n"} \
		/^[a-zA-Z0-9_.-]+:.*##/ { printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2 }' $(MAKEFILE_LIST)
	@echo
	@echo "Defaults: DATABASE_URL=$(DATABASE_URL)"
	@echo "          PORT=$(PORT)  UI_PORT=$(UI_PORT)  PGSSL=$(PGSSL)"
	@echo
	@echo "Quick start:  make submodules && make dev"
	@echo "Then open:    http://127.0.0.1:$(UI_PORT)"

submodules: ## Init/update git submodules (ui, api, db)
	git -C $(ROOT) submodule sync --recursive
	git -C $(ROOT) submodule update --init --recursive

init: submodules install ## submodules + npm install everywhere
	@echo "init complete"

install: ## npm install in parent + component submodules
	cd $(ROOT) && npm ci
	cd $(API) && npm install
	cd $(DB) && npm install

compose: ## Regenerate .do/app.yaml from base + fragments
	cd $(ROOT) && npm ci --ignore-scripts 2>/dev/null || npm install
	cd $(ROOT) && npm run compose

compose-check: ## Fail if .do/app.yaml is stale
	cd $(ROOT) && npm run compose:check

db-up: ## Start local Postgres 16 (Docker Compose)
	$(COMPOSE) up -d db
	@echo "Waiting for Postgres…"
	@for i in $$(seq 1 30); do \
		$(COMPOSE) exec -T db pg_isready -U mars -d mars_demo >/dev/null 2>&1 && break; \
		sleep 1; \
	done
	@$(COMPOSE) exec -T db pg_isready -U mars -d mars_demo
	@echo "Postgres ready → $(DATABASE_URL)"

db-down: ## Stop local Postgres (keep volume)
	$(COMPOSE) down

db-logs: ## Tail Postgres logs
	$(COMPOSE) logs -f db

migrate: ## Apply mars-demo-db migrations (needs db-up / DATABASE_URL)
	cd $(DB) && npm install --silent
	cd $(DB) && DATABASE_URL="$(DATABASE_URL)" PGSSL="$(PGSSL)" npm run migrate

seed: ## Seed ~80k sample orders (local DB)
	cd $(DB) && npm install --silent
	cd $(DB) && DATABASE_URL="$(DATABASE_URL)" PGSSL="$(PGSSL)" COUNT="$${COUNT:-80000}" npm run seed

stress-lookup: ## Concurrent by-email lookups (API_URL=… N=40)
	node $(ROOT)/scripts/stress-lookup.mjs

stress-api: ## Concurrent order creates (API_URL=… N=40)
	node $(ROOT)/scripts/stress-api.mjs

api: ## Run API on :$(PORT) (foreground)
	cd $(API) && npm install --silent
	cd $(API) && DATABASE_URL="$(DATABASE_URL)" PGSSL="$(PGSSL)" PORT="$(PORT)" npm start

ui: ## Serve UI static files only on :$(UI_PORT) (no /api proxy)
	@command -v npx >/dev/null
	cd $(UI)/public && npx --yes serve -l $(UI_PORT)

proxy: ## UI static + /api → API (http://127.0.0.1:$(UI_PORT))
	node $(ROOT)/scripts/dev-proxy.mjs

dev: db-up migrate ## One-shot local stack: Postgres + migrate + API + UI proxy
	@echo "Starting API (:$(PORT)) and UI proxy (:$(UI_PORT))…"
	@echo "Open http://127.0.0.1:$(UI_PORT)  (Ctrl-C stops both)"
	@trap 'kill 0' EXIT INT TERM; \
		( cd $(API) && npm install --silent && DATABASE_URL="$(DATABASE_URL)" PGSSL="$(PGSSL)" PORT="$(PORT)" npm start ) & \
		( sleep 1 && node $(ROOT)/scripts/dev-proxy.mjs ) & \
		wait

stop: db-down ## Stop Docker Postgres
	@echo "Stopped compose stack (API/proxy: Ctrl-C if still running in another terminal)"

validate-spec: compose ## Validate composed App Platform spec (doctl demo-mars-app)
	doctl --context demo-mars-app apps spec validate $(ROOT)/.do/app.yaml --schema-only

clean: ## Remove node_modules in parent + components
	rm -rf $(ROOT)/node_modules $(API)/node_modules $(DB)/node_modules
