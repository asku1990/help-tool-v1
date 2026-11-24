# Vehicle archive

**Status: proposed.** A sold car should leave the everyday vehicle list without losing its history. Archiving changes where the car appears for everyone with access. It does not transfer ownership, change editing permissions, or schedule deletion.

## Owner experience

1. **Archive.** On the vehicle overview, choose **More → Archive vehicle**. Place it above and visually apart from **Delete vehicle**, with the hint “Moves this car to Archived for everyone with access.” Archive is reversible: no confirmation dialog, sale date, or reason. Delete keeps its existing confirmation.
2. **Feedback.** After the server confirms, return to the Active list and announce “Volvo archived” using the actual vehicle name. A failed request keeps the current view and offers retry. The permanent Restore button is the recovery path in this version.
3. **Find history.** Put two labeled links, **Active** and **Archived**, below the Vehicles heading. Default `/car` to Active; use `/car?view=archived` so reload and browser Back preserve the view. Reuse the linked cards with name and plate; on archived cards replace inspection urgency with “Archived” and the locally formatted archive date. Sort archived cars most recently archived first.
4. **Restore later.** The same vehicle URL opens its records and summaries. On archived cars show an **Archived vehicle** banner instead of inspection urgency, with a visible **Restore vehicle** button for owners. **Back to vehicles** leads to Archived. After restoring, return to Active and announce the result. Editors and viewers can browse archived cars they already have access to.

Keep both list links visible on narrow screens, indicate the current view in text or styling and with `aria-current`, and move focus to the list heading after a successful transition. If Active is empty but the user has archived cars, show **No active vehicles** with **View archived vehicles**. Keep the existing first-car prompt for a genuinely empty garage. An empty Archived view says **No archived vehicles**. Loading or failed requests must not trigger an empty-state message.

## Implementation sequence

1. **Persistence and API.** Add nullable `Vehicle.archivedAtUtc` (`DateTime?`, `@db.Timestamptz(3)`) via a Prisma migration. Existing cars remain active. Extend `GET /api/vehicles` with a validated `status=active|archived` filter (default active), keeping the access predicate on both lists. Return the access-scoped `hasArchivedVehicles` flag only when the active list is empty. Include the archive timestamp in list and detail responses.
2. **Owner action.** Add `PUT /api/vehicles/[vehicleId]/archive` accepting `{ archived: boolean }`. Use the existing session, vehicle admin permission, validation, response, and rate-limit helpers. Set the server timestamp only on an active-to-archived transition; restore clears it. Repeating either request succeeds without changing the archive date. Keep the vehicle ID, access rows, attachments, and child records intact. Apply the status filter to list discovery, not to detail or record authorization.
3. **Client and navigation.** Add typed requests and a mutation hook. Give Active and Archived separate list keys under the existing vehicle-list prefix in `queries/keys.ts`; refresh both lists and vehicle detail after mutations. Wire the controls into `app/car/page.tsx` and `app/car/[vehicleId]/page.tsx`. Disable repeated submissions while pending. Announce success on the destination list.
4. **Ship and document.** Once implemented, update the [vehicle guide](../features/vehicles.md) with the shipped behavior.

## Acceptance checks

- **Sold-car round trip:** Archive the only active car, reload, open it from Archived, and find a previously saved expense. Restore after the toast is gone; the original vehicle URL and expense still work, and the car appears only in Active.
- **Failure:** A rejected archive or restore offers retry without reporting success or navigating away.
- **Shared access:** Another member sees the car in Archived after refresh. Editors and viewers cannot archive or restore through either UI or API; an unrelated user cannot discover the car in either list or change its state.
- **Regression:** Existing cars start active; repeated archive requests preserve the first timestamp; restoring brings back the inspection status. Verify keyboard navigation, focus after actions, and the layout on a phone-sized screen.
