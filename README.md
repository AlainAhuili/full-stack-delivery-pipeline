# Full-Stack CRUD Application & CD Pipeline

A three-tier CRUD application with a deployment pipeline modelled on Dave Farley's Continuous
Delivery: every commit produces one release candidate (a set of Docker images tagged with the
commit SHA) that is tested once, then promoted unchanged.

---

## Architecture

```text
Browser ──▶ frontend (nginx, :8080) ──/api/──▶ backend (Node.js, :3000) ──▶ database (PostgreSQL)
             static UI + reverse proxy           REST API                    versioned migrations
```

- **Frontend:** a static single-page UI served by nginx. nginx also forwards `/api/` to the
  backend, so the browser talks to a single origin and the UI never hard-codes a backend address.
- **Backend:** a stateless REST API with no framework dependencies. Business rules live in plain
  modules (`items.js`, `auth.js`) that are unit-tested without HTTP or a database.
- **Database:** PostgreSQL with SQL migrations applied in file-name order.

> **Current state:** items are kept in the backend's memory, and registration and login only
> validate the payload and return a placeholder token. `userRepository.js` and the `users` table
> (migrations 001–003) are the next step towards persistence. Until then, the database tier is
> started and health-checked but not yet used by the API.

---

## Project structure

```text
├── .github/workflows/
│   └── commit-stage.yml        # CI: commit stage, then acceptance stage
├── backend/
│   ├── src/
│   │   ├── index.js            # process entry point (listens on PORT, default 3000)
│   │   ├── app.js              # HTTP routes
│   │   ├── items.js            # item validation + in-memory store
│   │   ├── auth.js             # credential validation, token
│   │   ├── errors.js
│   │   └── userRepository.js   # PostgreSQL access for users (not wired in yet)
│   ├── tests/
│   │   ├── unit/               # pure logic, no I/O
│   │   └── component/          # the real HTTP app on a random port
│   ├── Dockerfile
│   └── package.json
├── database/
│   ├── migrations/
│   │   ├── 001_init.sql
│   │   ├── 002_expand_user_table.sql
│   │   └── 003_add_password_hash.sql
│   └── Dockerfile
├── frontend/
│   ├── src/                    # index.html, app.js (API client), index.js (UI)
│   ├── nginx/default.conf.template
│   ├── tests/unit/             # API client with fetch and localStorage faked
│   ├── Dockerfile
│   └── package.json
├── tests/acceptance/           # end-to-end tests against the running containers
├── scripts/check-syntax.js     # syntax gate used by `lint`
├── docker-compose.yml          # local development
├── docker-compose.acceptance.yml
├── docker-compose.production.yml
├── .env.example                # secrets template for production
└── Makefile                    # every pipeline step, used locally and by CI
```

Tests use Node's built-in test runner (`node --test`), so there are no test dependencies to
install. Node.js 22 or newer is required.

---

## The Continuous Delivery pipeline

### Core axioms

1. **Build only once.** Images are built only in the commit stage. Later stages run those exact
   images; nothing is rebuilt from source.
2. **Stop the line.** If any stage fails, the build is broken, and fixing it comes first.
3. **Environment parity.** The same images run in acceptance and production; only configuration
   (environment variables) differs.

### Stages

| Stage | Command | What it does |
| :--- | :--- | :--- |
| **1. Commit** | `make commit-stage` | Syntax check, unit tests (frontend and backend), backend component tests, then builds `crud-frontend`, `crud-backend` and `crud-database` tagged with the short commit SHA. |
| **2. Acceptance** | `make acceptance` | Starts a throwaway environment from those images (fresh database, migrations applied), runs `tests/acceptance` through the frontend proxy (register, log in, create, list and delete), then removes the environment. |
| **3. Production** | `make prod-up` | Runs the accepted images with secrets from `.env`. Only the UI (port 9000) is published. |

GitHub Actions (`.github/workflows/commit-stage.yml`) runs stages 1 and 2 on every push and pull
request to `main`. Images stay on the CI runner; publishing them to a registry (for example
Docker Hub) is the next step for a real deployment.

---

## Database migration strategy

Schema changes must never break a version of the application that is still running. All changes
therefore follow the **expand and contract** pattern:

| Phase | Database | Application |
| :--- | :--- | :--- |
| **1. Expand** | Add new columns, tables or constraints; keep the old ones. | The current version keeps working and ignores the additions. |
| **2. Deploy** | Supports both the old and the new shape. | Deploy the backend version that uses the new structures. |
| **3. Contract** | In a separate, later migration, drop the old columns or tables. | The new version is stable; old structures are removed. |

> **Rule:** never ship a breaking schema change and the backend change that depends on it in the
> same deployment. Split them into separate, backward-compatible steps.

Migrations run through PostgreSQL's `docker-entrypoint-initdb.d`, so they are applied when a
database volume is created for the first time. An existing volume (such as production's
`prod_db_data`) does not pick up new migration files; that needs a migration tool.

---

## Local development

### Prerequisites

- Docker with Docker Compose v2
- Node.js 22+
- `make` (on Windows: Git Bash or WSL; or run the commands from the Makefile by hand)

### Commands

```bash
make install         # npm ci in backend/ and frontend/
make lint            # syntax check of all JavaScript
make test-unit       # fast unit tests
make test-component  # backend HTTP tests, no Docker needed
make pipeline        # commit stage + acceptance stage, as in CI

make dev-up          # build images and start the dev stack: http://localhost:8080
make dev-down
```

### Production (local)

```bash
cp .env.example .env   # then set real passwords and a long random JWT_SECRET
make prod-up           # http://localhost:9000
make prod-status
make prod-down         # keeps the database volume
```
