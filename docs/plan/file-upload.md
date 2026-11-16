# File uploads: first staging version

Status: planning only. The previous attachment implementation has been removed. This
document does not authorize deployment, remote migrations, or cloud configuration changes.

## Goal

Attach disposable test receipts and maintenance reports to already-saved expenses
of every category and saved fuel fill-ups. Keep the first implementation small.

## User experience

- Open an existing record, select one file, and press a separate **Upload** button.
- Uploading is independent of saving record edits. Creation forms remain unchanged.
- Show upload progress, errors, and a retry action.
- Reopening a record shows saved filenames and remaining attachment capacity.
- Owners and editors may upload; viewers may not.
- Accept PDF, JPG/JPEG, PNG, and WebP; at most five attachments per record.

## Size limit: confirmation required

The earlier requirement was 10,000,000 bytes per file. Vercel Functions have a
4.5 MB request-body limit, including request overhead.

**Proposed revised file limit: 4,000,000 bytes, one file per request.** Confirm this
change before implementing. Do not silently retain a 10 MB promise that this upload
path cannot support. If 10 MB is required, revisit the upload receiver separately;
do not automatically reintroduce the previous direct-upload architecture.

Reference: <https://vercel.com/docs/functions/limitations#request-body-size>.

## Simple upload flow

1. Browser sends the file to an authenticated application endpoint.
2. Server checks owner/editor permission and that the expense or fuel fill-up belongs
   to the authorized vehicle.
3. Server checks actual file size and content, not only extension or declared MIME.
4. Server enforces the five-attachment limit, including concurrent requests, using
   a database transaction with per-parent serialization. Choose the concrete mechanism
   during implementation; no distributed reservation service is needed.
5. Server generates one unpredictable object key and stores the validated file once
   in a private R2 bucket.
6. Server saves attachment metadata and returns success after the database commit.

Keep transaction and R2 failure handling together in a small upload module. A repeated
user upload is a new attachment; this slice does not promise exactly-once delivery.

## Metadata

Use a small attachment table with:

- ID.
- Explicit, mutually exclusive expense/fuel fill-up references with database relations.
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
- Parent deletion integration is deferred. Existing deletion behavior must be accounted
  for when adding relations, but do not implement R2 deletion on parent deletion here.
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

## Not included

Viewing, downloading, previews, user-facing removal, creation-form integration, other
formats, malware scanning, parent-deletion storage cleanup, document backups, and recovery.
Before real-user launch, reassess lifecycle handling and implement document backups with
tested recovery. Existing PostgreSQL backups do not include R2 attachment bytes.
