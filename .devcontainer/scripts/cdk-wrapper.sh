#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

cd "${WORKSPACE_DIR}"
"${SCRIPT_DIR}/setup-credentials.sh" --require-auth

echo ""
echo "----------------------------------------"
echo "Ejecutando: cdk $*"
echo "----------------------------------------"

npx cdk "$@"
