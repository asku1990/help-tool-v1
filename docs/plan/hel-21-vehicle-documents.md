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
