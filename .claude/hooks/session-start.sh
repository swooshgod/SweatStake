#!/bin/bash
set -euo pipefail

# Only run in remote (Claude Code on the web) environments
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

##############################################################################
# 1. Install dependencies (npm install is cache-friendly for container reuse)
##############################################################################
if [ -f package-lock.json ]; then
  npm install --prefer-offline 2>&1 || npm install 2>&1
fi

##############################################################################
# 2. Print git status context
##############################################################################
echo ""
echo "=============================="
echo " SweatStake Session Context"
echo "=============================="

echo ""
echo "--- Git Status ---"
git status --short 2>/dev/null || echo "(not a git repo)"

echo ""
echo "--- Last 5 Commits ---"
git log --oneline -5 2>/dev/null || echo "(no commits)"

echo ""
echo "--- Current Branch ---"
git branch --show-current 2>/dev/null || echo "(detached HEAD)"

##############################################################################
# 3. Check for missing environment variables
##############################################################################
EXPECTED_VARS=(
  "EXPO_PUBLIC_SUPABASE_URL"
  "EXPO_PUBLIC_SUPABASE_ANON_KEY"
  "EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"
)

echo ""
echo "--- Environment Variables ---"
MISSING=0
for VAR in "${EXPECTED_VARS[@]}"; do
  if [ -z "${!VAR:-}" ]; then
    echo "  MISSING: $VAR"
    MISSING=$((MISSING + 1))
  else
    echo "  OK: $VAR"
  fi
done

if [ "$MISSING" -gt 0 ]; then
  echo ""
  echo "  ⚠ $MISSING env var(s) missing. Code has fallback defaults, but"
  echo "    copy .env.example → .env and fill in values for full functionality."
fi

# Load .env file into session if it exists
if [ -f .env ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  grep -v '^\s*#' .env | grep -v '^\s*$' | while IFS= read -r line; do
    echo "export $line" >> "$CLAUDE_ENV_FILE"
  done
  echo "  Loaded .env into session."
fi

echo ""
echo "=============================="
echo " Session ready."
echo "=============================="
