#!/usr/bin/env bash
#
# cross_sdk_check.sh — live proof of the RCF two-SDK interchangeability contract.
#
# The whole point of shipping both a pip and an npm SDK is that they are
# interchangeable: a project audited by one MUST verify clean under the other,
# in either direction, and both must agree byte-for-byte on which files are
# protected. Unit tests inside each SDK cannot catch a drift *between* them —
# only a round-trip that crosses the language boundary can. This script is that
# round-trip.
#
# Requires on PATH:
#   rcf-cli        (pip install -e sdk/python)
#   node + built TS SDK at sdk/typescript/dist/cli/index.js
#
# Env overrides:
#   PY_CLI  (default: rcf-cli)
#   TS_CLI  (default: node <repo>/sdk/typescript/dist/cli/index.js)
#
# Exits non-zero on the first broken invariant.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PY_CLI="${PY_CLI:-rcf-cli}"
TS_CLI="${TS_CLI:-node ${REPO_ROOT}/sdk/typescript/dist/cli/index.js}"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass() { echo "✅ $1"; }
fail() { echo "❌ $1"; exit 1; }

# Extract the interchangeability-relevant slice of an audit report, normalized
# (sorted keys) so a pip report and an npm report are directly comparable.
assets_fingerprint() {
  python3 -c "import json,sys; d=json.load(open(sys.argv[1])); \
print(json.dumps([{k:a[k] for k in ('file','markers','sha256')} \
for a in d['protected_assets']], sort_keys=True))" "$1"
}

# --- fixture: one protected unit, one plain unit ---------------------------
mkdir -p "$WORK/src"
printf '# [RCF:PROTECTED]\ndef secret_method(x):\n    return x * 42 + 7\n' > "$WORK/src/core.py"
printf 'def helper(y):\n    return y + 1\n'                                 > "$WORK/src/util.py"

REPORT="$WORK/RCF-AUDIT-REPORT.json"

echo "── 1) pip audit → npm verify ──────────────────────────────"
( cd "$WORK" && $PY_CLI audit . >/dev/null )
( cd "$WORK" && $TS_CLI verify . >/dev/null ) \
  && pass "npm verifies a pip-generated audit" \
  || fail "npm FAILED to verify a pip-generated audit"

echo "── 2) npm audit → pip verify ──────────────────────────────"
rm -f "$REPORT"
( cd "$WORK" && $TS_CLI audit . >/dev/null )
( cd "$WORK" && $PY_CLI verify . >/dev/null ) \
  && pass "pip verifies an npm-generated audit" \
  || fail "pip FAILED to verify an npm-generated audit"

echo "── 3) report parity (identical protected_assets) ──────────"
( cd "$WORK" && $PY_CLI audit . >/dev/null ); PIP_FP="$(assets_fingerprint "$REPORT")"
( cd "$WORK" && $TS_CLI audit . >/dev/null ); NPM_FP="$(assets_fingerprint "$REPORT")"
if [ "$PIP_FP" = "$NPM_FP" ]; then
  pass "both SDKs record identical protected_assets"
else
  echo "  pip: $PIP_FP"
  echo "  npm: $NPM_FP"
  fail "protected_assets DIVERGED between SDKs"
fi

echo "── 4) tamper → both verifiers must reject ─────────────────"
( cd "$WORK" && $PY_CLI audit . >/dev/null )
printf '# [RCF:PROTECTED]\ndef secret_method(x):\n    return x * 99  # STOLEN\n' > "$WORK/src/core.py"
if ( cd "$WORK" && $PY_CLI verify . >/dev/null 2>&1 ); then fail "pip verify passed a tampered file (should fail)"; fi
pass "pip verify rejects tampered file"
if ( cd "$WORK" && $TS_CLI verify . >/dev/null 2>&1 ); then fail "npm verify passed a tampered file (should fail)"; fi
pass "npm verify rejects tampered file"

echo ""
echo "🛡️  Cross-SDK interchangeability contract holds in both directions."
