# Vehicle Sharing & Google Auth Implementation Plan

## Overview

Enable multi-user vehicle sharing with role-based access while adding Google OAuth for non-GitHub users. The owner (you) can share vehicles through the UI with other users (e.g., your wife). Sharing is OWNER-only, and users must exist (signed in at least once) before they can be added.

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        Auth Layer                               │
├─────────────────────────────────────────────────────────────────┤
│  GitHub OAuth  ──┐                                              │
│                  ├──▶ Email Allowlist ──▶ User created/matched  │
│  Google OAuth  ──┘                                              │
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

## Phase 1: Google OAuth Provider

### Changes to `auth.ts`

1. Add Google provider import and configuration
2. Switch from GitHub username allowlist to **email-based allowlist**
3. Handle both GitHub and Google profile structures
4. Enforce verified email for Google

### Environment Variables

```env
# Existing
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...

# New
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# Change from GitHub usernames to emails
ALLOWED_EMAILS=you@email.com,wife@email.com
```

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI: `https://your-domain/api/auth/callback/google`
4. Copy Client ID and Client Secret to env vars

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

For existing vehicles, OWNER access entries are created automatically when running `pnpm prisma migrate dev`. The migration file will include:

```sql
-- Auto-generated migration: create OWNER access for existing vehicles
INSERT INTO "VehicleAccess" (id, "vehicleId", "userId", role, "createdAt")
SELECT gen_random_uuid(), v.id, v."userId", 'OWNER', NOW()
FROM "Vehicle" v
ON CONFLICT DO NOTHING;
```

This ensures all current vehicles get proper OWNER access for their existing owners.

### Effort: ~0.5 day

---

## Phase 3: API Access Control Updates

### New Shared Helper: `lib/api/vehicle-access.ts`

```typescript
import { prisma } from '@/lib/db';
import { VehicleRole } from '@/generated/prisma';

export type AccessLevel = 'read' | 'write' | 'admin';

const ROLE_PERMISSIONS: Record<VehicleRole, AccessLevel[]> = {
  OWNER: ['read', 'write', 'admin'],
  EDITOR: ['read', 'write'],
  VIEWER: ['read'],
};

export async function getVehicleAccess(
  vehicleId: string,
  userEmail: string
): Promise<{ vehicle: Vehicle; role: VehicleRole } | null> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
    select: { id: true },
  });
  if (!user) return null;

  const access = await prisma.vehicleAccess.findFirst({
    where: { vehicleId, userId: user.id },
    include: { vehicle: true },
  });

  return access ? { vehicle: access.vehicle, role: access.role } : null;
}

export function hasPermission(role: VehicleRole, level: AccessLevel): boolean {
  return ROLE_PERMISSIONS[role].includes(level);
}

export async function canAccessVehicle(
  vehicleId: string,
  userEmail: string,
  requiredLevel: AccessLevel = 'read'
): Promise<boolean> {
  const access = await getVehicleAccess(vehicleId, userEmail);
  return access ? hasPermission(access.role, requiredLevel) : false;
}
```

### API Routes to Update

| Route                              | Current Check  | New Check                              |
| ---------------------------------- | -------------- | -------------------------------------- |
| `GET /api/vehicles`                | `userId` match | VehicleAccess membership               |
| `GET /api/vehicles/[vehicleId]`    | owner email    | `canAccessVehicle(id, email, 'read')`  |
| `PATCH /api/vehicles/[vehicleId]`  | owner email    | `canAccessVehicle(id, email, 'admin')` |
| `DELETE /api/vehicles/[vehicleId]` | owner email    | `canAccessVehicle(id, email, 'admin')` |
| `GET .../fillups`                  | owner email    | `canAccessVehicle(id, email, 'read')`  |
| `POST .../fillups`                 | owner email    | `canAccessVehicle(id, email, 'write')` |
| `GET .../expenses`                 | owner email    | `canAccessVehicle(id, email, 'read')`  |
| `POST .../expenses`                | owner email    | `canAccessVehicle(id, email, 'write')` |
| `GET .../tires`                    | owner email    | `canAccessVehicle(id, email, 'read')`  |
| `POST .../tires`                   | owner email    | `canAccessVehicle(id, email, 'write')` |
| `DELETE .../clear`                 | owner email    | `canAccessVehicle(id, email, 'admin')` |
| `GET .../export`                   | owner email    | `canAccessVehicle(id, email, 'read')`  |

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

### Integration Tests

- Test OWNER can share vehicles
- Test EDITOR can add data but not delete vehicle
- Test VIEWER can only read data
- Test access revocation

---

## Notes

- **UserType** (ADMIN/REGULAR/GUEST) remains unused for now; could be used for app-level admin features later
- **Vehicle.userId** kept for backward compatibility and as "original owner" reference
- **Explicit email allowlist** remains the auth gate — users must be in `ALLOWED_EMAILS` to sign in at all
- No invite flow yet: sharing only works for users who already exist in the database (i.e., have signed in before)
- Consider temporarily supporting `ALLOWED_USERS` for backward compatibility if production already uses it

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
