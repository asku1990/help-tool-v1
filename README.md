# Help Tool v1

Help Tool v1 is a Next.js + PostgreSQL application.

The long-term goal is a broader personal help tool with multiple feature areas.
Current implemented scope is car management.

## Current Scope

- Vehicle and car-related data management
- Car maintenance and expense tracking flows
- User access/auth support used by the car domain

## Tech Stack

- Next.js (App Router)
- TypeScript
- Prisma + PostgreSQL
- Vitest + Testing Library
- Tailwind CSS

## Local Setup

1. Install dependencies:

```bash
pnpm install
```

2. Create local env file from template:

```bash
cp example.env .env.local
```

3. Add your local values to `.env.local`.

4. Run database migrations (if needed):

```bash
pnpm prisma migrate dev
```

5. Start development server:

```bash
pnpm dev
```

App runs at `http://localhost:3000`.

## Useful Commands

- `pnpm dev` starts local development server
- `pnpm build` creates production build
- `pnpm start` runs production build
- `pnpm lint` runs linting
- `pnpm type-check` runs TypeScript checks
- `pnpm format` runs Prettier
- `pnpm test` runs test suite with coverage
- `pnpm check` runs format, lint, and type-check

## Database Backup to Cloudflare R2

Script: `scripts/backup-to-r2.sh`

Run manually:

```bash
pnpm backup:r2
```

Required environment variables:

- `DATABASE_URL`
- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Optional environment variables:

- `R2_REGION` (default: `auto`)
- `R2_PREFIX` (default: `db-backups`)
- `R2_ENDPOINT` (default: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
- `BACKUP_LOCAL_DIR` (default: `.tmp/backups`)
- `BACKUP_KEEP_LOCAL` (`1` keeps local dump; default removes local file after upload)

GitHub Action workflow: `.github/workflows/db-backup-r2.yml`

- Manual trigger: `workflow_dispatch`
- Scheduled trigger: Sundays at `02:00 UTC`

GitHub Actions secrets needed by the workflow:

- `DATABASE_URL`
- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- Optional: `R2_REGION`, `R2_PREFIX`, `R2_ENDPOINT`

## Proton Pass Local Env (Optional)

If you use Proton Pass CLI (`pass-cli`), use `pass://` references in `.env.local` and run commands through `pass-cli`.

Use [`example.env`](/Users/akikuivas/personal-projects/help-tool-v1/example.env) as the source of truth for env keys and Proton Pass `pass://` examples.

Helper commands:

- `pnpm dev:local`
- `pnpm backup:r2:local`
