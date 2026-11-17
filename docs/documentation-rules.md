# Documentation Rules

Read this file before planning or changing code or documentation. It owns documentation
placement, detail level, and update rules. Read the relevant architecture, feature, and
operational guides too; this file is not a substitute for understanding the area being changed.

## Where Information Belongs

- [README.md](../README.md): basic project purpose, implemented features, tech stack, and
  navigation. No detailed setup, command catalogs, restore procedures, or feature specifications.
- [AGENTS.md](../AGENTS.md): agent workflow, coding and validation standards, and required
  reading. Link to documentation rules rather than duplicating them.
- [Architecture](architecture.md): system structure, module responsibilities, dependency
  direction, cache ownership, and security responsibilities. Not feature formulas, UI colors,
  or operational command recipes.
- `docs/features/<feature>.md`: implemented business rules, calculation contracts, edge cases,
  and UI behavior for one feature. For example, [consumption](features/consumption.md) owns
  fuel formulas, averaging windows, partial-fill rules, and badge color meaning.
- [Local development](local-development.md): prerequisites, setup order, environment loading,
  and starting the app.
- [Database operations](database.md): Docker lifecycle, database connections, backup and
  restore procedures, target verification, and destructive-operation warnings.
- [Development commands](commands.md): development, validation, build, and Prisma command
  reference. Link to task-specific procedures instead of reproducing them.
- `docs/plan/`, `docs/logs/`, and existing feature plans: proposed work, rollout checkpoints,
  and history. Clearly distinguish plans from implemented behavior; do not use an old plan
  to override the current architecture or feature contract.

## Before Editing

1. Find and read the existing document that owns the topic and the relevant implementation.
2. Extend that document rather than creating another competing source of truth.
3. If no owning document exists, choose the location above and create a focused guide.
4. If documentation and implementation disagree, identify the discrepancy. Do not silently
   change architectural rules to justify code you already wrote.

## Writing and Updating

- Keep one maintained source for each rule or procedure. Other documents should summarize
  briefly and link to it, not copy the specification.
- Update the owning guide in the same change as the behavior it describes. A UI-only feature
  change does not require an architecture update.
- Explain non-obvious rules and their rationale, but avoid code dumps and line-by-line
  implementation walkthroughs. Reference implementation paths when useful.
- Separate ordinary setup from optional tooling and advanced operations. Do not label a tool
  optional while making all primary instructions depend on it.
- State command prerequisites, working directory, target environment, and expected outcome.
  Place destructive-operation warnings before the command, not afterward.
- Never include real credentials, resolved secrets, or database contents. Use clearly marked
  examples and keep dumps in ignored local storage.
- When moving content, update incoming links and remove the old copy. Do not leave obsolete
  instructions that claim to be authoritative.

## Validation

- Check that linked local files and heading anchors exist after changes.
- Format touched Markdown files and check the diff for unrelated changes.
- Verify commands against the actual scripts and configuration. Distinguish static checks
  from executed tests; never claim an unrun workflow has been verified.
