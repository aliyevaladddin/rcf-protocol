# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Language-aware normalization router (Python SDK).

Detects the source language from a file path or extension and dispatches
to the appropriate normalizer.  All normalizers share the same Sigma IR
alphabet, so the resulting PDG is directly comparable regardless of
the source language.

For Python, the built-in python normalizer is used.
For other languages (TypeScript, Go, Rust), we delegate to the sibling Node.js
normalizers via a subprocess call to `test_export.cjs` to guarantee identical
cross-SDK node and edge structure.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Optional

from .pdg import PDG, Node
from .sigma import Sigma, load_sigma

# ──────────────────────────────────────────────────────────────────────────────
# Extension → language mapping
# ──────────────────────────────────────────────────────────────────────────────

_EXT_MAP: dict[str, str] = {
    ".py":   "python",
    ".go":   "go",
    ".rs":   "rust",
    ".ts":   "typescript",
    ".tsx":  "typescript",
    ".js":   "typescript",
    ".jsx":  "typescript",
}

SupportedLanguage = str  # 'python' | 'go' | 'rust' | 'typescript'


def language_from_path(file_path: str | Path) -> SupportedLanguage:
    """Return the language identifier for *file_path* based on its suffix.

    Raises ``ValueError`` for unknown extensions.
    """
    ext = Path(file_path).suffix.lower()
    lang = _EXT_MAP.get(ext)
    if lang is None:
        raise ValueError(
            f"Unsupported file extension '{ext}'. "
            f"Supported: {sorted(_EXT_MAP.keys())}"
        )
    return lang


def normalize_by_extension(
    source: str,
    file_path: str | Path,
    sigma: Optional[Sigma] = None,
) -> PDG:
    """Normalize *source* code using the normalizer for *file_path*'s extension.

    Parameters
    ----------
    source:
        Raw source code as a string.
    file_path:
        Path (or bare extension like ``".go"``) used only for language detection.
    sigma:
        Pre-loaded Sigma alphabet.  If *None*, the default ``sigma.json`` is
        loaded automatically.
    """
    sigma = sigma or load_sigma()
    lang  = language_from_path(file_path)

    if lang == "python":
        from .normalize_python import normalize_python
        return normalize_python(source, sigma)

    # For Go, Rust, and TypeScript/JavaScript, delegate to TypeScript SDK's test_export.cjs
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    ts_dir = project_root / "sdk" / "typescript"
    export_script = ts_dir / "test_export.cjs"

    if not export_script.exists():
        raise FileNotFoundError(
            f"TypeScript normalizer export script not found at: {export_script}\n"
            f"Please ensure the repository structure is intact."
        )

    # Map strictly to static literal strings to cut parameter taint and prevent OS command injection.
    ext = Path(file_path).suffix.lower()
    if ext == ".go":
        safe_suffix = ".go"
    elif ext == ".rs":
        safe_suffix = ".rs"
    elif ext == ".ts":
        safe_suffix = ".ts"
    elif ext == ".tsx":
        safe_suffix = ".tsx"
    elif ext == ".js":
        safe_suffix = ".js"
    elif ext == ".jsx":
        safe_suffix = ".jsx"
    else:
        raise ValueError(f"Unsupported file extension: {ext}")

    # Run Node.js to normalize — source is passed via stdin (not a CLI arg)
    # to prevent OS command injection from untrusted source code content.
    cmd = ["node", "test_export.cjs", safe_suffix]
    try:
        res = subprocess.run(
            cmd,
            input=source,
            capture_output=True,
            text=True,
            cwd=str(ts_dir),
            check=True,
            timeout=30,
        )
    except subprocess.CalledProcessError as err:
        raise RuntimeError(
            f"Node.js normalizer subprocess failed:\n"
            f"stdout: {err.stdout}\n"
            f"stderr: {err.stderr}"
        ) from err
    except subprocess.TimeoutExpired as err:
        raise RuntimeError("Node.js normalizer subprocess timed out after 30s.") from err
    except FileNotFoundError as err:
        raise RuntimeError(
            "Node.js (node executable) is required to run cross-language normalizers "
            "but it was not found in the system PATH."
        ) from err

    try:
        pdg_dict = json.loads(res.stdout)
    except json.JSONDecodeError as err:
        raise RuntimeError(
            f"Failed to parse JSON from node normalizer output: {res.stdout}"
        ) from err

    # Reconstruct PDG exactly matching Node.js node IDs
    g = PDG(sigma)
    for n in pdg_dict.get("nodes", []):
        nid = n["id"]
        parts = n["label"].split(".", 1)
        cls = parts[0]
        op = parts[1] if len(parts) > 1 else None
        sigma.require_label(cls, op)
        g._nodes[nid] = Node(nid, cls, op)
        if nid >= g._next_id:
            g._next_id = nid + 1

    for e in pdg_dict.get("edges", []):
        g.add_edge(e["src"], e["dst"], e["type"])

    return g
