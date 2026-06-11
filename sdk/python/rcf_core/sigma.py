# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Σ loader — the single point that reads SPECIFICATION/sigma.json and exposes the
semantic alphabet to the rest of rcf_core.

Per RCF-SIGMA.md:
  - sigma.json is the source of truth (this module never hardcodes the alphabet).
  - sigma_version is a "growth ring" of RCF (tracks the protocol version).
  - alphabet_hash is the TRUE comparability key: two fingerprints are comparable
    iff their alphabet_hash matches, even across differing sigma_version strings.

The loader recomputes alphabet_hash from the node/edge structure and refuses to
load if the stored hash disagrees — a tamper / drift tripwire.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path


class SigmaError(Exception):
    """Raised when sigma.json is missing, malformed, or its alphabet_hash drifted."""


# Resolve SPECIFICATION/sigma.json relative to this file:
# sdk/python/rcf_core/sigma.py -> repo_root/SPECIFICATION/sigma.json
_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_SIGMA_PATH = _REPO_ROOT / "SPECIFICATION" / "sigma.json"


def compute_alphabet_hash(nodes: dict, edges: dict) -> str:
    """
    Canonical alphabet hash. Hashes ONLY the label structure — node classes with
    their sorted ops, and the sorted edge types. Excludes sigma_version and every
    doc string, so a docs-only PATCH release does not change it.

    Must stay byte-identical to the procedure documented in sigma.json/alphabet_hash_doc.
    """
    alphabet = {
        "nodes": {cls: sorted(spec["ops"]) for cls, spec in nodes.items()},
        "edges": sorted(edges.keys()),
    }
    blob = json.dumps(alphabet, sort_keys=True, separators=(",", ":")).encode()
    return "sha256:" + hashlib.sha256(blob).hexdigest()


@dataclass(frozen=True)
class Sigma:
    """An immutable, validated view of the Σ alphabet."""

    version: str
    alphabet_hash: str
    nodes: dict          # class -> {"ops": [...], "doc": str}
    edges: dict          # type  -> {"doc": str, "normative": bool}

    # ─── label validation ────────────────────────────────────────────────────

    def is_class(self, cls: str) -> bool:
        return cls in self.nodes

    def is_label(self, cls: str, op: str | None = None) -> bool:
        """A label is valid if the class exists and (op is None or op ∈ class.ops)."""
        if cls not in self.nodes:
            return False
        if op is None:
            return True
        return op in self.nodes[cls]["ops"]

    def is_edge(self, edge_type: str) -> bool:
        return edge_type in self.edges

    def normative_edges(self) -> list[str]:
        return [t for t, spec in self.edges.items() if spec.get("normative")]

    def require_label(self, cls: str, op: str | None = None) -> None:
        """Raise SigmaError if (cls, op) is not in Σ — used by normalizers."""
        if not self.is_label(cls, op):
            raise SigmaError(f"label not in Σ {self.version}: ({cls!r}, {op!r})")

    # ─── introspection ───────────────────────────────────────────────────────

    def classes(self) -> list[str]:
        return list(self.nodes.keys())

    def ops(self, cls: str) -> list[str]:
        return list(self.nodes[cls]["ops"])


def load_sigma(path: str | Path | None = None, *, verify_hash: bool = True) -> Sigma:
    """
    Load and validate the Σ alphabet from sigma.json.

    Raises SigmaError on missing file, bad JSON, missing required keys, or — when
    verify_hash is True — on alphabet_hash drift between the stored value and the
    value recomputed from the node/edge structure.
    """
    # Resolve to an absolute, normalized path and constrain the input: the Σ
    # alphabet is only ever a .json file. This rejects traversal-style input and
    # non-JSON targets before any read happens.
    p = (Path(path) if path is not None else _DEFAULT_SIGMA_PATH).resolve()
    if p.suffix.lower() != ".json":
        raise SigmaError(f"Σ source must be a .json file, got: {p.name}")
    if not p.is_file():
        raise SigmaError(f"sigma.json not found at: {p}")

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SigmaError(f"sigma.json is not valid JSON: {e}") from e

    for key in ("sigma_version", "alphabet_hash", "nodes", "edges"):
        if key not in data:
            raise SigmaError(f"sigma.json missing required key: {key!r}")

    nodes, edges = data["nodes"], data["edges"]
    if not isinstance(nodes, dict) or not isinstance(edges, dict):
        raise SigmaError("sigma.json 'nodes'/'edges' must be objects")

    for cls, spec in nodes.items():
        if not isinstance(spec, dict) or "ops" not in spec or not isinstance(spec["ops"], list):
            raise SigmaError(f"sigma.json node {cls!r} must have an 'ops' list")

    recomputed = compute_alphabet_hash(nodes, edges)
    if verify_hash and recomputed != data["alphabet_hash"]:
        raise SigmaError(
            "alphabet_hash drift — sigma.json was edited without recomputing the hash.\n"
            f"  stored    : {data['alphabet_hash']}\n"
            f"  recomputed: {recomputed}\n"
            "Either revert the change or update alphabet_hash (this is a breaking Σ change)."
        )

    return Sigma(
        version=data["sigma_version"],
        alphabet_hash=data["alphabet_hash"],
        nodes=nodes,
        edges=edges,
    )
