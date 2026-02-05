# Status (2026-02-05)

This document is the long-form future plan. For the current lightweight rollout
with checkpoints, use:

- `docs/plan/multi-user-access-lite.md`
- `docs/logs/multi-user-access.md`

Keep this file as the future RBAC/admin plan and do not execute all phases at
once.

# Vehicle Sharing & Google Auth Implementation Plan

## Goal

Allow multiple users to sign in via Google and share vehicles with role-based access when needed.

## Overview

Enable multi-user vehicle sharing with role-based access while adding Google OAuth (Google-only). The owner (you) can share vehicles through the UI with other users (e.g., your wife). Sharing is OWNER-only, and users must exist (signed in at least once) before they can be added. `VehicleAccess` is the single source of truth for ownership and access (no duplicate owner fields).

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        Auth Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  Google OAuth  ──▶ Email Allowlist ──▶ User created/matched     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Access Control                              │
├─────────────────────────────────────────────────────────────────┤
│  User ──▶ VehicleAccess (role: OWNER|EDITOR|VIEWER) ──▶ Vehicle │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Google OAuth Provider (Google-only)

### Changes to `auth.ts`

1. Add Google provider import and configuration
2. Use **email-based allowlist** for auth gating
3. Enforce verified email for Google
4. Remove GitHub provider configuration
5. Ensure `user.id` is available in API routes (add `jwt` + `session` callbacks to attach the DB user id)
6. Replace GitHub-username-based `ALLOWED_USERS` logic with email allowlist checks
7. Update user creation to handle Google profiles (generate a unique `username` from email local-part or fallback)

### Environment Variables

```env
# New
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Email allowlist
ALLOWED_EMAILS=you@email.com,wife@email.com
```

Note: Remove or ignore legacy `AUTH_GITHUB_*` env vars after switching to Google-only. Drop `ALLOWED_USERS` support in favor of `ALLOWED_EMAILS`. Update `example.env` accordingly.

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain/api/auth/callback/google`
4. Copy Client ID and Client Secret to env vars

### Transition Note

If your existing account email differs from your Google email, update `User.email` to the Google email before switching to Google-only so your existing data stays linked. Ensure the Google email is also included in `ALLOWED_EMAILS`.

### Effort: ~0.5-1 day

---

## Phase 2: VehicleAccess Schema

### New Prisma Schema Additions

```prisma
enum VehicleRole {
  OWNER
  EDITOR
  VIEWER
}

model VehicleAccess {
  id        String      @id @default(uuid())
  vehicleId String
  userId    String
  role      VehicleRole
  createdAt DateTime    @default(now())

  vehicle   Vehicle     @relation(fields: [vehicleId], references: [id], onDelete: Cascade)
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([vehicleId, userId])
  @@index([userId])
  @@index([vehicleId])
}
```

### Update Existing Models

```prisma
model User {
  // ... existing fields
  vehicleAccess VehicleAccess[]
}

model Vehicle {
  // ... existing fields
  access VehicleAccess[]
}
```

### Data Migration Strategy

For existing vehicles, OWNER access entries should be created after the Prisma migration file is generated. Use a dedicated data migration script (or SQL inside the migration) to backfill `VehicleAccess` rows for current `Vehicle.userId` owners so the access model is complete after deploy.

### Migration File Backfill (Post-Generation)

After running `pnpm prisma migrate dev` to generate the migration, edit the migration file to move owner data into `VehicleAccess`.

Suggested SQL (PostgreSQL):

```sql
INSERT INTO "VehicleAccess" ("id", "vehicleId", "userId", "role", "createdAt")
SELECT gen_random_uuid(), v."id", v."userId", 'OWNER', NOW()
FROM "Vehicle" v
WHERE v."userId" IS NOT NULL
ON CONFLICT ("vehicleId", "userId") DO NOTHING;
```

Notes:

- If `gen_random_uuid()` is unavailable, enable `pgcrypto` or replace with `uuid_generate_v4()` (requires `uuid-ossp`).
- Keep this in the same migration that introduces the `VehicleAccess` table.
- This is a one-time backfill; do not rely on it for future ownership writes.

**Safe Migration Strategy**:

1. Make `Vehicle.userId` optional (or leave as is).
2. Stop reading/writing to `Vehicle.userId` in the application code (use `VehicleAccess` instead).
3. **Do not drop** the `Vehicle.userId` column in this phase. Keep it as a backup for potential rollback. We can remove the column in a future cleanup release.

### Effort: ~0.5 day

---

## Phase 3: API Access Control Updates

### New Shared Helper: `lib/api/vehicle-access.ts`

```typescript
import { prisma } from '@/lib/db';
import { VehicleRole } from '@/generated/prisma';

export type AccessLevel = 'read' | 'write' | 'admin';
// Prefer session userId from auth() over email lookups for access checks.

const ROLE_PERMISSIONS: Record<VehicleRole, AccessLevel[]> = {
  OWNER: ['read', 'write', 'admin'],
  EDITOR: ['read', 'write'],
  VIEWER: ['read'],
};

export async function getVehicleAccess(
  vehicleId: string,
  userId: string
): Promise<{ vehicle: Vehicle; role: VehicleRole } | null> {
  const access = await prisma.vehicleAccess.findFirst({
    where: { vehicleId, userId },
    include: { vehicle: true },
  });

  return access ? { vehicle: access.vehicle, role: access.role } : null;
}

export function hasPermission(role: VehicleRole, level: AccessLevel): boolean {
  return ROLE_PERMISSIONS[role].includes(level);
}

export async function canAccessVehicle(
  vehicleId: string,
  userId: string,
  requiredLevel: AccessLevel = 'read'
): Promise<boolean> {
  const access = await getVehicleAccess(vehicleId, userId);
  return access ? hasPermission(access.role, requiredLevel) : false;
}
```

### New Vehicle Creation

When creating a new vehicle, also create an OWNER `VehicleAccess` record in the same flow so the creator always has access.

### Session User ID Requirement

All access checks should use the authenticated user's database id (from `auth()`), not email. If `auth()` only provides email, add NextAuth callbacks to attach `user.id` to the JWT/session or perform a lookup once per request (less ideal).

### API Routes to Update

| Route                              | Current Check  | New Check                               |
| ---------------------------------- | -------------- | --------------------------------------- |
| `GET /api/vehicles`                | `userId` match | VehicleAccess membership                |
| `GET /api/vehicles/[vehicleId]`    | owner email    | `canAccessVehicle(id, userId, 'read')`  |
| `PATCH /api/vehicles/[vehicleId]`  | owner email    | `canAccessVehicle(id, userId, 'admin')` |
| `DELETE /api/vehicles/[vehicleId]` | owner email    | `canAccessVehicle(id, userId, 'admin')` |
| `GET .../fillups`                  | owner email    | `canAccessVehicle(id, userId, 'read')`  |
| `POST .../fillups`                 | owner email    | `canAccessVehicle(id, userId, 'write')` |
| `GET .../expenses`                 | owner email    | `canAccessVehicle(id, userId, 'read')`  |
| `POST .../expenses`                | owner email    | `canAccessVehicle(id, userId, 'write')` |
| `GET .../tires`                    | owner email    | `canAccessVehicle(id, userId, 'read')`  |
| `POST .../tires`                   | owner email    | `canAccessVehicle(id, userId, 'write')` |
| `DELETE .../clear`                 | owner email    | `canAccessVehicle(id, userId, 'admin')` |
| `GET .../export`                   | owner email    | `canAccessVehicle(id, userId, 'read')`  |

### Route Files to Modify (~12 files)

```
app/api/vehicles/route.ts
app/api/vehicles/[vehicleId]/route.ts
app/api/vehicles/[vehicleId]/clear/route.ts
app/api/vehicles/[vehicleId]/export/route.ts
app/api/vehicles/[vehicleId]/fillups/route.ts
app/api/vehicles/[vehicleId]/fillups/[fillUpId]/route.ts
app/api/vehicles/[vehicleId]/expenses/route.ts
app/api/vehicles/[vehicleId]/expenses/[expenseId]/route.ts
app/api/vehicles/[vehicleId]/tires/route.ts
app/api/vehicles/[vehicleId]/tires/[tireSetId]/route.ts
app/api/vehicles/[vehicleId]/tires/change-log/route.ts
app/api/vehicles/[vehicleId]/tires/change-log/[logId]/route.ts
```

### Effort: ~2-3 days

---

## Phase 4: Sharing API Endpoints

### New Routes

```
POST   /api/vehicles/[vehicleId]/access     - Share vehicle with user (existing users only)
GET    /api/vehicles/[vehicleId]/access     - List users with access
PATCH  /api/vehicles/[vehicleId]/access/[userId] - Update role
DELETE /api/vehicles/[vehicleId]/access/[userId] - Revoke access
```

### Request/Response Examples

**Share vehicle:**

```json
POST /api/vehicles/abc123/access
{
  "email": "wife@email.com",
  "role": "EDITOR"
}

Response:
{
  "data": {
    "id": "access-id",
    "userId": "user-id",
    "email": "wife@email.com",
    "role": "EDITOR"
  }
}
```

**List access:**

```json
GET /api/vehicles/abc123/access

Response:
{
  "data": {
    "access": [
      { "userId": "...", "email": "you@email.com", "role": "OWNER" },
      { "userId": "...", "email": "wife@email.com", "role": "EDITOR" }
    ]
  }
}
```

### Effort: ~1 day

---

## Phase 5: Sharing UI

### Components to Create

```
components/car/sharing/
├── index.ts
├── VehicleAccessList.tsx      - Shows who has access
├── ShareVehicleDialog.tsx     - Dialog to add new user
├── AccessRoleBadge.tsx        - Role badge (OWNER/EDITOR/VIEWER)
└── RemoveAccessButton.tsx     - Remove user access
```

### Vehicle Settings Page Update

Add a "Sharing" section to the vehicle detail page:

```
┌─────────────────────────────────────────────────────┐
│ BMW 320d                                            │
├─────────────────────────────────────────────────────┤
│ [Fill-ups] [Expenses] [Tires] [Settings] [Sharing]  │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ Shared with                                         │
├─────────────────────────────────────────────────────┤
│ 👤 you@email.com              OWNER                 │
│ 👤 wife@email.com             EDITOR      [Remove]  │
├─────────────────────────────────────────────────────┤
│ [ + Share with someone ]                            │
└─────────────────────────────────────────────────────┘
```

### Share Dialog

```
┌─────────────────────────────────────────────────────┐
│ Share "BMW 320d"                              [X]   │
├─────────────────────────────────────────────────────┤
│                                                     │
│ Email address                                       │
│ ┌─────────────────────────────────────────────────┐ │
│ │ wife@email.com                                  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Role                                                │
│ ┌─────────────────────────────────────────────────┐ │
│ │ EDITOR                                        ▼ │ │
│ └─────────────────────────────────────────────────┘ │
│ Can add and edit fill-ups, expenses, and tires     │
│                                                     │
│              [ Cancel ]  [ Share ]                  │
└─────────────────────────────────────────────────────┘
```

### Effort: ~2-3 days

---

## Role Permissions Matrix

| Action                                  | OWNER | EDITOR | VIEWER |
| --------------------------------------- | :---: | :----: | :----: |
| View vehicle & all data                 |  ✅   |   ✅   |   ✅   |
| Add fill-ups                            |  ✅   |   ✅   |   ❌   |
| Edit/delete fill-ups                    |  ✅   |   ✅   |   ❌   |
| Add expenses                            |  ✅   |   ✅   |   ❌   |
| Edit/delete expenses                    |  ✅   |   ✅   |   ❌   |
| Manage tires                            |  ✅   |   ✅   |   ❌   |
| Export data                             |  ✅   |   ✅   |   ✅   |
| Edit vehicle settings                   |  ✅   |   ❌   |   ❌   |
| Delete vehicle                          |  ✅   |   ❌   |   ❌   |
| Clear all vehicle data                  |  ✅   |   ❌   |   ❌   |
| Share with others (existing users only) |  ✅   |   ❌   |   ❌   |
| Remove shared users                     |  ✅   |   ❌   |   ❌   |

---

## Implementation Order

### Week 1

- [ ] **Phase 1:** Add Google OAuth provider
- [ ] **Phase 2:** Create VehicleAccess schema + migration

### Week 2

- [ ] **Phase 3:** Update all API routes with new access checks
- [ ] **Phase 4:** Create sharing API endpoints

### Week 3

- [ ] **Phase 5:** Build sharing UI components
- [ ] Integration testing & polish

---

## Test Updates Required

### Unit Tests

- Update vehicle API route tests to use VehicleAccess
- Add tests for access helper functions
- Add tests for sharing endpoints
- Update `auth()` mocks to include `user.id` if using session id

### Integration Tests

- Test OWNER can share vehicles
- Test EDITOR can add data but not delete vehicle
- Test VIEWER can only read data
- Test access revocation
- Update fixtures to create `VehicleAccess` rows instead of relying on `Vehicle.userId`

---

## Notes

- **UserType** (ADMIN/REGULAR/GUEST) remains unused for now; could be used for app-level admin features later
- **Vehicle.userId** kept for backward compatibility and as "original owner" reference; do not use it for auth or access checks
- **Explicit email allowlist** remains the auth gate — users must be in `ALLOWED_EMAILS` to sign in at all (Google-only)
- No invite flow yet: sharing only works for users who already exist in the database (i.e., have signed in before)
- `VehicleAccess` is the only ownership/access source; do not keep `Vehicle.userId` as a parallel owner field
- `example.env` must be updated to reflect Google-only auth and `ALLOWED_EMAILS`

---

## Total Effort Estimate

| Phase                 | Effort        |
| --------------------- | ------------- |
| Phase 1: Google OAuth | 0.5-1 day     |
| Phase 2: Schema       | 0.5 day       |
| Phase 3: API updates  | 2-3 days      |
| Phase 4: Sharing API  | 1 day         |
| Phase 5: Sharing UI   | 2-3 days      |
| Testing & polish      | 1-2 days      |
| **Total**             | **7-11 days** |
