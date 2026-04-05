#!/usr/bin/env bash
set -euo pipefail
umask 077

required_vars=(
  DATABASE_URL
  R2_BUCKET
  R2_ACCOUNT_ID
  R2_ACCESS_KEY_ID
  R2_SECRET_ACCESS_KEY
)

optional_vars=(
  R2_REGION
  R2_PREFIX
  R2_ENDPOINT
  BACKUP_LOCAL_DIR
  BACKUP_KEEP_LOCAL
)

for var_name in "${required_vars[@]}"; do
  if [[ -z "${!var_name:-}" ]]; then
    echo "Missing required env var: ${var_name}" >&2
    exit 1
  fi
  if [[ "${!var_name}" == pass://* ]]; then
    echo "Unresolved pass:// secret in ${var_name}." >&2
    echo "Run via Proton Pass, e.g.:" >&2
    echo "  pass-cli run --env-file .env.local -- pnpm backup:r2" >&2
    exit 1
  fi
done

for var_name in "${optional_vars[@]}"; do
  if [[ "${!var_name:-}" == pass://* ]]; then
    echo "Unresolved pass:// secret in ${var_name}." >&2
    echo "Run via Proton Pass, e.g.:" >&2
    echo "  pass-cli run --env-file .env.local -- pnpm backup:r2" >&2
    exit 1
  fi
done

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required but was not found in PATH." >&2
  exit 1
fi

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI is required but was not found in PATH." >&2
  exit 1
fi

timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
hostname="${BACKUP_HOSTNAME:-$(hostname -s 2>/dev/null || echo local)}"
prefix="${R2_PREFIX:-db-backups}"
prefix="${prefix#/}"
prefix="${prefix%/}"
filename="postgres-${hostname}-${timestamp}.sql.gz"

local_dir="${BACKUP_LOCAL_DIR:-.tmp/backups}"
mkdir -p "${local_dir}"
local_path="${local_dir}/${filename}"

key="${filename}"
if [[ -n "${prefix}" ]]; then
  key="${prefix}/${filename}"
fi

export AWS_ACCESS_KEY_ID="${R2_ACCESS_KEY_ID}"
export AWS_SECRET_ACCESS_KEY="${R2_SECRET_ACCESS_KEY}"
export AWS_DEFAULT_REGION="${R2_REGION:-auto}"

endpoint_url="${R2_ENDPOINT:-https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com}"

cleanup() {
  exit_code="$?"
  if [[ "${exit_code}" -eq 0 && "${BACKUP_KEEP_LOCAL:-0}" != "1" ]]; then
    rm -f "${local_path}"
  fi
}
trap cleanup EXIT

echo "Creating PostgreSQL dump: ${local_path}"
pg_dump_url="${DATABASE_URL%%\?*}"
if [[ "${pg_dump_url}" != "${DATABASE_URL}" ]]; then
  echo "Stripped Prisma query parameters from DATABASE_URL for pg_dump." >&2
fi

pg_dump --no-owner --no-privileges "${pg_dump_url}" | gzip -c > "${local_path}"

echo "Uploading to R2: s3://${R2_BUCKET}/${key}"
max_upload_attempts=3
upload_attempt=1
while true; do
  if aws s3 cp "${local_path}" "s3://${R2_BUCKET}/${key}" \
    --endpoint-url "${endpoint_url}" \
    --region "${AWS_DEFAULT_REGION}" \
    --only-show-errors; then
    break
  fi

  if [[ "${upload_attempt}" -ge "${max_upload_attempts}" ]]; then
    echo "Upload failed after ${max_upload_attempts} attempts; local dump preserved at ${local_path}" >&2
    exit 1
  fi

  echo "Upload attempt ${upload_attempt}/${max_upload_attempts} failed; retrying..." >&2
  sleep $((upload_attempt * 2))
  upload_attempt=$((upload_attempt + 1))
done

echo "Backup completed successfully."
