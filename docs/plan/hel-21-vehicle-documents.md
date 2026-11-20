# HEL-21: Vehicle documents

**Status:** Proposed follow-up to the read-only Vehicle Details work in PR #87.
This plan does not authorize implementation, remote migrations, or deployment.

## Goal

Save service-history PDFs, registration papers, and similar documents directly on a
vehicle. Users should be able to find and open them from Vehicle Details without
searching maintenance entries or entering Edit vehicle.

## User experience

- Add a **Documents** section below the existing fields in the shared Details dialog.
  Show one list of filenames that can be opened.
- Provide a separate **Manage documents** action for users with document write access.
  Reuse the existing attachment controls for upload, rename, and confirmed permanent
  deletion. Managing a file is independent of editing or saving vehicle information.
  Archiving and restoring individual documents are out of scope for this version.
- Show loading, empty, and retryable error states in the Documents section without
  hiding the basic vehicle fields. Refresh the document list after mutations.

## Access and limits

- All attachments use the same vehicle permissions: anyone with read access to
  the vehicle can list and open files, and owners and editors can also manage files.
  Signing in or having access to a different vehicle is not enough. Vehicle Edit
  remains owner-only.
- Accept the existing PDF, JPEG, PNG, and WebP formats, with a maximum of
  **4,000,000 bytes per file**. Use one shared limit of **10 attachments per parent**:
  each vehicle, expense, and fill-up has its own 10 slots. This raises the existing
  expense and fill-up limit from five to ten. At the cap, delete a file from that
  parent to free a slot. Do not move any existing files.

## Implementation slices

1. **Persistence:** Add a direct vehicle relation to `Attachment` and update the
   database constraint so exactly one parent is set: vehicle, expense, or fill-up.
   Existing rows keep their current parents and require no backfill. Test the
   migration on disposable local PostgreSQL.
2. **Server:** Use one shared flow for list, upload, open, rename, and delete across
   all parent types. Apply the same permissions and scope each operation to the
   authorized vehicle and exact parent type and ID. Authorize uploads before
   reading the request body. Reuse
   bounded file validation, rate limiting, private R2 storage, and the
   [existing signed Open flow](../development/attachments.md#open-an-attachment).
   Enforce the shared cap by locking the parent row before counting and holding
   the lock through metadata insertion.
3. **Shared format policy:** Keep one client-safe format policy in `lib/attachments/`.
   Derive the file picker's `accept` value, extension checks, and supported-format
   messages from it. Server-side byte verification remains authoritative. Make
   upload eligibility and inline viewing separate decisions so a new upload type
   isn't automatically served inline and retiring a type needn't break existing
   files. Keep the shared attachment limit separate from format policy.
4. **UI:** Extend the existing `RecordAttachments` component and attachment queries
   rather than building a separate vehicle uploader. Reuse upload, progress, errors,
   rename, and confirmed deletion. Render capacity from the server response instead
   of hard-coding the limit. Load the list when Vehicle Details opens, and use a vehicle
   document query key distinct from expense and fill-up attachment keys. Expose
   management controls only when the server confirms write access.

## Acceptance and rollout

- **Routes:** Owners and editors can manage documents; viewers can list and open
  documents but cannot upload, rename, or delete.
  Reject signed-out users and users without access to the target vehicle. For Open
  and each item mutation, reject IDs from another vehicle and expense or fill-up
  attachment IDs from the same vehicle. Denied operations must not touch R2 or
  change metadata. Verify that a cross-origin browser upload cannot create a document
  with a signed-in user's session.
- **File handling:** Accept all four supported formats across the shared flow.
  Reject oversized, unsupported, and extension/content mismatches before storing
  bytes. Lists must not expose object keys or signed URLs. Open checks current
  access before redirecting; already-issued links can work until expiry.
- **PostgreSQL:** Verify the migration preserves existing rows and rejects zero or
  multiple parents. For each parent type, start with nine attachments and race two
  uploads to the same parent: one succeeds, one gets a capacity error, and the total
  stays at ten. Permanent deletion frees a slot.
  Test storage and metadata failures without using real R2 credentials.
- **UI:** Verify open, upload, rename, and delete from Vehicle Details and its
  management flow. Verify viewer controls are absent, a failed list doesn't hide
  vehicle details, and mutations refresh the right list. Confirm all three parent
  types show ten slots and that expense and fill-up behavior is otherwise unchanged.
- **Rollout:** Manually test on staging with disposable files only. Retention,
  automatic object cleanup on vehicle deletion and partial failures, and tested
  recovery of file bytes are deferred. PostgreSQL backups do not include those bytes,
  and current staging flows can leave orphaned objects. See the
  [attachment storage guide](../development/attachments.md).

## Follow-up design: one saved-record dialog

**Phase 1 — proposed for review.** The original HEL-21 scope above leaves expense
and fill-up Details read-only. This follow-up deliberately changes that: vehicle,
expense, and fill-up Details become the common entry point for managing saved
files. [Viewing saved records](../features/records.md) describes current behavior
until each feature migrates.

### Desktop wireframes

Example: an expense that the user can edit. Fields are abbreviated. Each sketch
shows the **same dialog** at a different moment.

```text
VIEW
Expense details                                   ×
Record details                       [Edit details]
Date                 20 Nov 2026
Vendor               Auto Service
Amount               €84.00
───────────────────────────────────────────────────
Files (1)                            [Manage files]
receipt.pdf ↗
                                            [Close]

EDIT DETAILS
Edit expense                                      ×
Date                 [20 Nov 2026                ]
Vendor               [Auto Service               ]
Amount (€)           [84.00                      ]
                            [Cancel] [Save changes]

MANAGE FILES
Manage expense files                              ×
Auto Service · 20 Nov 2026
───────────────────────────────────────────────────
Files (1)
File changes are saved immediately.
[Choose file…                        ] [Upload file]
9 of 10 slots remaining
receipt.pdf ↗                     [Rename] [Delete]
                                             [Done]
```

### Phone wireframes

```text
VIEW                       EDIT DETAILS              MANAGE FILES
Expense details       ×    Edit expense         ×    Manage expense files  ×
Record details             Date                      Auto Service · 20 Nov
[Edit details]             [20 Nov 2026       ]      Files (1)
Date        20 Nov 2026    Vendor                    File changes are saved
Vendor     Auto Service    [Auto Service      ]      immediately.
Amount           €84.00    Amount (€)                [Choose file…         ]
───────────────────────    [84.00             ]      [Upload file]
Files (1)                                            9 of 10 slots remaining
[Manage files]                                       receipt.pdf ↗
receipt.pdf ↗              [Save changes]            [Rename] [Delete]
                           [Cancel]
[Close]                                              [Done]
```

Use one scrollable surface, rather than a scrolling file list inside a scrolling
dialog. Keep section actions beside headings when they fit; otherwise wrap them
below. Long filenames wrap without pushing actions off-screen. Use labeled,
touch-sized controls, visible keyboard focus, and file-specific accessible names
such as “Delete receipt.pdf”. Keep the edit footer reachable with the keyboard open.

### Interaction contract

| Action                                | Result                                                                                                                                                                                                                                                                                                                           |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Select vehicle name or record summary | Open View. Focus the dialog heading. Filenames open in a new tab without entering Manage files. Close, Escape, or outside press returns to the opener.                                                                                                                                                                           |
| Edit details from View                | Replace the summary with the existing prefilled form. Successful Save returns to the updated summary; Cancel returns without saving. Restore focus to Edit details.                                                                                                                                                              |
| Edit from ⋯ / More                    | Open the same dialog directly in Edit. Save or Cancel closes it rather than adding a trip through View. Keep existing list focus behavior after save and restore focus to the menu trigger after cancellation. Do not duplicate Details in the menu.                                                                             |
| Dismiss Edit                          | Escape or × follows Cancel. Confirm before discarding dirty fields; outside press does not dismiss. While saving, block dismissal. A save failure keeps the draft and shows the error beside the form.                                                                                                                           |
| Manage files from View                | Replace the summary with a focused file view in the same dialog. Focus the dialog title; show a short record identifier and immediate-save notice. Choosing a file does not upload it. Show supported formats, size limit, and server-reported capacity beside the picker. Confirm deletion by filename. Put Done in the footer. |
| Finish Manage files                   | Done or Escape returns to View and focuses Manage files. In a rename input, the first Escape cancels only the rename. × closes the dialog; outside press does not dismiss management. Exiting drops unsubmitted file selections or rename drafts, never completed file changes. Block exit during mutations and their refresh.   |

**Permissions and failures.** An expense owner or editor sees both actions. A
vehicle editor sees **Manage files** but not **Edit details**; a vehicle owner
sees both. Viewers see filenames only in the Files section. Field edit permission
comes from the record, independently of the file list. Show “Loading files…”
without a count, “No files yet” only after a successful empty response, and a
retry action on failure. File-list errors must not hide fields in View. If a refresh fails,
block file writes until retry succeeds; if access is denied, hide stale filenames
and management controls. At capacity, disable upload but leave deletion available.

### Reuse and review checkpoint

- Adapt `DetailsDialogContent` for the shared shell, mode transitions and focus.
  The feature supplies its summary, existing field form, and edit permission.
  Preserve the forms' validation and save logic; remove each old Edit shell as
  its two entry points migrate.
- Adapt `RecordAttachments` into one Files section. The parent selects the query
  and mutation target, never the layout. Details starts with links; **Save & add
  attachments** starts directly in management after creation. Use the existing
  hooks for list refresh and capacity. Field editors contain no file controls.
- **Review before Phase 2:** walk through correcting an expense amount from the
  menu, renaming its receipt from Details, and opening vehicle Details as an
  editor who can manage files but cannot edit fields. Approve the placement,
  labels and return paths before building the expense pilot.

### Creation follow-up (after the saved-record rollout)

Implemented for expenses and fill-ups. See [the creation flow](../features/records.md#attachments-after-creating-a-record) for current behavior.

Carry the same one-dialog interaction into **Add expense** and **Add fill-up**.
Keep ordinary **Save** as the fast path: create the record and close. With
**Save & add attachments**, create it once, then switch the same dialog to the
shared file manager for the new record ID. Show a brief saved summary rather
than a disabled creation form. **Done** closes the dialog; closing or retrying a
file upload must never undo or repeat creation. Preserve the inspection warning
when the expense was saved but its inspection-date update failed.

Review this flow after the saved-record dialogs: on a phone, can someone save a
fill-up, add a receipt, and leave knowing that both were saved?
