# Local Development

Run all commands from the repository root. The Next.js app runs on your host; only
PostgreSQL runs in Docker.

## Prerequisites

- Node.js 22.x and pnpm (matching `package.json` and CI).
- Docker Desktop or another Docker engine with the Compose plugin, running.
- Google OAuth development credentials.
- Optional: Proton Pass CLI if you keep secrets as `pass://` references.

## 1. Install and Configure

```bash
pnpm install
```

If `.env.local` does not already exist:

```bash
cp example.env .env.local
```

Do not overwrite an existing local configuration. Set the Google OAuth credentials,
`AUTH_SECRET`, and `ALLOWED_EMAILS` using [example.env](../example.env) as the key reference.
Generate an auth secret if needed:

```bash
openssl rand -base64 32
```

For the local Docker database, use:

```dotenv
DATABASE_URL="postgresql://postgres:help_tool_local@127.0.0.1:5433/help_tool_v1?schema=public"
```

These are local-development credentials, not production credentials.

## 2. Start PostgreSQL

```bash
docker compose up -d --wait db
```

See [database operations](database.md) for DBeaver connection details, port conflicts,
and persistent-volume behavior.

## 3. Initialize the Database

Choose one path; do not run migrations before importing a full SQL dump.

### Restore Existing Data

Follow [Restore a local backup](database.md#restore-a-local-backup), then return here.
That guide also explains applying any newer committed migrations after the restore.

### Start with Empty Development Data

Apply committed migrations to the local Docker database:

```bash
DATABASE_URL='postgresql://postgres:help_tool_local@127.0.0.1:5433/help_tool_v1?schema=public' pnpm exec prisma migrate deploy
```

The connection above is explicit because Prisma CLI does not automatically load `.env.local`.
If you changed the Docker port, update the URL here too.

## 4. Generate the Client and Run

For literal values in `.env.local`:

```bash
DATABASE_URL='postgresql://postgres:help_tool_local@127.0.0.1:5433/help_tool_v1?schema=public' pnpm exec prisma generate
pnpm dev
```

Next.js loads `.env.local` itself. Open `http://localhost:3000`.

## Optional: Proton Pass

If `.env.local` contains `pass://` references, do not run the app or Prisma against those
unresolved strings. Use Proton Pass to resolve the selected environment explicitly:

```bash
pass-cli run --env-file .env.local -- pnpm exec prisma migrate deploy
pass-cli run --env-file .env.local -- pnpm exec prisma generate
pass-cli run --env-file .env.local -- pnpm dev
```

Run the migration command only for the appropriate initialization path above.
If `DATABASE_URL` is a reference, update its development secret to point at Docker.

For deliberately selected remote environments:

```bash
pass-cli run --env-file .env.staging -- pnpm dev
pass-cli run --env-file .env.prod -- pnpm dev
```

These commands connect the app to the selected environment; they do not create isolation.
Verify the target before running, particularly for production, and never paste resolved
credentials into logs or documentation. See [database operations](database.md) for backup
commands and [development commands](commands.md) for other tasks.
