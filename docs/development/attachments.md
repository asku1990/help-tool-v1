# Attachment storage setup

For local/staging testing with **disposable files only**. This version uploads and
lists filenames; viewing, downloading, removal, and automatic object cleanup are not
implemented. Database backups do not include attachment bytes.

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

Viewers can list filenames but cannot upload. There are five slots per record.
See the [manual checks in the feature plan](../plan/file-upload.md#slice-3-ui-and-manual-staging-check).

## Troubleshooting

- **No error until Upload:** expected; startup and listing do not access R2.
- **Missing or unresolved attachment storage setting:** check the named field in the
  server terminal, the Proton Pass reference, and whether you restarted through `pass-cli`.
- **Access denied / signature error:** check the account, bucket name, matching access
  key/secret pair, and Object Read & Write permission on that specific bucket.
- **Upload succeeded but files cannot be opened:** viewing/downloading is outside v1.
- **Tests pass without credentials:** R2 is mocked in automated tests; a real upload
  is still needed to validate the configuration.

Deleting a parent removes its metadata but leaves R2 objects. Failed uploads can also
leave orphaned objects. Do not add real documents or assume production lifecycle guarantees.
