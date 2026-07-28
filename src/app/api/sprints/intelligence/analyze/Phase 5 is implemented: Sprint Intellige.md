Phase 5 is implemented: Sprint Intelligence dashboard, query APIs, analyze/apply workflows, and export — feature remains disabled by default.

---

### 1. Repository / UI analysis
**Reuse:** AppShell/AppHeader, Delivery nav, React Query (`queryKey` arrays), shadcn Card/Tabs/Badge/Button/Sheet/Input/Progress, Sprint Response page pattern, CSS bar charts (no chart lib).  
**Query patterns:** `["feature", …params]`, poll only the active run, invalidate on mutation success.  
**Missing primitives:** no Dialog/Checkbox/Table — used Sheet + native checkbox/select/table.  
**A11y:** labels, `sr-only` captions, status text + badges, dialog focus via Sheet.  
**Perf risk:** large issue sets → server-side page/filter/sort; list omits event-resolution JSON; no list polling while active.

### 2–4. Files created / modified / routes
**Created:** query service + API helper; reason-code catalog; full `src/features/sprint-intelligence/**`; page `/sprints/intelligence`; routes under `/api/sprints/intelligence/*` (status, milestones, analyze, apply, runs, summary, issues, label-actions, failures, config, export).  
**Modified:** `constants.ts`, `app-sidebar.tsx`, analyze/apply error shape.

### 5–15. Behaviour summary
- **Filters:** Zod-validated enums; `page`/`pageSize` (max 100); sort whitelist; URL query sync.  
- **UI:** tabs Overview / Issues / Label Changes / Failures / History / Configuration.  
- **Status banner:** enabled, dry-run, discovery, auto-apply, create-labels, Redis/worker note, last success.  
- **Analyze:** confirm Sheet → POST analyze → poll run 3s → refresh.  
- **Apply:** only when eligible; confirm checkbox; body `{ sourceAnalysisRunId, confirm: true }` only.  
- **Summary/charts:** metrics cards + CSS bars; card click filters Issues.  
- **Issues:** paginated table + Sheet detail with reason presentations.  
- **Labels/failures/history/config:** as specified; config read-only, no secrets.  
- **CSV:** issues + label-actions; formula sanitization (`=+-@`).

### 16–18. A11y / performance / tests
A11y via shadcn Sheet/Tabs + text alternatives. Server-side pagination/filters; poll run only.  
**Tests added:** query service (status, milestones, runs, eligibility, issues, export, secrets), API error shape, reason codes, CSV sanitize, client apply payload, presentation helpers.  
No RTL/component suite (vitest is `node`, no Testing Library).

### 19–21. Validation results
| Check | Result |
|--------|--------|
| SI unit tests (excl. flaky DB repo) | **133 passed** |
| Query + feature tests | **23 passed** |
| `prisma validate` / `generate` | **OK** |
| Lint (Phase 5 files) | **0 errors** |
| Build | **Fails** on pre-existing `timesheets-view.tsx` `asChild` |
| `tsc` unrelated | sprint-planning, team-dashboard, gitlab-sync worker |

**Flaky / env:** `sprint-evaluation-run.repository.test.ts` timed out / unique `runKey` when DB already polluted — not introduced by Phase 5 UI.

### 22. Known limitations
- Assignees not persisted (Phase 4 stores `[]`) — column empty; no assignee filter.  
- Open/closed inferred from `completionTimestamp`.  
- No React component/a11y harness tests.  
- Config editing / auto-apply UI out of scope.

### 23. Rollout
```bash
# keep dry-run safety
SPRINT_INTELLIGENCE_ENABLED=true
SPRINT_INTELLIGENCE_DRY_RUN_ONLY=true   # leave true until ready
# worker required for queued jobs
npm run worker
# only when ready for manual apply:
SPRINT_INTELLIGENCE_DRY_RUN_ONLY=false
```
Put EMOS behind access control before enabling apply in production.

### 24. Phase 6 ideas
Persist assignees + issue web URLs at analysis time; config editing with safety confirmation; richer progress fields; RTL/Playwright E2E for analyze/apply; virtualized issue table; trend analytics across sprints.