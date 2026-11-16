# Architecture guidance

This document describes the application's shared structure and engineering rules.
Feature scope and implementation milestones belong in `docs/plan/`, not here.

## System overview

The application is a Next.js 15 App Router application using React 19 and TypeScript.
UI routes and API route handlers live in the same application. PostgreSQL stores
persistent data through Prisma; browser code does not access the database directly.
Staging is hosted on Vercel.

The main dependencies and their responsibilities are:

| Technology             | Responsibility                                          |
| ---------------------- | ------------------------------------------------------- |
| Next.js App Router     | Pages, layouts, server rendering, and HTTP API handlers |
| React and Tailwind CSS | Interactive UI and styling                              |
| Auth.js / NextAuth     | Google sign-in and application sessions                 |
| TanStack Query         | Client-side server-data cache, queries, and mutations   |
| Zustand                | Shared client-side UI state                             |
| Zod                    | Runtime request validation                              |
| Prisma and PostgreSQL  | Relational persistence and migrations                   |

## Module boundaries

| Location            | Responsibility                                                               |
| ------------------- | ---------------------------------------------------------------------------- |
| `app/`              | Route composition, layouts, and API entry points                             |
| `components/`       | Reusable UI and domain components; shared primitives in `components/ui/`     |
| `hooks/`            | React-facing queries, mutations, and shared client behavior                  |
| `queries/`          | Typed domain API functions and query keys                                    |
| `stores/`           | Client UI state, not a second cache of persisted server data                 |
| `lib/api/`          | HTTP client, response helpers, validation, access control, and rate limiting |
| `lib/db.ts`         | Shared server-side Prisma client                                             |
| `lib/` and `utils/` | Shared infrastructure and focused helpers                                    |
| `prisma/`           | Database schema, migrations, and seeds                                       |
| `generated/prisma/` | Generated Prisma client; regenerate rather than edit manually                |

Keep feature-specific code close to its route or component. Extract shared modules
when there is a concrete shared responsibility, not to anticipate hypothetical features.
Server credentials and database imports must not enter browser modules.

## Data flow and state

The existing client-side request path is:

```text
Component → hook → queries/<domain> → lib/api/client
          → app/api route handler → Prisma → PostgreSQL
```

`app/layout.tsx` provides the session and TanStack Query contexts. Hooks manage server
data through query keys, cache updates, and invalidation after mutations. Local form
state belongs in the component; shared UI state belongs in Zustand where needed.

API domain functions expose typed DTOs rather than Prisma objects. Convert database
values such as Prisma decimals explicitly at the response boundary; shared conversion
helpers live in `lib/prisma/`. The HTTP client unwraps `{ data }` responses and turns
error responses into `ApiClientError`. Use the response helpers in `lib/api/response.ts`
and UI error helpers rather than inventing a different contract for each route.

## Authentication and authorization

`auth.ts` configures Google sign-in and the allowed-email policy. Middleware protects
the `/dashboard` and `/car` page trees. API handlers must authenticate and authorize
requests themselves; page middleware is not API authorization.

Vehicle access is represented by `VehicleAccess` and checked through
`lib/api/vehicle-access.ts`:

| Vehicle role | Access levels            |
| ------------ | ------------------------ |
| `OWNER`      | `read`, `write`, `admin` |
| `EDITOR`     | `read`, `write`          |
| `VIEWER`     | `read`                   |

Choose the required level for each operation. Administrative account checks are
separate from vehicle-role checks and live in `lib/api/admin-access.ts`.

Never trust a nested resource ID solely because the caller can access the vehicle
in the URL. Scope reads and writes to the authorized parent and child together.
Validate untrusted input at the server boundary, using Zod where appropriate.

The existing rate limiter is an in-process map keyed by IP and path. It is not a
distributed quota or a durable concurrency control mechanism across Vercel instances.

## Persistence and consistency

`prisma/schema.prisma` defines the relational model. Vehicle-owned records include
expenses, fuel fill-ups, and tire records; shared access is modeled separately from
ownership. Existing relations include cascading deletes: inspect them before changing
deletion behavior or introducing new relations.

Use the shared client from `lib/db.ts`; it reuses the client during local development.
Use database constraints and transactions for invariants that must hold under
concurrent requests. A browser check or an application-level count followed by a
separate insert does not establish a concurrency guarantee.

Generate schema migrations with `pnpm prisma migrate dev` and commit the migration
alongside schema changes. Review generated SQL. Applying a migration to a remote
environment is a separate operational action, not implicit validation.

## Configuration and external systems

Document environment variable names and placeholders in `example.env`; never commit
credentials. Keep server-only secrets out of `NEXT_PUBLIC_*` variables, which are
exposed to browser code. Keep staging and production resources isolated.

Check hosting limits before selecting an architecture. The `vercel-build` script runs
Prisma generation and `prisma migrate deploy` before building, so it can change the
configured database. Do not use it as a harmless local check against a remote database.

The existing R2 integration in `scripts/backup-to-r2.sh` uploads PostgreSQL dumps.
It does not constitute a backup of other objects stored in R2 or prove recoverability.

## Testing boundaries

- Colocate unit and component tests in `__tests__/` directories.
- Use Vitest and Testing Library for behavior-oriented tests. Mock shared hooks/API
  boundaries where appropriate rather than duplicating fetching inside components.
- Use real PostgreSQL integration tests for database constraints and concurrency;
  mocked Prisma calls cannot prove those guarantees.
- Use Playwright under `e2e/` for browser-level workflows.
- Test authorization failures and parent/child mismatches, not only successful requests.
- Keep test-only authentication bypasses disabled outside controlled test environments.

`pnpm test` runs coverage. Current thresholds in `vitest.config.mts` are 65% for
statements/lines and 70% for functions/branches. Type checking and linting complement
tests; report checks that could not run rather than claiming validation.

## Scope and simplicity

Use the smallest design that meets the agreed feature requirements. Separate staging
experiments from production guarantees, and document accepted limitations explicitly.
Do not introduce background services, generic frameworks, or recovery protocols solely
for possible future requirements.

## UTC timestamp naming and storage

For new database fields representing an instant in UTC, make the timezone explicit in
the name. Use camelCase consistently:

- `createdAtUtc`
- `updatedAtUtc`
- Other instant fields follow the same convention, for example `expiresAtUtc`, if needed.

For PostgreSQL and Prisma, use timezone-aware columns explicitly:

```prisma
createdAtUtc DateTime @default(now()) @db.Timestamptz(3)
updatedAtUtc DateTime @updatedAt @db.Timestamptz(3)
```

PostgreSQL `timestamptz` represents an instant; it does not retain the original timezone.
Its displayed timezone depends on the database session. Transfer instants as ISO 8601
UTC strings with `Z`, for example using `Date.toISOString()`. Apply user-local formatting
only for display.

`@updatedAt` is maintained by Prisma. If another writer changes rows through raw SQL,
that writer must update `updatedAtUtc` explicitly; this annotation is not a database trigger.

Do not append `Utc` to date-only business values, such as a receipt's calendar date.
Do not rename or migrate existing timestamp columns as part of an unrelated feature.
Existing tables can be addressed in a separately scoped migration.
