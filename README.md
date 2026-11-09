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

### Number Quest (math puzzle game)

The **🧩 Math puzzle** button in the control panel opens the game. All game logic is in the
backend (`backend/src/puzzle.js`); the browser only shows the question and sends the guess.

- **Puzzle kinds:** missing number (`7 × ? = 42`), sequences (`3, 6, 12, 24, ?`, constant step
  or constant factor) and order of operations (`4 + 3 × 5 = ?`).
- **Levels:** easy (numbers up to 10, no order-of-operations puzzles), medium (up to 20) and
  hard (up to 50).
- **Rules:** each puzzle can be answered once; the reply says whether the answer was right and
  shows the solution with an explanation. Open puzzles expire after 10 minutes, and at most 1000
  are kept, so memory stays bounded.
- **Score:** the panel counts correct answers and the current streak.

| Endpoint | Body | Response |
| :--- | :--- | :--- |
| `POST /api/puzzles` | `{ "difficulty": "easy" \| "medium" \| "hard" }` (default `easy`) | `201 { id, kind, difficulty, question }`; the answer is not included |
| `POST /api/puzzles/:id/answer` | `{ "answer": <whole number> }` | `200 { correct, solution, explanation }`; `404` once answered or expired; `400` for a non-integer |

> **Current state:** items are kept in the backend's memory, and registration and login only
> validate the payload and return a placeholder token. `userRepository.js` and the `users` table
> (migrations 001–003) are the next step towards persistence. Until then, the database tier is
> started and health-checked but not yet used by the API.

---

## Project structure

```text
├── .github/workflows/
│   └── commit-stage.yml        # CI: commit, acceptance, then production stage
├── infra/
│   ├── terraform/              # Google Cloud production (Cloud Run, registry, CI identity)
│   └── first-deploy.sh         # one-time creation of production
├── backend/
│   ├── src/
│   │   ├── index.js            # process entry point (listens on PORT, default 3000)
│   │   ├── app.js              # HTTP routes
│   │   ├── items.js            # item validation + in-memory store
│   │   ├── auth.js             # credential validation, token
│   │   ├── puzzle.js           # Number Quest: puzzle generation and answer checking
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
| **3. Production** | CI, on `main` | Pushes the accepted images to Artifact Registry, rolls them out to Cloud Run and smoke-tests the live URL. See [Production on Google Cloud](#production-on-google-cloud). |

GitHub Actions (`.github/workflows/commit-stage.yml`) runs stages 1 and 2 on every push and pull
request to `main`, and stage 3 on pushes to `main` only. The production stage receives the
images built in stage 1 as a build artifact, so nothing is rebuilt between acceptance and
production. `make prod-up` still runs the same images locally (port 9000) with secrets from `.env`.

---

## Production on Google Cloud

The infrastructure is code in `infra/terraform/`, with its state in a versioned GCS bucket.

```text
Internet ──HTTPS──▶ Cloud Run service "crud-production" (europe-west3, project full-stack-delivery-380414)
                     ├── frontend  nginx :8080, the only container that receives traffic
                     └── backend   Node.js :3000 on localhost, reached through /api/
```

| File | Defines |
| :--- | :--- |
| `main.tf` | APIs, Artifact Registry repository `crud` (keeps the last 20 images, deletes after 30 days), runtime service account without project roles, the Cloud Run service, public access |
| `github.tf` | Workload Identity pool and provider for GitHub Actions, the `github-deployer` service account and its three permissions |
| `variables.tf`, `production.tfvars` | Project, region, service name, instance limit, GitHub repository and OIDC subject |
| `outputs.tf` | Public URL, registry path, the values stored in the GitHub `production` environment |

**Who can deploy.** Only jobs of this repository that run in the GitHub environment
`production` can act as `github-deployer`, and that environment only accepts the `main` branch.
No service account key exists. The deployer can push to the `crud` repository, roll out
revisions of this one service and run them as the runtime account; it cannot change IAM.

**Terraform and CI split.** Terraform owns the service's shape: containers, ports, probes,
scaling and access. CI only rolls out new images, and Terraform ignores image changes, so the
two do not fight.

**Limits.** At most one instance runs, because items are held in the backend's memory. There is
no database in production yet; add Cloud SQL here when the API starts using PostgreSQL.

### First deploy (once)

The project and state bucket already exist. Then, from the repository root in Git Bash:

```bash
bash infra/first-deploy.sh
```

It creates the registry, builds and pushes the current commit's images, then applies everything
else and prints the URL. Each `terraform apply` shows its plan and asks for `yes`. Afterwards,
every push to `main` deploys automatically.

### Changing the infrastructure

```bash
cd infra/terraform
export GOOGLE_OAUTH_ACCESS_TOKEN=$(gcloud auth print-access-token)
terraform init -backend-config="bucket=full-stack-delivery-380414-tfstate"
terraform plan -var-file=production.tfvars -var image_tag=$(git rev-parse --short HEAD)
```

`image_tag` only matters when the service is first created.

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
