# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Correlation — the surprisal-weighted cosine over WL features (RCF-CORRELATION.md §4.3).

    corr(A,B) = Σ_f w(f)·[f∈A]·[f∈B] / ( √Σ_f w(f)[f∈A]²  ·  √Σ_f w(f)[f∈B]² )

w(f) is the idiosyncrasy weight: w(f) = −log P_nat(f), the improbability of an
independent re-invention producing feature f (§4.2). Estimating P_nat needs a
corpus we do not have yet, so this module takes a `weight` CALLABLE with a default
of constant 1.0 — i.e. an ordinary cosine. When the corpus exists, pass a real
surprisal weight WITHOUT changing this formula. That is the whole point of the
interface: similarity today, origin later, same equation.

Comparability rule (RCF-SIGMA.md §7): two graphs are only comparable when their
alphabet_hash matches. corr() refuses otherwise — a mismatched alphabet means the
features mean different things.
"""

from __future__ import annotations

import math
from typing import Callable

from .pdg import PDG
from .sigma import SigmaError
from .wl import wl_features

# A weight function maps a WL feature id -> its weight. Default: every feature
# weighs 1.0 (plain cosine). Replace with surprisal once a corpus exists.
WeightFn = Callable[[str], float]


def unit_weight(_feature: str) -> float:
    return 1.0


def surprisal_weight_from_corpus(p_nat: dict[str, float], floor: float = 1e-9) -> WeightFn:
    """
    Build a real surprisal weight w(f) = −log P_nat(f) from a corpus frequency map.
    Unseen features (P_nat == 0) are the MOST surprising; they get −log(floor).
    Kept here so the §4.2 formula has a home the moment a corpus lands.
    """
    def _w(feature: str) -> float:
        p = p_nat.get(feature, 0.0)
        return -math.log(max(p, floor))
    return _w


def _weighted_cosine(a: dict[str, int], b: dict[str, int], weight: WeightFn) -> float:
    keys = set(a) | set(b)
    dot = 0.0
    na = 0.0
    nb = 0.0
    for f in keys:
        w = weight(f)
        av = a.get(f, 0)
        bv = b.get(f, 0)
        dot += w * av * bv
        na += w * av * av
        nb += w * bv * bv
    if na == 0.0 or nb == 0.0:
        return 0.0
    return dot / (math.sqrt(na) * math.sqrt(nb))


def correlate(
    a: PDG,
    b: PDG,
    *,
    iterations: int = 2,
    weight: WeightFn = unit_weight,
) -> float:
    """
    corr(A, B) ∈ [0, 1] over WL features of two PDGs.

    Raises SigmaError if the two graphs were built under different alphabets
    (alphabet_hash mismatch) — they are not comparable.
    """
    if a.sigma.alphabet_hash != b.sigma.alphabet_hash:
        raise SigmaError(
            "incomparable: alphabet_hash mismatch\n"
            f"  A: {a.sigma.alphabet_hash}\n"
            f"  B: {b.sigma.alphabet_hash}"
        )
    fa = wl_features(a, iterations)
    fb = wl_features(b, iterations)
    return _weighted_cosine(fa, fb, weight)
