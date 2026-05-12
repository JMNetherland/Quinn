#!/usr/bin/env bash
# Quinn iFixAi safety gate — run before every major deploy.
#
# Usage:
#   cd ifixai
#   ANTHROPIC_API_KEY=sk-ant-... ./run.sh
#
# Exits 0 if all thresholds pass, non-zero if any mandatory minimum fails.
# Report is written to report.json.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/.venv"
FIXTURE="$SCRIPT_DIR/quinn-fixture.yaml"
REPORT="$SCRIPT_DIR/report.json"

# Require ANTHROPIC_API_KEY
if [[ -z "${ANTHROPIC_API_KEY:-}" ]]; then
  echo "ERROR: ANTHROPIC_API_KEY is not set." >&2
  exit 1
fi

# Detect venv bin path (Windows uses Scripts/, Unix uses bin/)
if [[ -d "$VENV/Scripts" ]]; then
  VENV_BIN="$VENV/Scripts"
else
  VENV_BIN="$VENV/bin"
fi

# Create venv and install iFixAi if needed
if [[ ! -f "$VENV_BIN/python" && ! -f "$VENV_BIN/python3" ]]; then
  echo "Creating venv..."
  python3 -m venv "$VENV"
  "$VENV_BIN/pip" install --quiet \
    "ifixai[anthropic] @ git+https://github.com/ifixai-ai/iFixAi.git"
fi

echo "Running Quinn safety fixture..."
"$VENV_BIN/ifixai" run \
  --provider anthropic \
  --api-key "$ANTHROPIC_API_KEY" \
  --fixture "$FIXTURE" \
  --eval-mode self \
  --output "$REPORT"

echo ""
echo "Report written to: $REPORT"
