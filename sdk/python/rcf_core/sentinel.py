# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Sentinel — rank a project's already-written protected functions by how much
surprisal mass they carry, and surface the heaviest as a watch-list.

This is NOT the §6 methodology canary, and the tool says so out loud. The
difference is load-bearing:

  - A DESIGNED CANARY (§6) is an injected, functionally-NEUTRAL arbitrary choice.
    Removing it changes nothing; an honest independent author has NO REASON to
    reproduce it. That is what makes it near-immune to the convergence
    false-positive: it cannot arise "naturally" in any corpus, however large.

  - A NATURAL SENTINEL (this module) is a real, load-bearing function that merely
    happens to be RARE today (high surprisal vs the corpus). It is free — you
    write no new code, you just pick from what already exists — but it is WEAKER:
    because the function does real work, a genuinely independent implementation
    *could in principle converge* on a similar shape. So a sentinel is a
    watch-list, not proof.

There is also a TIME risk unique to natural sentinels: surprisal is measured
RELATIVE to a corpus. If the pattern behind a sentinel spreads in the world —
someone publishes a similar idiom, it lands in a future stdlib or a popular
library — its surprisal quietly decays and the sentinel ages out WITHOUT WARNING.
A designed canary has no such risk (it is deliberately useless and never appears
naturally). This module's defense is to never freeze the list: it re-measures
live on every run. Re-run it before each audit; do not cache the verdict.

It is a thin wrapper over measure.measure_project — the surprisal number is
already computed there; sentinel only sorts and labels. The same engine that
DETECTs theft (proof.py) and MEASUREs your own uniqueness (measure.py) is here
turned to "which of my existing functions already stand out enough to watch".
"""

from __future__ import annotations

import sys
from dataclasses import dataclass

from .corpus import Corpus, load_corpus
from .measure import UnitReport, measure_project
from .sigma import Sigma, SigmaError, load_sigma


@dataclass(frozen=True)
class Sentinel:
    """One watch-list entry: a protected unit and the mass that earned its place."""

    label: str
    total_mass: float
    unique_mass: float
    uniqueness_ratio: float


def rank_sentinels(
    root: str,
    corpus: Corpus,
    sigma: Sigma | None = None,
    *,
    top_n: int = 5,
) -> list[Sentinel]:
    """
    Measure a project's PROTECTED function units live and return the `top_n` by
    surprisal mass — the natural signatures worth watching.

    Always re-measures (never reads a frozen list): a sentinel's standing decays
    as its pattern spreads, so a stale list would silently mislead. `total_mass`
    is the ranking key because it is the metric measure.py trusts at any corpus
    size (uniqueness_ratio only calibrates on a rich corpus).
    """
    reports: list[UnitReport] = measure_project(root, corpus, sigma)
    ranked = sorted(reports, key=lambda r: r.total_mass, reverse=True)
    return [
        Sentinel(
            label=r.label,
            total_mass=r.total_mass,
            unique_mass=r.unique_mass,
            uniqueness_ratio=r.uniqueness_ratio,
        )
        for r in ranked[:top_n]
    ]


# ─── CLI ──────────────────────────────────────────────────────────────────────

_BANNER = (
    "RCF natural sentinels — a WATCH-LIST, not a proof, and NOT the §6 canary.\n"
    "  These are real, load-bearing functions that merely stand out today. A\n"
    "  genuinely independent author could in principle converge on a similar\n"
    "  shape, so a hit here is a lead to investigate (run proof.py), not a verdict.\n"
    "  TIME NOTE: surprisal is corpus-relative — as a pattern spreads in the world\n"
    "  a sentinel's standing decays silently. This list is re-measured live every\n"
    "  run; re-run it before each audit, do not cache it.\n"
)


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m rcf_core.sentinel",
        description="Rank your protected functions by surprisal mass — natural signatures to watch (not a designed canary).",
    )
    parser.add_argument("path", help="project root to scan (its PROTECTED .py files)")
    parser.add_argument("--corpus", metavar="JSON", help="frozen corpus path (default: rcf_core/data/p_nat.json)")
    parser.add_argument("--top", type=int, default=5, help="how many sentinels to surface (default: 5)")
    args = parser.parse_args(argv)

    sigma = load_sigma()
    try:
        corpus = load_corpus(args.corpus, sigma=sigma)
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        print("   Build/freeze a corpus first (python -m rcf_core.corpus).", file=sys.stderr)
        return 1

    print(_BANNER)
    print(f"corpus: {corpus.total_units} units, {len(corpus.doc_freq)} features, Σ {corpus.sigma_version}")

    sentinels = rank_sentinels(args.path, corpus, sigma, top_n=args.top)
    if not sentinels:
        print("\nNo protected Python function units found.")
        return 0

    print(f"\nTop {len(sentinels)} natural sentinels (by surprisal mass):")
    for i, s in enumerate(sentinels, 1):
        pct = round(s.uniqueness_ratio * 100)
        print(f"  {i}. mass={s.total_mass:7.1f}  uniqueness={pct:3d}%   {s.label}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
