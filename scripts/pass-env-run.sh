#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -lt 3 ]; then
  echo "Usage: $0 <env-file> -- <command...>"
  echo "Example: $0 .env.local -- pnpm dev"
  exit 1
fi

env_file="$1"
shift

if [ "${1:-}" != "--" ]; then
  echo "Missing '--' separator."
  echo "Usage: $0 <env-file> -- <command...>"
  exit 1
fi
shift

if [ ! -f "$env_file" ]; then
  echo "Env file not found: $env_file"
  exit 1
fi

if ! command -v pass-cli >/dev/null 2>&1; then
  echo "pass-cli is not installed or not in PATH."
  echo "Install Proton Pass CLI and retry."
  exit 1
fi

if [[ "$env_file" == *".env.prod"* ]] && [ "${CONFIRM_PROD:-}" != "YES" ]; then
  echo "Refusing to run with $env_file without CONFIRM_PROD=YES."
  exit 1
fi

exec pass-cli run --env-file "$env_file" -- "$@"
