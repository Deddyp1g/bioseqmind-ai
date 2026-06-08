#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$PROJECT_ROOT/tools/mmseqs/bin:$PROJECT_ROOT/backend/.venv/bin:$PATH"

exec "$PROJECT_ROOT/backend/.venv/bin/genomad" "$@"
