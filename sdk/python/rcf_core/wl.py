# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Weisfeiler-Lehman feature extraction over a typed, directed PDG
(RCF-CORRELATION.md §3.1).

Classic WL aggregates the multiset of neighbor labels. Our PDG carries more: edges
are TYPED (DATA / CTRL) and DIRECTED (flow has a direction that means something).
So each neighbor contributes the triple

    (direction, edge_type, neighbor_label)

with direction ∈ {IN, OUT}. "a value flows INTO a multiply" (OUT/DATA → ARITH.MUL)
and "a multiply guarded by a branch" (IN/CTRL) are therefore DISTINCT context
features — the flow is preserved, not just the topology.

One WL iteration:

    label_{i+1}(v) = hash( label_i(v), sorted{ (dir, etype, label_i(u)) : u ~ v } )

Features φ are collected across ALL iterations 0..k (growing radius). k is the
robustness↔sensitivity knob (RCF-SIGMA.md §1, RCF-CORRELATION.md §8.3):
small k = local & robust, large k = global & sensitive.

The output is a feature multiset {wl_feature: count}, ready for the weighted
cosine in correlate.py.
"""

from __future__ import annotations

import hashlib

from .pdg import PDG


def _stable_hash(text: str) -> str:
    """Short, deterministic feature id. Not security-sensitive; stable across runs."""
    return hashlib.sha1(text.encode()).hexdigest()[:16]


def wl_features(pdg: PDG, iterations: int = 2) -> dict[str, int]:
    """
    Extract the WL feature multiset from a PDG.

    Args:
      pdg: the labeled dependence graph.
      iterations: WL depth k (>= 0). Features from levels 0..k are all included.

    Returns:
      {feature_id: count}. feature_id is namespaced by level so that an iteration-0
      label and an iteration-2 label can never collide.
    """
    if iterations < 0:
        raise ValueError("iterations must be >= 0")

    # Level 0: the raw Σ label of each node.
    current: dict[int, str] = {n.nid: n.label for n in pdg.nodes}

    features: dict[str, int] = {}

    def _emit(level: int, labels: dict[int, str]) -> None:
        for lab in labels.values():
            key = f"L{level}:{lab}"
            features[key] = features.get(key, 0) + 1

    _emit(0, current)

    for level in range(1, iterations + 1):
        nxt: dict[int, str] = {}
        for nid in current:
            ctx = sorted(
                f"{direction}/{etype}/{current[other]}"
                for direction, etype, other in pdg.neighbors(nid)
            )
            signature = current[nid] + "|" + ",".join(ctx)
            nxt[nid] = _stable_hash(signature)
        _emit(level, nxt)
        current = nxt

    return features
