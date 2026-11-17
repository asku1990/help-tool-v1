# Help Tool v1

A personal help tool built with Next.js and PostgreSQL. The current implemented scope is
car management; additional feature areas are a longer-term goal.

## Features

- Vehicle management
- Fuel fill-ups and consumption insights
- Maintenance and expense tracking
- Google sign-in and vehicle access permissions
- Expense and fill-up attachments for disposable staging files

## Tech Stack

Next.js App Router, TypeScript, Prisma, PostgreSQL, TanStack Query, Tailwind CSS,
Vitest, and Playwright.

## Documentation

- [Local development](docs/local-development.md) — install, configure, and run the app.
- [Database operations](docs/database.md) — Docker, DBeaver, backup, and restore.
- [Development commands](docs/commands.md) — testing, formatting, builds, and Prisma commands.
- [Architecture](docs/architecture.md) — feature organization, responsibilities, and data flow.
- [Fuel consumption](docs/features/consumption.md) — calculation rules and consumption displays.
- [Attachment storage](docs/development/attachments.md) — private staging storage and disposable-file checks.
- [Agent guidelines](AGENTS.md) — contribution workflow and coding standards.
- [Documentation rules](docs/documentation-rules.md) — where documentation belongs and how to update it.

Keep this README to basic project information and navigation. Detailed procedures and
command references belong in the linked guides.
