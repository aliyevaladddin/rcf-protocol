#!/usr/bin/env python3
# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Version consistency guard.

Docs no longer hardcode the version — it lives ONLY in machine-readable files.
This script asserts those machine sources agree with each other, so a release can
never silently drift. Run it locally or in CI; exits non-zero on mismatch.

Sources of truth checked:
  - package.json                     (npm root)
  - sdk/typescript/package.json      (npm SDK)
  - sdk/python/pyproject.toml        (PyPI SDK)
  - SPECIFICATION/sigma.json         (sigma_version — the Σ growth ring)
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _json_version(rel: str, key: str = "version") -> tuple[str, str]:
    data = json.loads((ROOT / rel).read_text(encoding="utf-8"))
    return rel, data[key]


def _toml_version(rel: str) -> tuple[str, str]:
    text = (ROOT / rel).read_text(encoding="utf-8")
    m = re.search(r'^\s*version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    if not m:
        raise SystemExit(f"could not find version in {rel}")
    return rel, m.group(1)


def main() -> int:
    found = [
        _json_version("package.json"),
        _json_version("sdk/typescript/package.json"),
        _toml_version("sdk/python/pyproject.toml"),
        _json_version("SPECIFICATION/sigma.json", key="sigma_version"),
    ]

    versions = {v for _, v in found}
    width = max(len(f) for f, _ in found)
    for f, v in found:
        print(f"  {f:<{width}}  {v}")

    if len(versions) == 1:
        print(f"\nOK — all sources agree on {versions.pop()}")
        return 0

    print(f"\nMISMATCH — {len(versions)} distinct versions: {sorted(versions)}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
