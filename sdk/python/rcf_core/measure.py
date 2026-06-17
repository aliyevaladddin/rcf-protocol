# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Measure — the surprisal mirror (RCF v3, the RESTRICT side of the engine).

DETECT runs the same machinery outward — corr(your code, a thief's code) — to
catch theft after the fact. MEASURE turns it inward, BEFORE publication: it shows
the author the *surprisal map* of their own method —

  - which WL features are BANAL (high P_nat: the whole world writes them, an AI
    already knows them, nothing to protect),
  - which are the author's SIGNATURE (low P_nat: rare in the background, this is
    what an AI would correlate specifically to *you*).

It changes nothing. It is a mirror, not an edit. The author decides what to do
with what they see.

The score is the surprisal mass of a unit, w(f) = -log P_nat(f) summed over its
features, split into a banal part and a unique part:

    uniqueness_ratio = unique_mass / total_mass

HONEST LIMIT: the corpus is the truth here. A Python-stdlib corpus measures
uniqueness *within Python* — the first ring. The banner says so; we do not let a
single-language number read as a cross-language verdict.
"""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, field

from .corpus import (
    Corpus,
    iter_function_units,
    load_corpus,
)
from .normalize_python import normalize_python
from .pdg import PDG
from .sigma import Sigma, SigmaError, load_sigma
from .wl import wl_features

# Banality is judged RELATIVE to the corpus's own weight distribution, not a fixed
# P_nat. At scale, deep WL features are combinatorially many and each individually
# rare, so a fixed cut marks almost everything "unique" (ratio saturates near 100%
# for banal and unique alike). The corpus-relative cut re-separates them. This is
# the median-weight feature by default; surfaced in the report (no-silent-caps).
BANAL_PERCENTILE = 0.5


@dataclass(frozen=True)
class FeatureContribution:
    feature: str
    p_nat: float
    weight: float        # w(f) = -log P_nat(f)
    count: int           # multiplicity within THIS unit
    mass: float          # weight * count
    banal: bool


@dataclass
class UnitReport:
    label: str
    total_mass: float = 0.0
    unique_mass: float = 0.0
    banal_mass: float = 0.0
    contributions: list[FeatureContribution] = field(default_factory=list)

    @property
    def uniqueness_ratio(self) -> float:
        if self.total_mass == 0.0:
            return 0.0
        return self.unique_mass / self.total_mass

    def top_signature(self, n: int = 5) -> list[FeatureContribution]:
        """The rarest-heaviest features — the author's fingerprint."""
        rare = [c for c in self.contributions if not c.banal]
        return sorted(rare, key=lambda c: c.mass, reverse=True)[:n]


def measure_unit(
    pdg: PDG,
    corpus: Corpus,
    label: str = "<unit>",
    *,
    iterations: int = 2,
    banal_percentile: float = BANAL_PERCENTILE,
) -> UnitReport:
    """
    Compute the surprisal map of one PDG against a corpus.

    A feature is banal when its weight is below the corpus's `banal_percentile`
    weight (corpus-relative, not a fixed P_nat — see BANAL_PERCENTILE).

    Refuses (SigmaError) when the PDG and the corpus were built under different
    alphabets — their features are not comparable (RCF-SIGMA.md §7).
    """
    if pdg.sigma.alphabet_hash != corpus.alphabet_hash:
        raise SigmaError(
            "incomparable: PDG and corpus alphabet_hash differ\n"
            f"  pdg   : {pdg.sigma.alphabet_hash}\n"
            f"  corpus: {corpus.alphabet_hash}"
        )

    p_nat = corpus.p_nat()
    weight = corpus.weight_fn()
    cut = corpus.weight_threshold(banal_percentile)
    feats = wl_features(pdg, iterations)

    report = UnitReport(label=label)
    for f, count in feats.items():
        pf = p_nat.get(f, 0.0)
        w = weight(f)
        mass = w * count
        banal = w < cut  # corpus-relative: lighter than the typical corpus feature
        report.contributions.append(
            FeatureContribution(feature=f, p_nat=pf, weight=w, count=count, mass=mass, banal=banal)
        )
        report.total_mass += mass
        if banal:
            report.banal_mass += mass
        else:
            report.unique_mass += mass
    return report


def measure_source(source: str, corpus: Corpus, sigma: Sigma | None = None) -> list[UnitReport]:
    """Measure every function unit in a source string."""
    sigma = sigma or load_sigma()
    reports: list[UnitReport] = []
    for i, unit_src in enumerate(iter_function_units(source)):
        try:
            pdg = normalize_python(unit_src, sigma)
        except (SyntaxError, ValueError, SigmaError):
            continue
        # a short, identifier-free label: first line of the unit
        first = unit_src.strip().splitlines()[0] if unit_src.strip() else f"unit#{i}"
        reports.append(measure_unit(pdg, corpus, label=first.strip()[:60]))
    return reports


def measure_project(root: str, corpus: Corpus, sigma: Sigma | None = None) -> list[UnitReport]:
    """
    Measure the PROTECTED function units of a project — the things the author
    declared worth protecting. Reuses rcf_cli.scanner for the is_protected verdict.
    """
    from rcf_cli.scanner import RCFScanner

    sigma = sigma or load_sigma()
    scanner = RCFScanner(root)
    reports: list[UnitReport] = []
    for res in scanner.scan_directory(include_protected=True):
        if not res.get("is_protected"):
            continue
        fpath = os.path.join(root, res["path"])
        if not fpath.endswith(".py"):
            continue
        try:
            src = open(fpath, encoding="utf-8", errors="ignore").read()
        except Exception:
            continue
        for rep in measure_source(src, corpus, sigma):
            rep.label = f"{res['path']} :: {rep.label}"
            reports.append(rep)
    return reports


# ─── CLI ──────────────────────────────────────────────────────────────────────

_BANNER = (
    "RCF surprisal measure — a MIRROR, it changes nothing.\n"
    "  high uniqueness = this method stands out from ordinary code → most learnable by AI\n"
    "  RING NOTE: corpus is Python-only → this is uniqueness *within Python* (first ring),\n"
    "             not a cross-language verdict.\n"
)


def _print_report(rep: UnitReport) -> None:
    pct = round(rep.uniqueness_ratio * 100)
    print(f"\n◈ {rep.label}")
    print(f"  uniqueness: {pct}%   (unique_mass={rep.unique_mass:.1f} / total={rep.total_mass:.1f})")
    sig = rep.top_signature()
    if sig:
        print("  signature (rarest, heaviest — your fingerprint):")
        for c in sig:
            print(f"    {c.feature:32s} p_nat={c.p_nat:.3f}  w={c.weight:.2f}  ×{c.count}")
    else:
        print("  signature: none above background — reads as ordinary code")


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m rcf_core.measure",
        description="Surprisal mirror: show how unique your protected methods look against ordinary code.",
    )
    parser.add_argument("path", help="project root to measure (its PROTECTED .py files)")
    parser.add_argument("--corpus", metavar="JSON", help="frozen corpus path (default: rcf_core/data/p_nat.json)")
    args = parser.parse_args(argv)

    sigma = load_sigma()
    try:
        corpus = load_corpus(args.corpus, sigma=sigma)
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        print("   Build/freeze a corpus first (rcf_core.corpus).", file=sys.stderr)
        return 1

    print(_BANNER)
    print(f"corpus: {corpus.total_units} units, {len(corpus.doc_freq)} features, Σ {corpus.sigma_version}")

    reports = measure_project(args.path, corpus, sigma)
    if not reports:
        print("\nNo protected Python function units found.")
        return 0

    for rep in reports:
        _print_report(rep)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
