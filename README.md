# Car Management

A personal car management app built with Next.js and PostgreSQL. Track vehicles,
fuel fill-ups, maintenance, and running costs in one place.

## Features

- Vehicle management
- Fuel fill-ups and consumption insights
- Maintenance and expense tracking
- Google sign-in and vehicle access permissions
- Vehicle, expense, and fill-up attachments for disposable staging files

## Tech Stack

Next.js App Router, TypeScript, Prisma, PostgreSQL, TanStack Query, Tailwind CSS,
Vitest, and Playwright.

## Documentation

- [Local development](docs/local-development.md) — install, configure, and run the app.
- [Database operations](docs/database.md) — Docker, DBeaver, backup, and restore.
- [Development commands](docs/commands.md) — testing, formatting, builds, and Prisma commands.
- [Architecture](docs/architecture.md) — feature organization, responsibilities, and data flow.
- [Fuel consumption](docs/features/consumption.md) — calculation rules and consumption displays.
- [Viewing saved records](docs/features/records.md) — read-only expense and fill-up details.
- [Tire management](docs/features/tires.md) — tire sets, mounting, and change history.
- [Attachment storage](docs/development/attachments.md) — private staging storage and disposable-file checks.
- [Agent guidelines](AGENTS.md) — contribution workflow and coding standards.
- [Documentation rules](docs/documentation-rules.md) — where documentation belongs and how to update it.

Keep this README to basic project information and navigation. Detailed procedures and
command references belong in the linked guides.
