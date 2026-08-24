# Database migrations

## Baseline (`20260701000000_init`)

The repository originally shipped additive migrations only (Sprint Intelligence, RoadmapItem, etc.) without a baseline migration. That caused `prisma migrate dev` to fail on the **shadow database** with:

```text
P3006: Migration `20260725180000_add_roadmap_item_table` failed
P1014: The underlying table for model `RoadmapDocument` does not exist.
```

The `20260701000000_init` migration creates core tables (`Team`, `WorkItem`, `RoadmapDocument`, …) before later migrations run.

## Existing databases (created via `db:push`)

If your database already has the core tables, mark the baseline as applied without running its SQL:

```bash
npx prisma migrate resolve --applied 20260701000000_init
```

Then apply pending migrations:

```bash
npm run db:migrate
```

If manager-progress tables were already pushed manually:

```bash
npx prisma migrate resolve --applied 20260810120000_add_manager_progress
```

## Fresh installs

On a new database, run:

```bash
npm run db:migrate
npm run db:seed:manager-progress
```

All migrations apply in order automatically.
