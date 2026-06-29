# Architecture — Engineering Manager OS

## Design Principles

EMOS follows **Clean Architecture** with a **feature-based folder structure**. Each module (Dashboard, GitLab, Governance, etc.) can evolve independently without coupling to unrelated features.

```
┌─────────────────────────────────────────────────────────────┐
│                      Presentation Layer                      │
│  Next.js App Router · React Components · React Query        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                      Application Layer                       │
│  Route Handlers · Server Services · Background Workers       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                       Domain Layer                           │
│  Types · Business Rules · Domain Models                      │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                    Infrastructure Layer                        │
│  Prisma · GitLab Providers · Redis/BullMQ · OpenAI           │
└─────────────────────────────────────────────────────────────┘
```

## Folder Structure

```
src/
├── app/                    # Next.js routes and API handlers
│   ├── api/                # REST endpoints
│   └── (feature pages)/    # Page routes per module
├── components/
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # App shell, sidebar, header
│   └── providers/          # Theme, React Query
├── domain/
│   └── types/              # Shared domain types (no framework deps)
├── features/
│   └── dashboard/          # Feature-scoped UI components
├── lib/                    # Cross-cutting utilities
├── server/
│   ├── repositories/       # Data access (Phase 2+)
│   └── services/           # Business logic orchestration
└── stores/                 # Zustand client state (Phase 2+)
```

## Key Decisions

### 1. Configurable Workflows (Not Hardcoded)

GitLab projects have their own `ProjectWorkflow` with ordered `WorkflowColumn` records. Release Observations uses a 6-column board (Backlog → Done); Admin uses a different set (Triage → Released). No workflow state is hardcoded in application logic.

### 2. GitLab Provider Abstraction (Phase 2)

A `GitLabProvider` interface will support:

- **GitLab API** — primary sync path
- **DOM Extraction** — Chrome extension fallback

Both write to the same `WorkItem` model with a `syncSource` field.

### 3. Demo Data Fallback

`DashboardService` checks database connectivity and falls back to realistic demo data. This allows the UI to be developed and demonstrated without infrastructure.

### 4. Single-User, No Auth (Phase 1)

Authentication is deferred. The app is designed for a single engineering manager with no multi-tenancy overhead.

### 5. Service Layer Pattern

Business logic lives in `server/services/`, not in React components or route handlers. Example:

```
Route Handler → DashboardService.getMetrics() → Prisma / Demo Data
```

### 6. Background Workers (Phase 2+)

BullMQ workers will run independently for:

- GitLab sync
- Governance scoring
- Timesheet generation
- Daily/weekly summaries

Each worker publishes events that other modules can subscribe to.

## Database Model (Phase 1)

| Model | Purpose |
|-------|---------|
| `Team` / `TeamMember` | Configurable team roster |
| `GitLabProject` | Project registry |
| `ProjectWorkflow` / `WorkflowColumn` | Per-project board configuration |
| `Sprint` / `Release` | Delivery containers |
| `WorkItem` | Unified issues and merge requests |
| `GovernanceRule` | Configurable governance rules |
| `SyncRun` | Sync job audit trail |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| State | TanStack Query (server), Zustand (client, Phase 2+) |
| Backend | Next.js Route Handlers, Prisma ORM |
| Database | PostgreSQL |
| Jobs | BullMQ + Redis (Phase 2+) |
| AI | OpenAI Responses API (Phase 4+) |
| Extension | Chrome MV3 TypeScript (Phase 2+) |

## Next Phase: GitLab Integration

Phase 2 will implement:

1. `GitLabProvider` interface and API implementation
2. Sync engine with BullMQ worker
3. Chrome extension for DOM extraction
4. Webhook/polling configuration in Settings
