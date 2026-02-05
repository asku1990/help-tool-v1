# Plan

Lightweight rollout to let two users share all vehicles now, with a clear audit
trail. Start with Google OAuth + email allowlist, then add household access
rules. Save the full role-based sharing work for later.

## Current state

- Observed: GitHub-only OAuth with `ALLOWED_USERS` in `auth.ts`; long-form plan in
  `docs/multi_user_support/multi_user_plan.md`; no plan/log folders.
- Constraints/risks: Keep existing data linked to the same user email; avoid
  large schema changes; keep auth gate strict.
- Unknowns: Whether to run Google-only or dual-provider; whether read-only
  sharing is needed before full roles.

## Assumptions

- Only two users for now and all vehicles are shared.
- Google-only sign-in is acceptable for the short term.

## Scope

- In: Google OAuth + email allowlist, household access rules, audit trail docs.
- Out: VehicleAccess schema, sharing UI, admin board.

## Existing examples (if found)

- `auth.ts` allowlist gate and OAuth user creation.
- `docs/multi_user_support/multi_user_plan.md` (future, full RBAC plan).

## Plan artifact

- `docs/plan/multi-user-access-lite.md`

## Changelog

- `docs/logs/multi-user-access.md`: add an entry under `## [Unreleased]` after
  every checkpoint.

## Files to touch (estimate)

- `auth.ts`
- `example.env`
- `app/api/vehicles/**`
- `app/api/vehicles/[vehicleId]/**`
- `lib/api/*` (if shared access helpers are introduced)
- `docs/logs/multi-user-access.md`

## Decision + change trail rules

- Update the decision log whenever a decision changes (provider choice, access
  rules, rollout scope).
- After each checkpoint: add a change trail entry with summary, files, tests,
  and commit hash.
- If tests are skipped, record the reason in the change trail entry.

## Phased steps (checkpoints)

Phase 0: Documentation scaffold (this doc set)

- Create `docs/plan` and `docs/logs`.
- Add this plan and the log file.
- Commit: `docs: add multi-user access plan and log`.
- Tests: `pnpm test` (or note "not run, docs only").

Phase 1: Google OAuth + email allowlist (Google-only)

- Add Google provider and email allowlist (`ALLOWED_EMAILS`).
- Replace `ALLOWED_USERS` GitHub gate; enforce verified email.
- Ensure `user.id` is attached to session/JWT if needed by API checks.
- Update `example.env`.
- Commit: `feat(auth): add google oauth and email allowlist`.
- Tests: `pnpm test`.
- Log: decision on Google-only vs dual-provider.

Phase 2: Household access (shared vehicles)

- Define household access: any allowlisted user can access all vehicles.
- Update API access checks to allow household users without new schema.
- Record the new access rule in the decision log.
- Commit: `feat(access): allow household access to vehicles`.
- Tests: `pnpm test`.

Phase 3 (future): Role-based sharing + admin board

- Use `docs/multi_user_support/multi_user_plan.md` as the future scope.
- Commit/test per sub-phase.

## Action items

[ ] Confirm Google-only vs dual-provider decision and record it.
[ ] Implement Phase 1 (auth) and update the log.
[ ] Implement Phase 2 (household access) and update the log.
[ ] Decide when to start Phase 3 (role-based sharing).
[ ] Run `pnpm test` at every checkpoint.
[ ] Commit after every checkpoint with log updates.

## Validation

- `pnpm test`
- Manual sign-in as both users and verify shared vehicles (Phase 2).

## Open questions

- Keep GitHub provider in parallel or switch fully to Google?
- Need read-only sharing before full roles?
