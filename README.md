# Engineering Manager OS

Personal productivity platform for engineering managers — delivery visibility, GitLab integration, governance, and AI-assisted decision making.

## Phase 1 (Complete)

- Next.js 16 + React 19 + TypeScript + Tailwind CSS + shadcn/ui
- Feature-based architecture with service layer and domain types
- PostgreSQL schema (Prisma) for teams, projects, workflows, work items, governance
- Full dashboard with team status, blockers, sprint/release health, QA, workload
- App shell with sidebar navigation, dark/light theme, and placeholder routes
- Demo data fallback when database is unavailable

## Quick Start

### Prerequisites

- Node.js 20.19+ recommended (works on 20.11 with Prisma 6)
- Docker (app, worker, Redis)
- PostgreSQL on the host (`localhost:5432`) — create a database named `emos`

### Docker (recommended)

Runs the Next.js app + worker in containers; Redis in Docker; **Postgres on your host**.

```bash
# Configure environment (use localhost in DATABASE_URL — Compose rewrites it for containers)
cp .env.example .env
# Edit DATABASE_URL to match your local Postgres user/password/db

# Build and start app, worker, and Redis
docker compose up -d --build

# Optional: seed data (uses host Postgres via your .env)
npm install
npm run db:seed
```

Open [http://localhost:3000](http://localhost:3000)

Containers reach host Postgres via `host.docker.internal`. Ensure Postgres accepts connections on `127.0.0.1:5432` (default on macOS Homebrew / Docker Desktop).

```bash
# Logs / stop
docker compose logs -f app
docker compose down
```

### Local Node setup

```bash
# Install dependencies
npm install

# Start Redis only
docker compose up -d redis

# Configure environment
cp .env.example .env

# Generate Prisma client and sync schema to host Postgres
npm run db:generate
npm run db:push
npm run db:seed

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Without Database

The dashboard works out of the box with demo data if PostgreSQL is not running.

## Architecture

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for design decisions and folder structure.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed team, projects, workflows |
| `npm run test` | Run unit tests |

## Roadmap

| Phase | Scope |
|-------|-------|
| **1** | Setup, architecture, database, dashboard, navigation, theme |
| **2** | GitLab API + Chrome extension sync engine |
| **3** | Issue dashboard, merge requests, labels, comments |
| **4** | AI assistant, priority engine, follow-ups, release notes, timesheets |
| **5** | Governance scores, reports, analytics, notifications |
| **6** | Performance, caching, testing, deployment |

## Team (Seeded)

**Developers:** Saravana Kumar, Manikandan Prabhu, Gowtham Raj, Ramanathan, Jawahar

**QA:** Preethi, Ruthrakanth, Kadar Selvam

**Projects:** Release Observations, Admin (each with configurable workflow columns)
