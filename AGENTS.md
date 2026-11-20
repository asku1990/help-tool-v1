# Repository Guidelines

## Read First

- Read [README.md](README.md) for basic project scope and documentation navigation.
- Before planning or modifying code or documentation, read [docs/documentation-rules.md](docs/documentation-rules.md). Follow it for documentation placement, detail level, and updates; do not rely only on this file.
- Use [docs/local-development.md](docs/local-development.md) for setup, [docs/database.md](docs/database.md) for database operations, and [docs/commands.md](docs/commands.md) for development commands.
- Read [docs/architecture.md](docs/architecture.md) before planning or changing code. It is the source of truth for feature organization, module responsibilities, dependency flow, security, and cache ownership.
- This file owns agent workflow and contribution standards. Do not create competing architecture definitions in editor-specific rule files.
- Read relevant feature plans and decision logs under `docs/` when they apply. Distinguish future plans from implemented behavior; surface conflicts rather than silently choosing a different design.
- Read the relevant `docs/features/` guide before changing a feature. Keep documentation ownership and update requirements in [docs/documentation-rules.md](docs/documentation-rules.md), not competing definitions here.

## Scope & Implementation Workflow

- Inspect the working tree, relevant documentation, existing implementations, and callers before editing. Preserve unrelated user changes.
- Explain the intended scope and validation briefly. Prefer small, targeted changes and existing modules over new abstractions.
- Stay within the user's approved scope. Ask before expanding a bug fix into a broader refactor, changing architectural direction, or performing destructive operations.
- Follow the feature-folder and dependency rules in the architecture document. Do not reorganize unrelated legacy files as part of a focused fix.
- Add regression coverage at the real call site or shared calculation interface. For bug fixes, establish the failing behavior before applying the fix when execution is available.
- Review the diff for correctness, security, duplication, and configuration risks. Update the architecture document when an approved architectural decision changes.
- Report what changed, which checks actually ran, and any unresolved failures or permission blockers. Do not describe unexecuted checks as passing.

## Build, Test, and Development Commands

- Follow [docs/commands.md](docs/commands.md) for the command reference and [docs/local-development.md](docs/local-development.md) for environment loading.
- Run checks from the repository root. Use the `pnpm exec vitest run` and
  `pnpm exec prettier` forms documented in the command reference for targeted runs.
- Run targeted tests, lint, and type-check for changed code, then the coverage gate when appropriate.
- Format only touched files for focused changes; repository-wide formatting commands can create unrelated diffs.
- Verify the target environment before database commands and follow [docs/database.md](docs/database.md) for backup and restore safety.

## Coding Style & Naming Conventions

- TypeScript everywhere; stick to ES modules, React function components, and hooks.
- Follow `.prettierrc` (2-space indent, single quotes) and ESLint (Next + TypeScript) rules; do not suppress `@typescript-eslint/no-explicit-any`.
- Absolutely no `any` usage—reach for specific types, generics, or utility helpers, and refactor tests to keep type safety intact.
- Name files by feature (`ExpenseForm.tsx`, `useFillUps.ts`). Name colocated tests `*.test.ts(x)`;
  see [testing boundaries](docs/architecture.md#testing-boundaries) for where to put tests and Playwright scenarios.
- Tailwind classes live inline; prefer utility-first styling over custom CSS.
- Use the project logger instead of adding `console.log`; include enough operation context to diagnose failures without logging secrets.

## Testing Guidelines

- Vitest + Testing Library drive unit/component coverage; prefer behavior-oriented test names (`Component > scenario > expectation`).
- Prefer integration coverage for changed flows, pure calculation tests for domain rules, and focused UI tests for visible behavior. Keep tests deterministic with explicit fixtures, clocks, and request mocks where needed.
- Coverage thresholds (from `vitest.config.mts`) require ≥65% statements/lines and 70% functions/branches; flakiness often means missing mock setup for `fetch`.
- Use `pnpm test:watch` for fast iteration and `pnpm test` for the coverage gate. Run lint and type-check before marking code ready; report blocked checks explicitly.

## Commit & Pull Request Guidelines

- Keep commits linear and descriptive, mirroring the existing Conventional-style prefixes (`feat:`, `fix:`, `refactor:`) seen in `git log`.
- Each commit should encapsulate a logical change (tests + code). Avoid “WIP” noise.
- Do not commit, push, or merge unless the user asks.
- PRs must describe the problem, solution, and validation steps; attach screenshots or coverage diffs when UI or tests change. Link Jira/GitHub issues when applicable and note any env/config updates (e.g., new `.env` keys).

## Security & Configuration Tips

- Copy `example.env` to `.env.local` for local secrets; never commit real credentials.
- Prisma migrations should be generated via `pnpm prisma migrate dev` and committed alongside schema updates.
- If you touch queries or API routes, double-check rate-limit helpers under `lib/api` and update tests accordingly to keep coverage healthy.
