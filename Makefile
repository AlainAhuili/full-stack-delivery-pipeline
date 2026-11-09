.PHONY: install lint test-unit test-component commit-stage package acceptance pipeline \
        clean dev-up dev-down prod-up prod-status prod-down

# Release candidate tag: the short commit SHA, or "local" outside a git checkout.
GIT_SHA ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo local)
export GIT_SHA

ACCEPTANCE = docker compose -f docker-compose.acceptance.yml
PRODUCTION = docker compose -f docker-compose.production.yml

install:
	cd backend && npm ci
	cd frontend && npm ci

# ---- 1. Commit stage: fast checks, then build the images exactly once ------------------
lint:
	cd backend && npm run lint
	cd frontend && npm run lint
	node scripts/check-syntax.js tests

test-unit:
	cd backend && npm run test:unit
	cd frontend && npm run test:unit

test-component:
	cd backend && npm run test:component

package:
	@echo "Building release candidate images tagged $(GIT_SHA)"
	docker build -t crud-frontend:$(GIT_SHA) ./frontend
	docker build -t crud-backend:$(GIT_SHA) ./backend
	docker build -t crud-database:$(GIT_SHA) ./database

commit-stage: lint test-unit test-component package
	@echo "Commit stage passed: release candidate $(GIT_SHA)"

# ---- 2. Acceptance stage: the same images in a throwaway environment -------------------
acceptance:
	@echo "Starting acceptance environment for $(GIT_SHA)"
	$(ACCEPTANCE) up -d --wait
	node --test "tests/acceptance/**/*.test.js" || ($(MAKE) clean && exit 1)
	$(MAKE) clean

clean:
	$(ACCEPTANCE) down -v --remove-orphans

pipeline:
	$(MAKE) commit-stage
	$(MAKE) acceptance

# ---- Local development -----------------------------------------------------------------
dev-up: package
	docker compose up -d --wait

dev-down:
	docker compose down

# ---- 3. Production (local): needs a .env file, see .env.example ------------------------
prod-up:
	$(PRODUCTION) up -d --wait

prod-status:
	$(PRODUCTION) ps

# Keeps the database volume, so records survive.
prod-down:
	$(PRODUCTION) down
