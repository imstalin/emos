# Manager Progress Dashboard

Engineering Manager Progress Dashboard transforms GitLab Atom feed activity into delivery-focused progress views.

## Architecture

```text
GitLab Atom Feeds (env vars)
    ↓
BullMQ scheduled worker (manager-progress-feed)
    ↓
Fetch → Parse → Normalize → Deduplicate (gitlabEventId)
    ↓
ProgressWorkItem correlation + lifecycle inference
    ↓
Blockers + Manager Attention rules
    ↓
ProgressSnapshot (daily)
    ↓
Dashboard APIs + /manager/progress UI
```

## Configuration

1. Run migration: `npm run db:migrate`
2. Seed teams, members, feeds, priorities: `npm run db:seed:manager-progress`
3. Set feed URLs in `.env` (never commit tokens):

```env
MANAGER_PROGRESS_ENABLED=true
MANAGER_PROGRESS_FEED_INTERVAL_MINUTES=12
GITLAB_FEED_JAYAPAL_MURUGANANDHAM="https://gitlab.example.com/User.atom?feed_token=..."
```

Feed records in the database store only `feedEnvKey` — the URL is resolved at runtime from the environment.

## Security

- Feed tokens are never stored in the database, logged in full, or exposed via frontend APIs.
- `redactFeedUrl()` strips `feed_token` from log paths.
- Historical `GitLabFeedActivity` records remain when a member is disabled or a token is rotated.

## Worker

Start with the existing worker process:

```bash
npm run worker
# or
npm run dev:all
```

Manual ingestion: `POST /api/gitlab/feed-health`

## Key modules

| Layer | Path |
|-------|------|
| Domain | `src/domain/manager-progress/` |
| Types | `src/domain/types/manager-progress.ts` |
| Ingestion | `src/server/services/manager-progress/feed-ingestion.service.ts` |
| Dashboard | `src/server/services/manager-progress/manager-progress.service.ts` |
| API | `src/app/api/manager/progress/` |
| UI | `src/features/manager-progress/` |

## Demo mode

When the database is empty or unavailable, the dashboard falls back to demo data illustrating TSC Production, Advanced Search, and Rewards Expiry scenarios from the spec.
