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
- Decision: Google-only provider for Phase 1 auth.
- Rationale: Reduce setup and keep the auth gate strict for a two-user rollout.
- Alternatives: Keep GitHub provider in parallel.
- Consequences: Existing users must sign in with Google email.

## Change trail

All entries must include a concrete change list (bullets that describe what
changed, not just file names). Do not leave this section vague.

### [Unreleased]

- Summary: Phase 1 auth changes (Google OAuth + email allowlist + UI update).
- Changes:
  - Switched NextAuth provider to Google-only and enforced verified email.
  - Replaced username allowlist with `ALLOWED_EMAILS` (email allowlist).
  - Added JWT/session user id attachment for API access.
  - Generated usernames from email local-part with uniqueness handling.
  - Updated sign-in UI and copy to Google; fixed related tests.
  - Updated example env and CI dummy auth variables to Google.
- Files: `auth.ts`, `example.env`, `.github/workflows/ci.yml`,
  `components/buttons/SignInButton.tsx`, `components/buttons/__tests__/SignInButton.test.tsx`,
  `app/page.tsx`, `app/auth/error/__tests__/page.test.tsx`,
  `docs/logs/multi-user-access.md`
- Tests: `pnpm test` (warnings about DialogContent descriptions, localstorage
  file flag, and layout hydration warning).
- Commit: (pending)
- Notes: N/A

### 2026-02-05 (Phase 0)

- Summary: Add plan and log docs for the multi-user access rollout.
- Files: `docs/plan/multi-user-access-lite.md`, `docs/logs/multi-user-access.md`,
  `docs/multi_user_support/multi_user_plan.md`
- Tests: `pnpm test` (warnings about DialogContent descriptions and localstorage
  file flag).
- Commit: 9e554f7
- Notes: N/A

### Template

- Date:
- Summary:
- Changes:
- Tests:
- Files:
- Commit:
- Notes:
