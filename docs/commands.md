# Development Commands

Run commands from the repository root. See [local development](local-development.md) for
setup and environment loading, and [database operations](database.md) for Docker, DBeaver,
backup, and restore commands.

## App and Builds

- `pnpm install`: install dependencies.
- `pnpm dev`: start Next.js with Turbopack at `http://localhost:3000`.
- `pnpm build`: compile a production build; does not apply database migrations.
- `pnpm start`: serve an existing production build.
- `pnpm vercel-build`: generate the Prisma client, deploy committed migrations to the
  configured database, and compile. Verify `DATABASE_URL` before running: this changes its schema.

Next.js loads literal values from `.env.local`. If it contains Proton Pass references:

```bash
pass-cli run --env-file .env.local -- pnpm dev
```

## Formatting, Lint, and Types

- `pnpm lint`: run the configured lint script.
- `pnpm type-check`: run TypeScript without emitting files.
- `pnpm format`: format the entire repository in place.
- `pnpm check`: run formatting, lint, and type-check; this also rewrites files.

For a focused change, check or format only the files you touched:

```bash
pnpm exec prettier --check path/to/file.ts
pnpm exec prettier --write path/to/file.ts
```

Avoid unrelated formatting diffs. Consult `.prettierrc` and `eslint.config.mjs` for actual
configuration rather than relying on formatter defaults.

## Git Hooks and CI

The pre-commit hook runs `lint-staged` to lint and format staged files. There is no pre-push
hook. [GitHub CI](../.github/workflows/ci.yml) runs coverage, integration and end-to-end
tests, and a production build for pull requests targeting `develop` or `main`. Direct pushes
do not trigger this workflow; run the relevant checks locally when working outside a PR.

## Tests

- `pnpm test`: run Vitest with coverage and configured coverage thresholds.
- `pnpm test:watch`: run tests interactively in watch mode.
- `pnpm test:ui`: open Vitest UI with coverage.
- `pnpm test:changed`: test changes relative to `HEAD~1` with coverage.

Run a targeted suite without the global coverage gate:

```bash
pnpm exec vitest run lib/consumption/__tests__
```

Run Playwright:

```bash
pnpm exec playwright test
```

Integration and end-to-end tests may need a configured database, Docker, and environment
variables. Read the relevant test setup before running against an existing database.
Test-only authentication bypasses must never be enabled for normal or production use.

With Docker running, execute the PostgreSQL integration suites:

```bash
RUN_INTEGRATION=1 pnpm exec vitest run .int.test. --reporter=verbose
```

These suites migrate disposable Testcontainers databases, not the app's configured database.
The shared setup leaves HTTP interception disabled for `.int.test.*` files so MSW cannot
interfere with Docker socket requests. Unit and UI suites retain their MSW handlers.

## Prisma

Prisma CLI does not automatically load `.env.local`. Export the intended `DATABASE_URL`
in your shell, or use the Proton Pass wrapper shown below, before running these commands:

- `pnpm exec prisma generate`: generate the client; does not apply migrations.
- `pnpm exec prisma migrate deploy`: apply committed migrations to the selected database.
- `pnpm exec prisma migrate dev --name <migration_name>`: create/apply a development migration;
  may prompt for a reset if drift is detected. Review before agreeing.
- `pnpm exec prisma studio`: inspect the selected database in Prisma Studio.

For example, explicitly selecting the development environment:

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma generate
pass-cli run --env-file .env.local -- pnpm exec prisma migrate deploy
```

Use the [local setup guide](local-development.md#3-initialize-the-database) for an explicit
Docker connection without Proton Pass. Generate schema migrations through Prisma and commit
the migration with the schema change. Never run development migrations or resets against
production, and never reset a database without confirming the target and having a backup.
