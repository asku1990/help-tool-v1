# Multi-user access log

## Purpose

- Track decisions and change trail for the multi-user access rollout.
- Record what changed, why it changed, and how it was validated.

## Decision log

### 2026-02-05

- Decision: Use a lightweight rollout (Google OAuth + household access) before
  full role-based sharing.
- Rationale: Share with a second user quickly; avoid schema and UI work now.
- Alternatives: Full VehicleAccess + sharing UI now; dual-provider auth.
- Consequences: All allowlisted users see all vehicles until RBAC is added.
- Revisit: When per-vehicle sharing or an admin board is needed.

## Change trail

### [Unreleased]

- Summary: Add plan and log docs for the multi-user access rollout.
- Files: `docs/plan/multi-user-access-lite.md`, `docs/logs/multi-user-access.md`,
  `docs/multi_user_support/multi_user_plan.md`
- Tests: `pnpm test` (warnings about DialogContent descriptions and localstorage
  file flag).
- Commit: (pending)
- Notes: N/A

### Template

- Date:
- Summary:
- Files:
- Tests:
- Commit:
- Notes:
