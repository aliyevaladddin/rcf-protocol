# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Corpus — the reference background for surprisal (RCF-CORRELATION.md §4.2, §8.2).

§4.2 defines P_nat(f) as "the probability that an *independent* implementation
produces feature f, estimated over a large reference corpus." §8.2 names the
corpus as the one missing piece: "P_nat(f) needs a corpus. Proof quality equals
corpus quality."

This module builds that corpus. The estimator is **document frequency** — the
fraction of independent function units in which feature f appears at all:

    P_nat(f) = (# units containing f) / (total units)

That is the "IDF" in the §4.3 "TF-IDF for code graphs" analogy, and it matches
the spec wording exactly: an estimate of how often an independent unit *produces*
f. Counting presence (not multiplicity) is deliberate — we ask whether the world
re-invents the feature, not how heavily one author leans on it.

A frozen corpus carries the `alphabet_hash` it was built under. Two things are
only comparable under the same Σ (RCF-SIGMA.md §7), so `load_corpus` refuses a
corpus whose alphabet_hash disagrees with the live Σ — a drift tripwire, exactly
like `load_sigma`.

HONEST LIMIT (§8.2, and the "growth ring" doctrine): a corpus built from Python
stdlib measures what is banal *in Python*. That is the first ring — an
intra-language surprisal. Cross-language P_nat is a later ring over the same
interface. We never present a single-language corpus as the whole truth.
"""

from __future__ import annotations

import ast
import json
import os
import sysconfig
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .correlate import WeightFn, surprisal_weight_from_corpus
from .normalize_python import normalize_python
from .sigma import Sigma, SigmaError, load_sigma
from .wl import wl_features

_DEFAULT_CORPUS_PATH = Path(__file__).resolve().parent / "data" / "p_nat.json"


def _safe_join_within(base: Path, rel: str) -> Path:
    """
    Resolve `rel` under `base` and refuse anything that escapes `base` — a
    path-traversal guard for paths coming from a scanner result (dynamic input).
    Mirrors the constraint already used in rcf_cli.scanner._load_rcfignore.
    """
    base = base.resolve()
    p = (base / rel).resolve()
    if base != p and base not in p.parents:
        raise ValueError(f"path escapes project root: {rel!r}")
    return p


# ─── splitting a module into independent function units ───────────────────────

def iter_function_units(source: str) -> list[str]:
    """
    Split a Python module into per-function source units.

    Every `def`/`async def` (top-level OR nested) becomes its own unit, because
    a "method" in RCF terms is a function's logic. Returning each function's own
    source (via ast.get_source_segment) keeps a unit self-contained: a nested
    helper is counted once in its own right, not folded into its parent.

    Files that do not parse are skipped (returns []), never guessed.
    """
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return []

    units: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            seg = ast.get_source_segment(source, node)
            if seg:
                units.append(seg)
    return units


# ─── the corpus object ────────────────────────────────────────────────────────

@dataclass(frozen=True)
class Corpus:
    """A frozen background distribution: feature -> in how many units it appeared."""

    alphabet_hash: str
    sigma_version: str
    total_units: int
    doc_freq: dict[str, int]

    def p_nat(self) -> dict[str, float]:
        """P_nat(f) = doc_freq(f) / total_units. Empty corpus -> empty map."""
        if self.total_units == 0:
            return {}
        n = float(self.total_units)
        return {f: c / n for f, c in self.doc_freq.items()}

    def weight_fn(self, floor: float = 1e-9) -> WeightFn:
        """
        The surprisal weight w(f) = -log P_nat(f) for this corpus. Reuses the
        canonical builder in correlate.py — the formula has exactly one home.
        A feature unseen in the corpus is maximally surprising (floor -> big w).
        """
        return surprisal_weight_from_corpus(self.p_nat(), floor=floor)

    def weight_threshold(self, percentile: float = 0.5) -> float:
        """
        A corpus-RELATIVE banality cut: the `percentile`-th weight among the
        corpus's own features. A unit feature lighter than this is "as common as
        the typical feature" → banal; heavier → rarer-than-typical → signature.

        Why relative: at scale, deep WL features are combinatorially many and each
        rare, so a FIXED P_nat cut marks almost everything "unique" (ratio
        saturates). Anchoring banality to the corpus's own weight distribution
        re-separates banal from rare regardless of corpus size.

        percentile ∈ [0,1]. 0.5 = median feature weight. Empty corpus → 0.0.
        """
        if not self.doc_freq:
            return 0.0
        w = self.weight_fn()
        weights = sorted(w(f) for f in self.doc_freq)
        idx = min(len(weights) - 1, max(0, int(percentile * (len(weights) - 1))))
        return weights[idx]


def build_corpus(
    unit_sources: Iterable[str],
    sigma: Sigma | None = None,
    *,
    iterations: int = 2,
) -> Corpus:
    """
    Build a Corpus from an iterable of *independent* function-unit sources.

    Each unit is lowered to a PDG and reduced to its SET of WL features (presence,
    not count) so document frequency counts units, not feature multiplicity.
    """
    sigma = sigma or load_sigma()
    doc_freq: dict[str, int] = {}
    total = 0

    for src in unit_sources:
        try:
            pdg = normalize_python(src, sigma)
        except (SyntaxError, ValueError, SigmaError):
            continue
        feats = wl_features(pdg, iterations)
        if not feats:
            continue
        total += 1
        for f in feats:  # iterate keys -> presence, dedup per unit
            doc_freq[f] = doc_freq.get(f, 0) + 1

    return Corpus(
        alphabet_hash=sigma.alphabet_hash,
        sigma_version=sigma.version,
        total_units=total,
        doc_freq=doc_freq,
    )


# ─── freeze / load (alphabet-bound, like load_sigma) ──────────────────────────

def freeze(corpus: Corpus, path: str | Path | None = None) -> Path:
    """Write a corpus to JSON. Creates the parent dir if needed."""
    # Resolve and constrain the target: a corpus is only ever a .json file. This
    # normalizes any dynamic input before it reaches a filesystem write.
    p = (Path(path) if path is not None else _DEFAULT_CORPUS_PATH).resolve()
    if p.suffix.lower() != ".json":
        raise SigmaError(f"corpus target must be a .json file, got: {p.name}")
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "alphabet_hash": corpus.alphabet_hash,
        "sigma_version": corpus.sigma_version,
        "total_units": corpus.total_units,
        "doc_freq": corpus.doc_freq,
    }
    p.write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")), encoding="utf-8")
    return p


def load_corpus(
    path: str | Path | None = None,
    *,
    sigma: Sigma | None = None,
    verify_alphabet: bool = True,
) -> Corpus:
    """
    Load a frozen corpus and (by default) refuse it if its alphabet_hash does not
    match the live Σ — a feature means something different under a different Σ.
    """
    p = (Path(path) if path is not None else _DEFAULT_CORPUS_PATH).resolve()
    if p.suffix.lower() != ".json":
        raise SigmaError(f"corpus source must be a .json file, got: {p.name}")
    if not p.is_file():
        raise SigmaError(f"corpus not found at: {p}")

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SigmaError(f"corpus is not valid JSON: {e}") from e

    for key in ("alphabet_hash", "sigma_version", "total_units", "doc_freq"):
        if key not in data:
            raise SigmaError(f"corpus missing required key: {key!r}")

    if verify_alphabet:
        live = (sigma or load_sigma()).alphabet_hash
        if data["alphabet_hash"] != live:
            raise SigmaError(
                "corpus alphabet_hash mismatch — rebuild the corpus for this Σ.\n"
                f"  corpus: {data['alphabet_hash']}\n"
                f"  live  : {live}"
            )

    return Corpus(
        alphabet_hash=data["alphabet_hash"],
        sigma_version=data["sigma_version"],
        total_units=int(data["total_units"]),
        doc_freq=dict(data["doc_freq"]),
    )


# ─── stdlib source collection (the "banal in the world" half of the background) ─

def collect_stdlib_sources(limit: int | None = None) -> list[str]:
    """
    Collect per-function source units from the current Python's standard library.

    Walks the stdlib directory (sysconfig 'stdlib' path), reads .py files, and
    splits each into function units. Excludes test suites and site-packages so
    the background is "ordinary library code", not third-party noise.

    `limit` caps the number of UNITS for quick runs. When a cap truncates, the
    caller is expected to log it — silent truncation reads as "covered all" when
    it did not (no-silent-caps).
    """
    stdlib_dir = sysconfig.get_paths().get("stdlib")
    if not stdlib_dir or not os.path.isdir(stdlib_dir):
        return []
    base = Path(stdlib_dir).resolve()

    units: list[str] = []
    for root, dirs, files in os.walk(base):
        # prune noise: tests, site-packages, dunder dirs
        dirs[:] = [
            d for d in dirs
            if d not in ("test", "tests", "site-packages", "__pycache__")
            and not d.startswith("test_")
        ]
        for fname in files:
            if not fname.endswith(".py"):
                continue
            try:
                fpath = (Path(root) / fname).resolve()
                if base != fpath and base not in fpath.parents:
                    continue  # stay within the stdlib tree
                src = fpath.read_text(encoding="utf-8", errors="ignore")
            except (ValueError, OSError):
                continue
            for unit in iter_function_units(src):
                units.append(unit)
                if limit is not None and len(units) >= limit:
                    return units
    return units


def collect_project_background_sources(root: str) -> list[str]:
    """
    Collect function units from a project's NON-protected files — "ordinary code
    by the same author". Protected files are EXCLUDED on purpose: folding the
    method into its own background would teach the background the method's rarity
    and cancel its surprisal (RCF-SIGMA self-poisoning).

    Reuses rcf_cli.scanner for the is_protected verdict.
    """
    from rcf_cli.scanner import RCFScanner

    base = Path(root).resolve()
    scanner = RCFScanner(root)
    units: list[str] = []
    for res in scanner.scan_directory(include_protected=True):
        if res.get("is_protected"):
            continue  # background is the *un*protected world only
        if not res["path"].endswith(".py"):
            continue
        try:
            fpath = _safe_join_within(base, res["path"])  # reject path traversal
            src = fpath.read_text(encoding="utf-8", errors="ignore")
        except (ValueError, OSError):
            continue
        units.extend(iter_function_units(src))
    return units


# ─── CLI: build & freeze the corpus (the artifact is generated, not committed) ─

def main(argv: list[str] | None = None) -> int:
    import argparse
    import time

    parser = argparse.ArgumentParser(
        prog="python -m rcf_core.corpus",
        description="Build & freeze the P_nat surprisal corpus (stdlib + a project's non-protected code).",
    )
    parser.add_argument("--project", metavar="ROOT", help="also fold this project's NON-protected .py as background")
    parser.add_argument("--limit", type=int, default=None, help="cap stdlib units (omit = full stdlib)")
    parser.add_argument("--out", metavar="JSON", help="output path (default: rcf_core/data/p_nat.json)")
    args = parser.parse_args(argv)

    sigma = load_sigma()
    t0 = time.time()
    print("collecting stdlib sources...")
    stdlib = collect_stdlib_sources(limit=args.limit)
    if args.limit is not None and len(stdlib) >= args.limit:
        print(f"  NOTE: hit --limit={args.limit} — corpus is TRUNCATED, not exhaustive")
    print(f"  stdlib units: {len(stdlib)}  ({time.time() - t0:.1f}s)")

    proj: list[str] = []
    if args.project:
        proj = collect_project_background_sources(args.project)
        print(f"  project background units (non-protected): {len(proj)}")

    corpus = build_corpus(stdlib + proj, sigma)
    print(f"  corpus: {corpus.total_units} units, {len(corpus.doc_freq)} features, Σ {corpus.sigma_version}")

    path = freeze(corpus, args.out)
    print(f"frozen to: {path}  ({os.path.getsize(path)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
