# Architecture

This document owns the application's architecture and conventions for new or changed code.
It describes the current system and the intended organization; existing legacy files may not
yet follow every convention. Do not migrate unrelated code merely to make a focused change conform.

Use [README.md](../README.md) for basic project information and documentation navigation.
Operational procedures live in [local development](local-development.md),
[database operations](database.md), and [development commands](commands.md).
[AGENTS.md](../AGENTS.md) owns agent workflow, coding standards, and validation.
Keep architectural decisions here rather than maintaining separate editor-specific definitions.
Feature-specific business rules and UI behavior belong in `docs/features/`; for example,
see [fuel consumption and summaries](features/consumption.md).

## System Overview

Help Tool is a Next.js App Router application backed by PostgreSQL through Prisma.
The implemented domain is car management: vehicles, fuel fill-ups, expenses, maintenance,
tires, and related consumption and cost insights. The longer-term product can contain
other domains; do not introduce their abstractions before they are needed.

- Next.js route handlers expose the server interface under `app/api/`.
- React UI uses TanStack Query for server state.
- Prisma owns database access and schema migrations.
- NextAuth uses Google OAuth with verified email and the `ALLOWED_EMAILS` sign-in gate.
- Vehicle access is checked separately through shared role-based access helpers.

### Local Runtime

For local development, `compose.yaml` runs PostgreSQL 17 independently of the host's
database installation. The Next.js app continues to run on the host with pnpm.
The database is published on localhost port `5433` by default and persisted in a named
volume. This isolates Help Tool from Beagle and Homebrew PostgreSQL without containerizing
the whole application. The Compose project name is stable across worktrees, so those
worktrees share the same local database unless a separate Compose project is explicitly selected.

Docker initialization is not a migration mechanism: use committed Prisma migrations for
a fresh schema or restore a full dump into an empty database. Major PostgreSQL version
changes require an explicit data migration. See [database operations](database.md#local-docker-database)
for startup, connection, persistence, and restore procedures. This configuration is local-only,
not a production deployment definition.

## Feature Organization

Keep the existing top-level layers, and group related files by feature within each layer.
Feature folders are the default for new code; do not add a collection of unrelated flat
files to the roots of `lib/`, `hooks/`, `queries/`, or `utils/`.

- `app/`: route entry points, layouts, pages, and server handlers; route-segment folders own
  route-specific logic and tests.
- `components/<feature>/`: reusable feature UI; `components/ui/` contains shared UI primitives.
- `hooks/<feature>/`: reusable query and mutation hooks, enabled state, and invalidation behavior.
- `queries/<feature>/`: typed request functions, request URLs, and transport-facing types.
- `queries/keys.ts`: central query-key definitions.
- `stores/`: client-only UI state, not a second server-state cache or fetching layer.
- `lib/<feature>/`: shared domain calculations; infrastructure helpers remain in their existing
  focused modules such as `lib/api/` and `lib/prisma/`.
- `utils/<feature>/`: existing utility features; extend the owning module instead of creating
  competing helpers.
- `prisma/`: schema, migrations, and feature-grouped seed data.
- `public/`: static assets.

For example:

```text
lib/<feature>/
  index.ts
  calculate.ts
  __tests__/
    calculate.test.ts

hooks/<feature>/
  index.ts
  useFeature.ts
  __tests__/
    useFeature.test.tsx

queries/<feature>/
  index.ts
  getFeature.ts
  __tests__/
    getFeature.test.ts
```

Extend an existing feature folder when it fits. Give new reusable feature folders an
`index.ts` that exports their public interface; route and test folders do not need artificial
barrels. Colocate tests in the owning feature's `__tests__/` folder. Use `test/` for shared
test infrastructure and `e2e/` for Playwright scenarios.

## Dependency Flow

```text
UI → hook → queries module → lib/api/client → route handler → Prisma → PostgreSQL
                                                ↓
                                      shared lib/<feature> calculations
```

- UI renders results and invokes hooks; it does not duplicate request URLs or server-state fetching.
- Hooks configure TanStack Query and call request functions from `queries/<feature>/`.
- Query modules call the shared API client, which handles the JSON envelope and typed errors.
- Route handlers own authentication, authorization, input validation, rate limiting, database
  access, and response mapping. Do not import Prisma or server-only authentication into client code.
- Shared calculation modules accept typed input and return results without fetching data,
  creating database clients, or depending on React. Routes and UI reuse the same formulas.
- Keep interfaces small and feature-owned. Do not add pass-through layers or duplicate domain
  types without a concrete need.

## Server State and Cache Ownership

- TanStack Query is the server-state owner. Do not introduce store-based fetching alongside it.
- Query defaults live in `app/query-provider.tsx`. Reuse its stale time, garbage-collection time,
  and retry policy instead of repeating inline cache settings in hooks. Document and justify
  exceptions when a feature genuinely needs different behavior.
- Define reusable query and mutation hooks in separate files.
- Use centralized query keys and invalidate all affected views after mutations, including
  derived summaries as well as directly changed record lists.
- Render loading and error states explicitly; failed requests must not look like real zero totals.

## Server Contracts and Security

- Use the standard `{ data, error }` JSON envelope through `lib/api/response.ts`.
- Use shared `lib/api/rate-limit.ts` helpers, including retry headers for rejected requests.
- Validate external input with Zod and return structured validation errors.
- Use `getSessionUserId`, `getVehicleAccess`, and `hasPermission` from
  `lib/api/vehicle-access.ts`. Sign-in permission alone does not grant access to every vehicle.
- Scope database queries to the authorized vehicle. Check permissions before reading or mutating
  its records; never depend on a client-side access check for server authorization.
- Convert Prisma decimal values for JSON using `lib/prisma/decimal.ts`.
- Paginate record lists with cursors and configured limits. Pagination is a presentation concern,
  not a limit on the history used to calculate summaries.
- Keep credentials in environment configuration. `example.env` documents keys; real values must
  not appear in source, logs, test fixtures, or documentation.

## Architectural Changes

Before changing module ownership, dependency flow, cache policy, or security responsibilities,
explain the proposal and get approval for any expansion beyond the requested scope.
Update this document with the approved decision and its rationale in the same change.
Update feature behavior in the owning `docs/features/` guide instead. Keep feature rollout plans
and historical logs under `docs/`, clearly marked when they describe future rather than
implemented behavior.
