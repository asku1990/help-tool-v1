# Attachment storage setup

For local/staging testing with **disposable files only**. This version uploads files,
lists filenames, opens PDFs/images in a new browser tab, and renames or deletes individual attachments.
Automatic object cleanup is not implemented. Database backups do not include attachment bytes.

## 1. Create a private R2 bucket

In the [Cloudflare dashboard](https://dash.cloudflare.com/), open **R2 object storage**:

1. Create a dedicated bucket, for example `help-tool-attachments-staging`.
2. Use the default jurisdiction. The current code uses
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`; jurisdiction-restricted buckets
   require a different endpoint and are not supported by this configuration.
3. Keep public access disabled: do not enable the `r2.dev` URL or a public custom domain.

Do **not** reuse the database-backup bucket. No browser-to-R2 CORS configuration is
needed: the browser uploads to Next.js, and Next.js uploads to R2.
If R2 is not enabled on your account, review Cloudflare's billing requirements first.

## 2. Create bucket-scoped credentials

From R2 **Overview → Account Details → Manage API Tokens**:

1. Create an R2 API token with **Object Read & Write** permission.
2. Scope it to **only the new attachment bucket**, not all buckets.
3. Store its **Access Key ID** and **Secret Access Key** in Proton Pass. The secret
   is shown only once. Use these S3 credentials, not a Cloudflare bearer API token.
4. Copy your Cloudflare **Account ID** from the R2 account details.

Write access must include deleting objects: the app attempts deletion if metadata
persistence fails. Keep backup credentials unchanged and separately scoped.

Reference: [Cloudflare R2 authentication](https://developers.cloudflare.com/r2/api/tokens/).

## 3. Set the four environment variables

Add these fields to your local Proton Pass entry, using the values from steps 1–2.
Then add their references to your untracked `.env.local`:

```dotenv
ATTACHMENTS_R2_ACCOUNT_ID=pass://help-tool-v1/env.local/ATTACHMENTS_R2_ACCOUNT_ID
ATTACHMENTS_R2_BUCKET=pass://help-tool-v1/env.local/ATTACHMENTS_R2_BUCKET
ATTACHMENTS_R2_ACCESS_KEY_ID=pass://help-tool-v1/env.local/ATTACHMENTS_R2_ACCESS_KEY_ID
ATTACHMENTS_R2_SECRET_ACCESS_KEY=pass://help-tool-v1/env.local/ATTACHMENTS_R2_SECRET_ACCESS_KEY
```

Adjust the vault/item path to your actual Proton Pass entry. The bucket value is its
name (for example `help-tool-attachments-staging`), not a URL.
If you do not use Proton Pass, put the actual values in `.env.local` instead.
Never commit secrets, paste them into chat, or use a `NEXT_PUBLIC_` prefix.

These `ATTACHMENTS_R2_*` settings are separate from the backup script's `R2_*` settings.
There is no attachment `R2_ENDPOINT` setting; the endpoint is derived from the account ID.

## 4. Restart and test locally

Use **Node.js 22+**, confirm the app targets your local PostgreSQL database, and restart:

```bash
pass-cli run --env-file .env.local -- pnpm dev
```

Sign in as an owner/editor. Open **Edit** on an existing expense or fuel fill-up,
select a supported file of at most **4,000,000 bytes**, and press **Upload**.
Saving record edits is not required. Reopen the record to confirm the filename and
remaining capacity persist. In the R2 dashboard, a new object should appear under
`attachments/` with a random key, not the original filename.

Viewers can list filenames but cannot upload, rename, or delete. There are five slots per record.
See the [manual checks in the feature plan](../plan/file-upload.md#slice-3-ui-and-manual-staging-check).

## Open an attachment

Select a saved filename to open it in a new tab. Owners, editors, and viewers with access to
the vehicle can open its attachments. The app checks the vehicle, parent record, and
attachment before redirecting to a signed R2 link that expires after **2 minutes**.
The bucket stays private, and existing Object Read & Write credentials are sufficient.

Anyone holding that signed link can use it until expiry, even if their app access is
revoked meanwhile. Do not share it. Each click on Open checks current app access again.
The browser receives file bytes for viewing, but is not instructed to download them.
PDF behavior depends on browser settings; no embedded viewer is provided.

## Delete an attachment

Owners and editors can press **×** beside a saved filename and confirm the browser prompt.
Deletion is immediate and independent of saving record edits; it cannot be undone.
Upload, delete, record save, and dialog dismissal are blocked while deletion is processing.
The filename list and remaining capacity refresh afterward, including after a failed request.
If refreshing fails, use **Refresh attachments** before another upload or deletion.

The server deletes the R2 object first, then its database metadata. A storage failure leaves
metadata intact. If storage succeeds but the database operation fails, the filename may remain
with a broken Open link; retry deletion to finish removing it. Deleting an already-missing
R2 object is safe. There is no automatic retry or recovery worker.

Manual check with disposable files: cancel the confirmation and verify the file remains,
then confirm deletion on both an expense and a fill-up. Verify the filename disappears,
capacity increases, and the object is removed from the attachment bucket. Check that viewers
have no delete buttons.

## Rename an attachment

Owners and editors can press the pencil beside a filename, edit the name, and choose
**Save name** or **Cancel rename**. The extension is shown separately and cannot change.
For an existing filename without a dot, the whole name is editable and no extension is appended.
Names are trimmed and must be non-empty, with no path separators or control characters;
the full filename including its extension must not exceed 255 characters.

Renaming saves immediately, independently of record edits. It changes only database metadata,
not the stored object key or bytes. Opening the file again uses the new filename; an already-open
tab or previously issued signed URL may still use the old name until opened again.

While saving, conflicting attachment actions, record save, and dialog dismissal are blocked.
The list refreshes after success or failure, without automatic retries or offline queuing.
A failed save keeps the draft for manual retry; if refreshing fails, refresh the list before
trying another mutation. Attachment capacity does not change.

Manual check: rename a disposable attachment on both an expense and a fill-up, cancel an edit,
and reopen each record. Confirm the name persists, its extension stays fixed, and the file still
opens. Viewers must have no pencil controls.

## Troubleshooting

- **No error until Upload:** expected; startup and listing do not access R2.
- **Missing or unresolved attachment storage setting:** check the named field in the
  server terminal, the Proton Pass reference, and whether you restarted through `pass-cli`.
- **Access denied / signature error:** check the account, bucket name, matching access
  key/secret pair, and Object Read & Write permission on that specific bucket.
- **An Open link expired:** return to the record and press Open again for a fresh link.
- **Open reports a missing object:** metadata may remain after manual bucket cleanup;
  the current staging lifecycle does not guarantee object recovery.
- **PDF downloads instead of opening:** check your browser's built-in PDF viewer setting.
- **Tests pass without credentials:** R2 is mocked in automated tests; a real upload
  is still needed to validate the configuration.

Deleting a parent removes its metadata but leaves R2 objects. Failed uploads can also
leave orphaned objects. Do not add real documents or assume production lifecycle guarantees.
