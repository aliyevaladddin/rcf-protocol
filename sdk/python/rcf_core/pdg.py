# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
PDG — the Program Dependence Graph object from RCF-CORRELATION.md §1.2.

    G = (V, E, ℓ)

  V : operations / values, each labeled ℓ(v) = (cls, op) over Σ.
  E : typed dependence edges (DATA, CTRL; ORDER optional).

Hard invariants (RCF-SIGMA.md §2):
  - identifiers are NOT stored (no names),
  - concrete types are NOT stored,
  - every node label and every edge type is drawn ONLY from Σ.

Construction goes through a Sigma instance so an out-of-alphabet label fails loudly
at build time, not silently at compare time.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .sigma import Sigma


@dataclass(frozen=True)
class Node:
    """A PDG node. `op` may be None (class-only label is valid per Σ)."""
    nid: int
    cls: str
    op: str | None = None

    @property
    def label(self) -> str:
        """Canonical label string: 'CLASS' or 'CLASS.OP'."""
        return self.cls if self.op is None else f"{self.cls}.{self.op}"


@dataclass(frozen=True)
class Edge:
    src: int
    dst: int
    etype: str  # DATA | CTRL | ORDER


class PDG:
    """A labeled directed dependence graph, validated against Σ on every add."""

    def __init__(self, sigma: Sigma):
        self.sigma = sigma
        self._nodes: dict[int, Node] = {}
        self._edges: list[Edge] = []
        self._next_id = 0

    # ─── construction (Σ-checked) ─────────────────────────────────────────────

    def add_node(self, cls: str, op: str | None = None) -> int:
        """Add a node; raises SigmaError if (cls, op) is not in Σ. Returns its id."""
        self.sigma.require_label(cls, op)
        nid = self._next_id
        self._next_id += 1
        self._nodes[nid] = Node(nid, cls, op)
        return nid

    def add_edge(self, src: int, dst: int, etype: str = "DATA") -> None:
        """Add a typed edge; raises on unknown endpoints or non-Σ edge type."""
        if not self.sigma.is_edge(etype):
            from .sigma import SigmaError
            raise SigmaError(f"edge type not in Σ {self.sigma.version}: {etype!r}")
        if src not in self._nodes or dst not in self._nodes:
            raise KeyError(f"edge endpoint missing: {src}->{dst}")
        self._edges.append(Edge(src, dst, etype))

    # ─── access ───────────────────────────────────────────────────────────────

    @property
    def nodes(self) -> list[Node]:
        return list(self._nodes.values())

    @property
    def edges(self) -> list[Edge]:
        return list(self._edges)

    def node(self, nid: int) -> Node:
        return self._nodes[nid]

    def __len__(self) -> int:
        return len(self._nodes)

    # ─── adjacency (for WL aggregation) ───────────────────────────────────────

    def neighbors(self, nid: int) -> list[tuple[str, str, int]]:
        """
        Typed, directed neighborhood of `nid` for WL aggregation.
        Returns (direction, edge_type, other_id) where direction is 'OUT' for an
        edge nid->other and 'IN' for other->nid. Both directions are kept because
        data/control FLOW has a direction that carries meaning.
        """
        out: list[tuple[str, str, int]] = []
        for e in self._edges:
            if e.src == nid:
                out.append(("OUT", e.etype, e.dst))
            elif e.dst == nid:
                out.append(("IN", e.etype, e.src))
        return out

    # ─── serialization (debug / fingerprint input) ────────────────────────────

    def to_dict(self) -> dict:
        """
        Deterministic dict form. Carries sigma_version AND alphabet_hash so any
        downstream fingerprint is bound to the exact alphabet it was built under
        (RCF-SIGMA.md §7 — alphabet_hash is the comparability key).
        """
        return {
            "sigma_version": self.sigma.version,
            "alphabet_hash": self.sigma.alphabet_hash,
            "nodes": [
                {"id": n.nid, "label": n.label} for n in self._nodes.values()
            ],
            "edges": [
                {"src": e.src, "dst": e.dst, "type": e.etype} for e in self._edges
            ],
        }

    def label_multiset(self) -> dict[str, int]:
        """Frequency of each node label — the WL iteration-0 feature vector φ₀."""
        counts: dict[str, int] = {}
        for n in self._nodes.values():
            counts[n.label] = counts.get(n.label, 0) + 1
        return counts
