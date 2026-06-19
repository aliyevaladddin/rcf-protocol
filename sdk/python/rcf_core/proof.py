# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Proof — from a score to court-grade evidence (RCF-CORRELATION.md §5).

correlate() gives a number, corr(A,B) ∈ [0,1]. A number alone proves nothing:
"87% similar" is not an argument. §5 demands a NULL of comparison — the
distribution of corr over provably-INDEPENDENT pairs drawn from the corpus —
and then a p-value / E-value against it, exactly as BLAST reports an E-value for
a DNA match:

    p-value = Pr[ corr ≥ s | independent ]

That — "E-value = 1e-9, independent origin is statistically excluded" — is the
legally durable claim the premium audit sells. This is the DETECT side turned
outward: it answers "could a thief have re-invented this method by chance?".

────────────────────────────────────────────────────────────────────────────
THE HONESTY TENSION (doctrine: no stub gates — an open door is more honest than
a cardboard one). The EMPIRICAL p-value has a hard resolution floor:

    p_empirical ≥ 1 / (K + 1)     where K = number of null pairs

With a few thousand pairs it CANNOT reach 1e-9 — it physically bottoms out.
The headline 1e-9 can only come from a PARAMETRIC tail model (an extrapolation
past where we have samples). So this module never collapses the two into one
unlabeled number. A ProofReport always carries BOTH:

  - p_empirical, with its floor stated (what the samples actually support), and
  - p_parametric, explicitly a MODEL EXTRAPOLATION (a normal-tail survival fit).

The E-value is built on the parametric p (the only one that can express the
headline), but the empirical p and its floor sit right beside it so the basis is
never hidden.

HONEST LIMIT (§8.2, growth-ring doctrine): the null is built from Python units,
so "independence" is judged WITHIN Python — the first ring. A cross-language null
is a later ring over the same interface. We never present a single-language null
as the whole truth.
"""

from __future__ import annotations

import bisect
import json
import math
import random
import statistics
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .correlate import _weighted_cosine, correlate
from .corpus import (
    Corpus,
    _safe_join_within,
    collect_project_background_sources,
    collect_stdlib_sources,
    load_corpus,
)
from .normalize_python import normalize_python
from .pdg import PDG
from .sigma import Sigma, SigmaError, load_sigma
from .wl import wl_features

_DEFAULT_NULL_PATH = Path(__file__).resolve().parent / "data" / "null_model.json"

# A fixed default seed so the headline claim is reproducible out of the box: same
# pool + same seed → identical samples → identical p-value. An opposing expert can
# reload the exact exhibit and recompute. (Not a date — Date.now() is forbidden in
# this codebase's reproducibility discipline; the seed is a chosen constant.)
_DEFAULT_SEED = 20250619


# ─── the null model: a frozen distribution of "independent-pair" correlations ──

@dataclass(frozen=True)
class NullModel:
    """
    The distribution of corr over provably-independent unit pairs — the reference
    against which an observed score is judged. The reproducible court exhibit:
    its `samples` (sorted) + `seed` + `n_pairs` pin the exact null, and its
    `alphabet_hash` refuses comparison under a drifted Σ.
    """

    alphabet_hash: str
    sigma_version: str
    n_pairs: int
    seed: int
    iterations: int
    weight_floor: float
    mean: float
    std: float
    samples: tuple[float, ...]  # sorted ascending

    @property
    def p_floor(self) -> float:
        """The finest p the empirical null can resolve: 1/(K+1). Below this is model."""
        return 1.0 / (self.n_pairs + 1)

    def p_empirical(self, score: float) -> float:
        """
        Empirical right-tail p: (#{null ≥ score} + 1) / (K + 1).

        The +1 is a Laplace guard so a score above every sample never reports an
        impossible p of exactly 0 — it reports the floor instead. bisect over the
        sorted samples keeps this O(log K).
        """
        if self.n_pairs == 0:
            return 1.0
        # index of the first sample >= score; everything from there up is the tail
        idx = bisect.bisect_left(self.samples, score)
        ge = len(self.samples) - idx
        return (ge + 1) / (self.n_pairs + 1)

    def z_score(self, score: float) -> float:
        """Standard score against the null. Degenerate null (std==0) → 0.0."""
        if self.std == 0.0:
            return 0.0
        return (score - self.mean) / self.std

    def p_parametric(self, score: float) -> float:
        """
        Parametric right-tail p — a MODEL EXTRAPOLATION. Normal survival of the
        z-score, computed as 0.5*erfc(z/√2) rather than 1 - Φ(z): the headline
        lives at 1e-9 … 1e-30, exactly where 1 - cdf underflows to 0.0, while
        erfc stays accurate deep in the tail. That accuracy is the honest
        implementation of the 1e-9 claim.

        MODELING CHOICE (spec is silent on the family): a normal tail. corr ∈ [0,1]
        is right-skewed, so a Gaussian slightly overstates deep-tail symmetry — a
        right-tail EVD/Gumbel fit (what BLAST uses for max-scores) is the next ring,
        deliberately not built now. The `p_parametric` label + the empirical floor
        beside it keep this an extrapolation in the open, never a disguised fact.
        Degenerate null (std==0) → 1.0 (refuse to over-claim).
        """
        if self.std == 0.0:
            return 1.0
        z = self.z_score(score)
        return 0.5 * math.erfc(z / math.sqrt(2.0))


@dataclass(frozen=True)
class ProofReport:
    """One observed score, judged against a null. Carries BOTH p's by design."""

    score: float
    z_score: float
    p_empirical: float
    p_empirical_floor: float
    p_parametric: float
    e_value: float
    n_pairs: int
    search_space: int = 1

    @property
    def empirical_is_floored(self) -> bool:
        """True when the score saturates the null — empirical p can't resolve finer."""
        return self.p_empirical <= self.p_empirical_floor + 1e-300


# ─── building the null ─────────────────────────────────────────────────────────

def _pool_from_sources(
    unit_sources: Iterable[str], sigma: Sigma, iterations: int
) -> list[dict[str, int]]:
    """
    Lower each unit source to its WL feature vector ONCE. The frozen corpus only
    keeps aggregated doc_freq — per-unit vectors are gone — so the null must
    re-walk the actual sources. Units that don't parse or yield no features are
    skipped, never guessed (mirrors build_corpus).
    """
    pool: list[dict[str, int]] = []
    for src in unit_sources:
        try:
            pdg = normalize_python(src, sigma)
        except (SyntaxError, ValueError, SigmaError):
            continue
        feats = wl_features(pdg, iterations)
        if not feats:
            continue
        pool.append(feats)
    return pool


def build_null(
    unit_sources: Iterable[str],
    corpus: Corpus,
    sigma: Sigma | None = None,
    *,
    n_pairs: int = 5000,
    seed: int = _DEFAULT_SEED,
    iterations: int = 2,
) -> NullModel:
    """
    Build the null distribution of corr over independent unit pairs.

    The weight in every pairwise cosine is the CORPUS's surprisal weight
    (corpus.weight_fn) — the same idiosyncrasy weighting used in a real
    comparison, so the null is calibrated to the same feature space. `corpus` is
    passed ONLY for that weight.

    "Independent pair" = two DISTINCT background units (self-pairs are excluded so
    a corr of 1.0 can never contaminate the null). Sampling is seeded: same pool +
    same seed → identical samples.

    Refuses (SigmaError) if the corpus alphabet disagrees with the live Σ — the
    corpus weight and the pool PDGs must live under one alphabet.
    """
    sigma = sigma or load_sigma()
    if corpus.alphabet_hash != sigma.alphabet_hash:
        raise SigmaError(
            "incomparable: corpus and live Σ alphabet_hash differ\n"
            f"  corpus: {corpus.alphabet_hash}\n"
            f"  live  : {sigma.alphabet_hash}"
        )

    weight_floor = 1e-9
    weight = corpus.weight_fn(weight_floor)
    pool = _pool_from_sources(unit_sources, sigma, iterations)
    n = len(pool)
    if n < 2:
        raise SigmaError(f"null needs ≥2 usable units, got {n}")

    rng = random.Random(seed)
    scores: list[float] = []
    for _ in range(n_pairs):
        i = rng.randrange(n)
        j = rng.randrange(n)
        while j == i:  # distinct units only — no self-pair
            j = rng.randrange(n)
        scores.append(_weighted_cosine(pool[i], pool[j], weight))

    return NullModel(
        alphabet_hash=sigma.alphabet_hash,
        sigma_version=sigma.version,
        n_pairs=len(scores),
        seed=seed,
        iterations=iterations,
        weight_floor=weight_floor,
        mean=statistics.fmean(scores),
        std=statistics.pstdev(scores),
        samples=tuple(sorted(scores)),
    )


# ─── scoring an observation against the null ───────────────────────────────────

def evaluate(score: float, null: NullModel, *, search_space: int = 1) -> ProofReport:
    """
    Judge an observed score against a null. Pure arithmetic — no graph work.

    E-value = p_parametric × search_space (BLAST multiple-testing correction):
    the empirical p cannot express the headline (it bottoms at the floor), so the
    E-value rides the parametric p. The empirical p and its floor are carried in
    the report alongside, so the parametric basis is explicit, never an unlabeled
    collapse.
    """
    return ProofReport(
        score=score,
        z_score=null.z_score(score),
        p_empirical=null.p_empirical(score),
        p_empirical_floor=null.p_floor,
        p_parametric=null.p_parametric(score),
        e_value=null.p_parametric(score) * search_space,
        n_pairs=null.n_pairs,
        search_space=search_space,
    )


def prove(
    a: PDG,
    b: PDG,
    null: NullModel,
    corpus: Corpus,
    *,
    iterations: int = 2,
    search_space: int = 1,
) -> ProofReport:
    """
    Correlate two PDGs under the corpus surprisal weight and judge the score
    against the null. Refuses (SigmaError) unless all four — both PDGs, the corpus
    and the null — share one alphabet_hash, and unless `iterations` matches the
    null's (a null calibrates exactly one feature-space depth).
    """
    hashes = {
        "A": a.sigma.alphabet_hash,
        "B": b.sigma.alphabet_hash,
        "corpus": corpus.alphabet_hash,
        "null": null.alphabet_hash,
    }
    if len(set(hashes.values())) != 1:
        detail = "\n".join(f"  {k:6s}: {v}" for k, v in hashes.items())
        raise SigmaError("incomparable: alphabet_hash mismatch\n" + detail)
    if iterations != null.iterations:
        raise SigmaError(
            "iterations mismatch: the null calibrates one feature space\n"
            f"  requested : {iterations}\n"
            f"  null built: {null.iterations}"
        )
    score = correlate(a, b, iterations=iterations, weight=corpus.weight_fn(null.weight_floor))
    return evaluate(score, null, search_space=search_space)


def prove_sources(
    src_a: str,
    src_b: str,
    null: NullModel,
    corpus: Corpus,
    sigma: Sigma | None = None,
    *,
    iterations: int = 2,
    search_space: int = 1,
) -> ProofReport:
    """Convenience: normalize two source strings, then prove()."""
    sigma = sigma or load_sigma()
    a = normalize_python(src_a, sigma)
    b = normalize_python(src_b, sigma)
    return prove(a, b, null, corpus, iterations=iterations, search_space=search_space)


# ─── freeze / load (alphabet-bound, like corpus.freeze/load_corpus) ────────────

def freeze_null(null: NullModel, path: str | Path | None = None) -> Path:
    """
    Write a null model to JSON — the reproducible court exhibit. Constrained to a
    .json file (normalizes dynamic input before a filesystem write).
    """
    p = (Path(path) if path is not None else _DEFAULT_NULL_PATH).resolve()
    if p.suffix.lower() != ".json":
        raise SigmaError(f"null target must be a .json file, got: {p.name}")
    p.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "alphabet_hash": null.alphabet_hash,
        "sigma_version": null.sigma_version,
        "n_pairs": null.n_pairs,
        "seed": null.seed,
        "iterations": null.iterations,
        "weight_floor": null.weight_floor,
        "mean": null.mean,
        "std": null.std,
        "samples": list(null.samples),
    }
    p.write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")), encoding="utf-8")
    return p


def load_null(
    path: str | Path | None = None,
    *,
    sigma: Sigma | None = None,
    verify_alphabet: bool = True,
) -> NullModel:
    """
    Load a frozen null and (by default) refuse it if its alphabet_hash disagrees
    with the live Σ — the samples were calibrated under a different alphabet and
    are not comparable. Mirrors load_corpus.
    """
    p = (Path(path) if path is not None else _DEFAULT_NULL_PATH).resolve()
    if p.suffix.lower() != ".json":
        raise SigmaError(f"null source must be a .json file, got: {p.name}")
    if not p.is_file():
        raise SigmaError(f"null model not found at: {p}")

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SigmaError(f"null model is not valid JSON: {e}") from e

    required = (
        "alphabet_hash", "sigma_version", "n_pairs", "seed",
        "iterations", "weight_floor", "mean", "std", "samples",
    )
    for key in required:
        if key not in data:
            raise SigmaError(f"null model missing required key: {key!r}")

    if verify_alphabet:
        live = (sigma or load_sigma()).alphabet_hash
        if data["alphabet_hash"] != live:
            raise SigmaError(
                "null model alphabet_hash mismatch — rebuild the null for this Σ.\n"
                f"  null: {data['alphabet_hash']}\n"
                f"  live: {live}"
            )

    return NullModel(
        alphabet_hash=data["alphabet_hash"],
        sigma_version=data["sigma_version"],
        n_pairs=int(data["n_pairs"]),
        seed=int(data["seed"]),
        iterations=int(data["iterations"]),
        weight_floor=float(data["weight_floor"]),
        mean=float(data["mean"]),
        std=float(data["std"]),
        samples=tuple(sorted(float(x) for x in data["samples"])),  # re-sort defensively
    )


# ─── CLI ──────────────────────────────────────────────────────────────────────

_BANNER = (
    "RCF proof of origin — the E-value is a MODEL EXTRAPOLATION, stated as one.\n"
    "  empirical p has a hard floor of 1/(K+1); it can never reach 1e-9 at this K.\n"
    "  the headline E-value rides a normal-tail model fitted to the null — labeled, not hidden.\n"
    "  RING NOTE: the null is Python-only → independence is judged within Python (first ring).\n"
)


def _read_file(path: str) -> str:
    base = Path.cwd().resolve()
    fpath = _safe_join_within(base, path) if not Path(path).is_absolute() else Path(path).resolve()
    return fpath.read_text(encoding="utf-8", errors="ignore")


def _cmd_build_null(args) -> int:
    import os
    import time

    sigma = load_sigma()
    try:
        corpus = load_corpus(args.corpus, sigma=sigma)
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        print("   Build/freeze a corpus first (python -m rcf_core.corpus).", file=sys.stderr)
        return 1

    t0 = time.time()
    print("collecting stdlib sources...")
    sources = collect_stdlib_sources(limit=args.limit)
    if args.limit is not None and len(sources) >= args.limit:
        print(f"  NOTE: hit --limit={args.limit} — pool is TRUNCATED, not exhaustive")
    print(f"  stdlib units: {len(sources)}  ({time.time() - t0:.1f}s)")

    if args.project:
        proj = collect_project_background_sources(args.project)
        print(f"  project background units (non-protected): {len(proj)}")
        sources = sources + proj

    try:
        null = build_null(
            sources, corpus, sigma,
            n_pairs=args.n_pairs, seed=args.seed, iterations=args.iterations,
        )
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1

    print(
        f"  null: {null.n_pairs} pairs, mean={null.mean:.4f}, std={null.std:.4f}, "
        f"p_floor={null.p_floor:.2e}, Σ {null.sigma_version} (seed={null.seed}, k={null.iterations})"
    )
    path = freeze_null(null, args.out)
    print(f"frozen to: {path}  ({os.path.getsize(path)} bytes)")
    return 0


def _cmd_compare(args) -> int:
    sigma = load_sigma()
    try:
        corpus = load_corpus(args.corpus, sigma=sigma)
        null = load_null(args.null, sigma=sigma)
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1

    try:
        src_a = _read_file(args.file_a)
        src_b = _read_file(args.file_b)
    except (ValueError, OSError) as e:
        print(f"❌ cannot read input: {e}", file=sys.stderr)
        return 1

    try:
        rep = prove_sources(
            src_a, src_b, null, corpus, sigma,
            iterations=args.iterations, search_space=args.search_space,
        )
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1

    print(_BANNER)
    floored = "  ← FLOORED (saturates the null)" if rep.empirical_is_floored else ""
    print(f"score        = {rep.score:.4f}")
    print(f"z-score      = {rep.z_score:.2f}   (vs null mean={null.mean:.4f} std={null.std:.4f}, K={null.n_pairs})")
    print(f"p_empirical  = {rep.p_empirical:.2e}   (floor {rep.p_empirical_floor:.2e}){floored}")
    print(f"p_parametric = {rep.p_parametric:.2e}   ← MODEL EXTRAPOLATION (normal-tail survival)")
    print(f"E-value      = {rep.e_value:.2e}   (search_space={rep.search_space})")
    return 0


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m rcf_core.proof",
        description="Court-grade proof: judge a correlation score against a null (p-value / E-value).",
    )
    sub = parser.add_subparsers(dest="cmd")

    pb = sub.add_parser("build-null", help="build & freeze the null distribution from the corpus pool")
    pb.add_argument("--project", metavar="ROOT", help="also fold a project's NON-protected .py into the pool")
    pb.add_argument("--limit", type=int, default=None, help="cap stdlib units (omit = full stdlib)")
    pb.add_argument("--corpus", metavar="JSON", help="frozen corpus path (default: rcf_core/data/p_nat.json)")
    pb.add_argument("--n-pairs", type=int, default=5000, dest="n_pairs", help="number of null pairs (K)")
    pb.add_argument("--seed", type=int, default=_DEFAULT_SEED, help="RNG seed (reproducibility)")
    pb.add_argument("--iterations", type=int, default=2, help="WL depth k")
    pb.add_argument("--out", metavar="JSON", help="output path (default: rcf_core/data/null_model.json)")

    pc = sub.add_parser("compare", help="score two files and report p-value / E-value")
    pc.add_argument("file_a")
    pc.add_argument("file_b")
    pc.add_argument("--null", metavar="JSON", help="frozen null path (default: rcf_core/data/null_model.json)")
    pc.add_argument("--corpus", metavar="JSON", help="frozen corpus path (default: rcf_core/data/p_nat.json)")
    pc.add_argument("--iterations", type=int, default=2, help="WL depth k (must match the null)")
    pc.add_argument("--search-space", type=int, default=1, dest="search_space", help="E-value multiple-testing size")

    args = parser.parse_args(argv)
    if args.cmd == "build-null":
        return _cmd_build_null(args)
    if args.cmd == "compare":
        return _cmd_compare(args)
    parser.print_help()
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
