# Repository Guidelines

## Project Structure & Module Organization

- `app/` contains Next.js routes, layouts, and API handlers; treat route-segment folders (e.g., `app/car/[vehicleId]`) as feature roots that bundle UI, data loading, and tests.
- `components/` hosts reusable UI and domain components; subfolders mirror feature areas (`components/car/**`, `components/ui/**`).
- `hooks/`, `stores/`, and `queries/` expose shared client-side logic; mock them in tests instead of duplicating API calls.
- `lib/` houses cross-cutting helpers such as API clients and Prisma utilities; `prisma/` keeps schema and seeds.
- Tests live alongside features in `__tests__` folders plus targeted suites under `test/`; assets reside in `public/`.

## Build, Test, and Development Commands

- `pnpm dev` starts Next.js with Turbopack; use during feature development.
- `pnpm build` runs Prisma codegen/migrations (via scripts) and compiles the production bundle.
- `pnpm start` serves the built app locally; pair with `pnpm build`.
- `pnpm lint`, `pnpm type-check`, and `pnpm format` enforce style.
- `pnpm test` (Vitest with coverage) is the gatekeeper; `pnpm check` stitches format, lint, and type-check for CI parity.

## Coding Style & Naming Conventions

- TypeScript everywhere; stick to ES modules, React function components, and hooks.
- Follow Prettier defaults (2-space indent, single quotes off) and ESLint (Next + TypeScript) rules; do not suppress `@typescript-eslint/no-explicit-any`.
- Absolutely no `any` usage—reach for specific types, generics, or utility helpers, and refactor tests to keep type safety intact.
- Name files by feature (`ExpenseForm.tsx`, `useFillUps.ts`) and colocate tests as `*.test.ts(x)` inside `__tests__`.
- Tailwind classes live inline; prefer utility-first styling over custom CSS.

## Testing Guidelines

- Vitest + Testing Library drive unit/component coverage; prefer behavior-oriented test names (`Component > scenario > expectation`).
- Coverage thresholds (from `vitest.config.mts`) require ≥65% statements/lines and 70% functions/branches; flakiness often means missing mock setup for `fetch`.
- Run `pnpm test --watch` for fast iteration; CI runs `pnpm test` with `--coverage`.

## Commit & Pull Request Guidelines

- Keep commits linear and descriptive, mirroring the existing Conventional-style prefixes (`feat:`, `fix:`, `refactor:`) seen in `git log`.
- Each commit should encapsulate a logical change (tests + code). Avoid “WIP” noise.
- PRs must describe the problem, solution, and validation steps; attach screenshots or coverage diffs when UI or tests change. Link Jira/GitHub issues when applicable and note any env/config updates (e.g., new `.env` keys).

## Security & Configuration Tips

- Copy `example.env` to `.env.local` for local secrets; never commit real credentials.
- Prisma migrations should be generated via `pnpm prisma migrate dev` and committed alongside schema updates.
- If you touch queries or API routes, double-check rate-limit helpers under `lib/api` and update tests accordingly to keep coverage healthy.
