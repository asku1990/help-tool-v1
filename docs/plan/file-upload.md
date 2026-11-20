# File uploads: first staging version

Status: implementation in reviewable slices. The previous attachment implementation has been removed. This
document does not authorize deployment, remote migrations, or cloud configuration changes.

This plan describes the original five-slot rollout. See the
[attachment storage guide](../development/attachments.md) for the current limit.

## Goal

Attach disposable test receipts and maintenance reports to already-saved expenses
of every category and saved fuel fill-ups. Keep the first implementation small.

## User experience

- Open an existing record, select one file, and press a separate **Upload** button.
- Uploading is independent of saving record edits. Creation dialogs also offer a
  save-first attachment step; see the approved follow-up below.
- Show upload progress, errors, and a retry action.
- Reopening a record shows saved filenames and remaining attachment capacity.
- Owners and editors may upload; viewers may not.
- All vehicle roles may list attachment filenames and capacity; private object keys are not exposed.
- Accept PDF, JPG/JPEG, PNG, and WebP; at most five attachments per record.

## Confirmed size limit

The earlier requirement was 10,000,000 bytes per file. Vercel Functions have a
4.5 MB request-body limit, including request overhead.

**Confirmed file limit: 4,000,000 bytes, one file per request.** Use binary multipart
uploads, not base64. The earlier 10 MB limit does not apply to this slice.

Reference: <https://vercel.com/docs/functions/limitations#request-body-size>.

## Simple upload flow

1. Browser sends the file to an authenticated application endpoint.
2. Server checks owner/editor permission and that the expense or fuel fill-up belongs
   to the authorized vehicle.
3. Server checks actual file size and content, not only extension or declared MIME.
4. Server enforces the five-attachment limit, including concurrent requests, using
   a database transaction with a parent-row lock acquired before counting attachments
   and held through metadata insertion and commit. Bound R2 request and transaction
   durations; no distributed reservation service is needed.
5. Server generates one unpredictable object key and stores the validated file once
   in a private R2 bucket.
6. Server saves attachment metadata and returns success after the database commit.

Keep transaction and R2 failure handling together in a small upload module. A repeated
user upload is a new attachment; this slice does not promise exactly-once delivery.
Refresh the attachment list after an uncertain failure before offering a manual retry;
a lost success response followed by retry may create a duplicate.

## Metadata

Use a small attachment table with:

- ID.
- Explicit, mutually exclusive expense/fuel fill-up references with database relations.
- Enforce exactly one parent with a database CHECK constraint, not only application validation.
- Original filename, one unique R2 object key, verified content type, and size in bytes.
- `createdAtUtc` and `updatedAtUtc`, following [architecture guidance](../architecture.md).

Do not add temporary/final object keys, validation leases, recovery tokens, or a
persisted multi-stage upload state machine. Render in-progress/error states in the UI;
persisted attachment rows represent successfully saved attachments.

## Failures and accepted staging limitations

- Reject invalid or unauthorized requests before storing a file.
- Return a useful error when uploading fails; retry is user initiated.
- If R2 succeeds but the database write/commit fails, attempt to delete the object.
- If the process crashes or that deletion fails, an orphaned disposable object may remain.
  Manual staging-bucket cleanup is accepted for this slice.
- No scheduled cleanup, queue, worker, automatic recovery, or temporary-object sweeps.
  This supersedes the earlier automatic-cleanup requirement.
- Cascade attachment metadata deletion with parent deletion. R2 deletion on parent
  deletion is deferred, so the corresponding disposable objects may remain.
- Do not use real documents. Orphans and parent deletion are not production-safe lifecycle
  guarantees.

## Tests and acceptance

- Valid uploads work for both parent types, and filenames persist after reopening.
- Owner/editor permissions work; unauthenticated, viewer, and cross-car requests fail.
- Unsupported, misleading-content, and oversized files are rejected.
- Concurrent uploads cannot exceed five attachments; failed uploads do not consume slots.
- R2 and database failures return errors; a failed database save triggers deletion attempt.
- UI displays progress, success, failure, retry, and capacity.
- Use PostgreSQL-backed tests for the concurrency guarantee, not mocks alone.

The separately scoped expense DELETE cross-car authorization fix and its tests remain.

## Review slices

1. Persistence: attachment schema, generated migration, and database-constraint tests.
2. Backend: upload/listing, authorization, validation, R2, concurrency, and failure tests.
3. UI: shared upload control, filename list, progress/error/retry, and both edit forms.

Stop after each slice for approval. Do not commit automatically. Generate and test
migrations against a disposable local PostgreSQL database, not a remote environment.

### Slice 1 migration and validation

Follow the [local database workflow](../development/database.md) to verify the target
and load `.env.local` explicitly. Generate with `--name add_attachments --create-only`.
Before applying the new migration, add the CHECK constraint Prisma cannot express:

```sql
ALTER TABLE "Attachment"
ADD CONSTRAINT "Attachment_exactly_one_parent"
CHECK (("expenseId" IS NOT NULL) <> ("fuelFillUpId" IS NOT NULL));
```

Verify cascading parent foreign keys, unique `objectKey`, parent indexes, and
`TIMESTAMPTZ(3)` UTC timestamps. Apply only locally, then regenerate the Prisma client.

With Docker running, execute the persistence suite:

```bash
RUN_INTEGRATION=1 pnpm exec vitest run prisma/__tests__/attachment.int.test.ts
```

It applies migration files to a disposable PostgreSQL 16 container using an explicit
container URL, not the application's database. It checks parent constraints,
uniqueness, persistence, and cascading deletion. Without `RUN_INTEGRATION=1`, it is
skipped. Five-attachment concurrency tests belong to slice 2.

Also run:

```bash
pnpm type-check
pnpm exec eslint prisma/__tests__/attachment.int.test.ts
pnpm exec prettier --check README.md docs/development/database.md docs/plan/file-upload.md prisma/__tests__/attachment.int.test.ts
```

### Slice 2 backend

- `GET`/`POST /api/vehicles/:vehicleId/expenses/:expenseId/attachments`
- `GET`/`POST /api/vehicles/:vehicleId/fillups/:fillUpId/attachments`
- POST expects exactly one multipart `file` field. GET returns safe metadata and capacity.
- Upload/listing use the existing session, vehicle-role checks, and IP/path rate limiter.
- Limits/validation failures return 400/413/415; full records return 409.
- Storage/database failures return 500 with a refresh-before-retry message.

The installed `file-type` version requires **Node.js 22+**, including the staging
runtime. Content validation checks detected binary signatures against the supported
format, extension, and declared MIME (generic/absent MIME is allowed); this is not
full document parsing or malware scanning.

Follow the [attachment storage setup guide](../development/attachments.md).
Configure the server-only `ATTACHMENTS_R2_*` variables listed in `example.env` using
a separate private staging bucket and bucket-scoped credentials. The database-backup
script and its `R2_*` settings remain unchanged. This change does not create buckets,
configure credentials, or authorize deployment.

Run all attachment backend and persistence checks with Docker running:

```bash
RUN_INTEGRATION=1 pnpm exec vitest run lib/attachments prisma/__tests__/attachment.int.test.ts
```

Storage tests mock R2; they do not contact a real bucket. The concurrency tests use
real PostgreSQL and observe a row-lock wait with two simultaneous uploads.

### Slice 3 UI and manual staging check

Both saved-record edit dialogs include a shared attachment panel below (not inside)
the edit form. Selecting a file does not upload it; **Upload** is a separate action.
Creation forms initially stayed unchanged; the approved save-first follow-up below extends them.
The listing response includes `canUpload`, derived
from the caller's vehicle role; viewers see filenames and capacity without upload controls.

XHR reports byte-transfer progress. Reaching 100% is not treated as success until the
server confirms persistence. The filename list refreshes after success and failure;
if that refresh fails, upload/retry stays blocked until a manual refresh succeeds.
Uploads are never automatically retried. Save and dialog dismissal stay disabled
during an upload; leaving the page cancels the browser request, not necessarily a
server upload that has already committed.

Before treating the feature as ready for staging use, manually check with disposable files:

1. Configure the separate private staging attachment bucket/credentials and sign in.
2. Open a saved expense and a saved fill-up. Select a supported file and press Upload
   without saving record edits. Confirm progress, success, filename, and remaining capacity.
3. Close and reopen each record; filenames and capacity should persist.
4. Check a full record, an oversized/unsupported file, and a failed upload with manual retry.
5. As a viewer, confirm metadata is visible but upload controls are absent.

Automated UI tests mock the query/transport seam; they do not validate real R2
credentials or replace this signed-in, end-to-end check.

## Approved follow-up: open saved files

Each filename is a link targeting a new tab. It calls an authenticated
`GET .../attachments/:attachmentId/open` endpoint for the expense/fill-up. The lookup
scopes the attachment, parent, and authorized vehicle together and permits read access
for owners, editors, and viewers. No signed URLs or object keys enter the listing response.

The endpoint returns an uncached redirect to a **2-minute signed R2 GET URL** with
the verified PDF/JPEG/PNG/WebP content type, an escaped `inline` filename, and a
`private, no-store` object response. Links use `noopener noreferrer`; HTML/SVG are
not served inline. The bucket remains private and no additional credentials are needed.

A signed URL is a temporary bearer capability: anyone holding it can use it until
expiry without another app check. Clicking Open again performs a new authorization
check and generates a fresh link. Browser settings may still cause a PDF download.
An embedded preview, explicit download action, and object lifecycle changes are out of scope.

Manual check: open a disposable PDF and image from each parent type, including as a
viewer. Confirm the new tab works while the bucket stays private; return to the
record to generate a fresh link after expiry.

## Approved follow-up: delete saved files

Owners and editors can delete an individual attachment using **×** after its filename
in either saved-record edit dialog. The button has a filename-specific accessible label
and tooltip. A native browser confirmation names the file and warns deletion cannot be undone.
Deletion is independent of saving record edits; viewers cannot delete.

- `DELETE /api/vehicles/:vehicleId/expenses/:expenseId/attachments/:attachmentId`
- `DELETE /api/vehicles/:vehicleId/fillups/:fillUpId/attachments/:attachmentId`

Both routes share authentication, write-permission checks, rate limiting, and a lookup scoped
to attachment, parent, and authorized vehicle. R2 deletion runs before metadata deletion;
missing R2 objects are safe to delete again. Storage failures preserve metadata. If the database
operation fails after R2 succeeds, the filename may remain with a broken Open link until
manual deletion retry finishes. Storage and database deletion are not atomic.

The UI reuses the existing attachment busy state to block conflicting actions, record save,
and dialog dismissal. Deletion is never automatically retried or queued offline. The list
refreshes after success or failure without optimistic updates; a failed refresh blocks further
uploads and deletes until a manual refresh succeeds.

Tests cover both parent routes, write roles and access rejection, nested-ID scoping, storage
and database failures, manual retry, confirmation cancellation, busy states, and capacity refresh.
See the [storage guide](../development/attachments.md#delete-an-attachment) for manual checks.

## Approved follow-up: rename saved files

Owners and editors can use a compact pencil beside a saved filename in either edit dialog.
An inline field edits only the name before the final extension, with **Save name** and
**Cancel rename** actions. Renaming saves independently of record edits; viewers cannot rename.

- `PATCH /api/vehicles/:vehicleId/expenses/:expenseId/attachments/:attachmentId`
- `PATCH /api/vehicles/:vehicleId/fillups/:fillUpId/attachments/:attachmentId`

The JSON body is `{ name: string }`. The shared server handler authenticates, rate-limits,
requires vehicle write access, and scopes lookup and update to attachment, parent, and vehicle.
It trims the name, rejects empty names, path separators, and control characters, and limits the
complete filename to 255 characters. The extension is derived from stored metadata, never from
client input. Only filename metadata changes; object key, file bytes, and capacity remain unchanged.

The UI reuses attachment busy-state protection during saving, never automatically retries or queues
offline, and refreshes the list after success or failure without optimistic updates.
Failure preserves the draft for manual retry; a failed list refresh blocks further mutations.
New Open requests use the updated filename; previously issued signed links are unchanged.
See the [storage guide](../development/attachments.md#rename-an-attachment) for manual checks.

## Approved follow-up: read-only record details

Both lists open **Details** from the date/summary button for viewing saved information and attachment
links without entering Edit. The **⋯** disclosure also offers Details, plus Edit/Delete for
owners and editors.
The existing Edit flow and attachment-management controls remain
unchanged. See [viewing saved records](../features/records.md) for implemented behavior and
manual checks. List compaction, attachment counts, and the save-first creation follow-up are
separate slices.

## Approved follow-up: save and add attachments

Expense and fill-up creation dialogs offer **Save & add attachments** alongside ordinary
Save. Creation must succeed before mounting the existing attachment panel with the confirmed
record ID. Uploading is still a separate action after saving; files are not staged before
record creation. No new storage lifecycle, schema, or upload endpoint is needed.

See [creating records with attachments](../features/records.md#attachments-after-creating-a-record)
for implemented behavior, partial-failure handling, and manual checks.

## Not included

An explicit download action, embedded previews, undo, bulk deletion, pre-save file selection, other
formats, malware scanning, parent-deletion storage cleanup, document backups, and recovery.
Before real-user launch, reassess lifecycle handling and implement document backups with
tested recovery. Existing PostgreSQL backups do not include R2 attachment bytes.
