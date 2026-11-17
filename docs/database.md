# Database Operations

Run commands from the repository root. Local commands below explicitly target the Docker
service `db`, not your Homebrew PostgreSQL or a remote `DATABASE_URL`.
See [local development](local-development.md) for application environment configuration.

## Local Docker Database

[compose.yaml](../compose.yaml) runs PostgreSQL 17 on **`127.0.0.1:5433`**, leaving a host
PostgreSQL server on `5432` and other projects untouched. Docker must be running.

Start and wait for readiness:

```bash
docker compose up -d --wait db
```

Inspect status and logs:

```bash
docker compose ps
docker compose logs db
```

Stop or remove containers while retaining database data:

```bash
docker compose stop db
docker compose down
```

Data lives in the Compose-managed `postgres_data` named volume. **Do not use
`docker compose down -v` unless you intend to delete the volume and its database data.**
Volumes are not backups.

The stable project name `help-tool-dev` means worktrees share this local database.
A different host port alone does not create a separate database or volume.

### Port Conflicts

If `5433` is occupied, choose another port:

```bash
HELP_TOOL_DB_PORT=5434 docker compose up -d --wait db
```

Use the same override for subsequent Compose commands. Update the app's `DATABASE_URL`
and DBeaver connection to match. Compose does not automatically load `.env.local`;
pass the override explicitly or export it.

### DBeaver Connection

- Host: `127.0.0.1`
- Port: `5433` (or your override)
- Database: `help_tool_v1`
- Username: `postgres`
- Password: `help_tool_local`

These intentionally public credentials are for this localhost-only development instance.
Do not use them for production or a hosted database.

### PostgreSQL Versions

The image's major version matches the PostgreSQL 17 backup used for local testing.
Changing an image from one major version to another does not migrate its data directory.
Use dump/restore or a planned `pg_upgrade` process for major upgrades, and back up first.

Use the container's PostgreSQL client for restores to avoid host-client version conflicts.
DBeaver queries work normally through its connection; native restore tools need a
compatible client selected separately.

## Restore a Local Backup

A full SQL dump requires an **empty database**. Do not run Prisma migrations before
this restore or import it over existing application tables.

### 1. Start and Check the Target

```bash
docker compose up -d --wait db
docker compose exec -T db psql -U postgres -d help_tool_v1 -c '\dt public.*'
```

The second command should report no relations. If tables exist, stop and choose a new
empty database or explicitly plan a backed-up replacement. This guide does not silently
drop existing data.

### 2. Import the Original Dump

Keep backups under the ignored `.tmp/` directory. Replace the example filename with yours.
For a compressed plain SQL dump, first verify and decompress it:

```bash
gzip -t .tmp/backup.sql.gz
gzip -dc .tmp/backup.sql.gz > .tmp/restore.sql
```

Proceed only if both commands succeed. The original compressed file is preserved.
Then import:

```bash
docker compose exec -T db psql -U postgres -d help_tool_v1 -v ON_ERROR_STOP=1 --single-transaction < .tmp/restore.sql
```

For an already uncompressed plain SQL dump, use its filename instead of `.tmp/restore.sql`.
Use the original, unedited PostgreSQL 17 backup: its `transaction_timeout` setting is
supported by PostgreSQL 17, so it does not need removing.

The client runs inside Docker, regardless of your host's PostgreSQL version.
`ON_ERROR_STOP` stops at the first SQL error; `--single-transaction` rolls back a failed
restore instead of leaving partially applied SQL statements. Inspect the first PostgreSQL
error if the command fails.

### 3. Verify and Apply Newer Migrations

```bash
docker compose exec -T db psql -U postgres -d help_tool_v1 -c 'SELECT count(*) FROM public."Vehicle"; SELECT count(*) FROM public."FuelFillUp";'
```

Check the records in DBeaver too. If the backup predates committed migrations in this checkout:

```bash
DATABASE_URL='postgresql://postgres:help_tool_local@127.0.0.1:5433/help_tool_v1?schema=public' pnpm exec prisma migrate deploy
```

With Proton Pass, after verifying that its development secret points at this Docker database:

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma migrate deploy
```

Return to [local development](local-development.md#4-generate-the-client-and-run) to generate
the client and start the app. Never commit database dumps.

## Create a Local Backup

Create the ignored backup directory if needed, then dump the Docker application's schema
and data using its matching client:

```bash
mkdir -p .tmp
```

To keep the dump readable only by your user, run in a subshell with restrictive permissions:

```bash
(
  umask 077
  docker compose exec -T db pg_dump -U postgres -d help_tool_v1 --no-owner --no-privileges --schema=public > ".tmp/help-tool-local-$(date -u +%Y%m%dT%H%M%SZ).sql"
)
```

Check that the command succeeded before relying on the backup.

## Cloudflare R2 Backups

Script: [scripts/backup-to-r2.sh](../scripts/backup-to-r2.sh).
It uses the selected `DATABASE_URL`, which may be remote: confirm the environment first.
The host needs `pg_dump`, `gzip`, and the AWS CLI; use a `pg_dump` version at least as new
as the source server.

With the required environment variables already exported:

```bash
pnpm backup:r2
```

With Proton Pass:

```bash
pass-cli run --env-file .env.local -- pnpm backup:r2
pass-cli run --env-file .env.staging -- pnpm backup:r2
pass-cli run --env-file .env.prod -- pnpm backup:r2
```

Choose only the intended environment. Backups contain sensitive data; protect local files,
bucket access, and retention settings.

Required variables:

- `DATABASE_URL`
- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional variables and defaults:

- `R2_REGION`: `auto`
- `R2_PREFIX`: `db-backups`
- `R2_ENDPOINT`: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
- `BACKUP_LOCAL_DIR`: `.tmp/backups`
- `BACKUP_KEEP_LOCAL`: `0`; set to `1` to retain successful uploads locally.

See [example.env](../example.env) for reference values and `pass://` examples.
The script dumps only `public`, omits ownership and privilege statements, and strips
`CREATE SCHEMA public`. Neon-managed schemas such as `neon_auth` are intentionally excluded
so the dump is portable to a local PostgreSQL database.

The [GitHub backup workflow](../.github/workflows/db-backup-r2.yml) can be run manually
and is scheduled for Sundays at `02:00 UTC`. Configure the required variables above as
GitHub Actions secrets; it also accepts `R2_REGION`, `R2_PREFIX`, and `R2_ENDPOINT`.
