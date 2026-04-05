# Help Tool v1

A Next.js based help tool application.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Database Backup to Cloudflare R2

This project includes a PostgreSQL backup script at `scripts/backup-to-r2.sh`.

Manual run:

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
- `R2_ENDPOINT` (optional endpoint override; default: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`)
- `BACKUP_LOCAL_DIR` (default: `.tmp/backups`)
- `BACKUP_KEEP_LOCAL` (`1` keeps local dump, default removes local file after upload)

Automated backups are configured in `.github/workflows/db-backup-r2.yml` and run:

- On demand via GitHub Actions `workflow_dispatch`
- Weekly on Sundays at `02:00 UTC`

GitHub repository secrets needed by the workflow:

- `DATABASE_URL`
- `R2_BUCKET`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- Optional: `R2_REGION`, `R2_PREFIX`, `R2_ENDPOINT`

## Proton Pass Local Env

If you use Proton Pass CLI (`pass-cli`) like in Beagle, use `pass://` references in `.env.local` and run commands through `pass-cli`.

Example `.env.local` values:

```env
DATABASE_URL=pass://help-tool-v1/env.local/DATABASE_URL
AUTH_GOOGLE_ID=pass://help-tool-v1/env.local/AUTH_GOOGLE_ID
AUTH_GOOGLE_SECRET=pass://help-tool-v1/env.local/AUTH_GOOGLE_SECRET
AUTH_SECRET=pass://help-tool-v1/env.local/AUTH_SECRET
ALLOWED_EMAILS=pass://help-tool-v1/env.local/ALLOWED_EMAILS
R2_BUCKET=pass://help-tool-v1/env.local/R2_BUCKET
R2_ACCOUNT_ID=pass://help-tool-v1/env.local/R2_ACCOUNT_ID
R2_ACCESS_KEY_ID=pass://help-tool-v1/env.local/R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY=pass://help-tool-v1/env.local/R2_SECRET_ACCESS_KEY
R2_REGION=auto
R2_PREFIX=db-backups
```

Safe local commands:

- `pnpm dev:local` (runs `pnpm dev` via `pass-cli`)
- `pnpm backup:r2:local` (runs DB dump + R2 upload via `pass-cli`)

These scripts use `scripts/pass-env-run.sh` and `.env.local` by default.
