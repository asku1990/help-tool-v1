# Local database workflow

Use disposable local PostgreSQL for development and tests, not staging or production.
Back up any local data you need before migrating.

## Verify the target

Use `pass-cli` to load `.env.local` and resolve its Proton Pass references, as with
the development server. Prisma CLI does not automatically load `.env.local`.

Confirm that `DATABASE_URL` (or its referenced Proton Pass value) targets your local
host, port, and database: normally `127.0.0.1:5432/help_tool_v1`. Check that no tunnel
forwards that port to a remote server. Never share credentials or commit them.

## Check migration history (read-only)

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma migrate status
```

This compares migration history against `prisma/migrations/`; it does not prove there
are no manual schema changes. In DBeaver, successful `_prisma_migrations` entries have
`finished_at` set and `rolled_back_at` unset. Compare migration names, not just counts.

If history diverges or Prisma reports drift, investigate before proceeding. Do not
accept reset prompts, edit applied migrations, or use `db push` to hide differences.

## Generate, review, and apply migrations (local writes)

For ordinary schema changes, after confirming the local target:

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma migrate dev
```

This generates and applies migrations locally. When SQL needs editing before application
(such as the attachment CHECK constraint), generate it separately:

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma migrate dev --name add_attachments --create-only
```

Review and edit the new SQL, then apply it with `migrate dev`. Keep the schema and
migration together in the reviewed change. Do not regenerate an existing migration.

`migrate dev` needs permission to create a shadow database or a dedicated disposable
shadow database. `--create-only` is not a read-only check: it writes migration files
and uses a shadow database. Never use a database containing data you need as a shadow.
Stop if Prisma requests a reset.

Apply the reviewed migrations locally and regenerate the client:

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma migrate dev
pass-cli run --env-file .env.local -- pnpm exec prisma generate
pass-cli run --env-file .env.local -- pnpm exec prisma migrate status
```

These steps do not authorize remote migrations. Do not use `pnpm vercel-build` as a
harmless check: it applies migrations to its configured database.

For attachment-specific SQL and integration tests, see the
[attachment plan](../plan/file-upload.md#slice-1-migration-and-validation).
