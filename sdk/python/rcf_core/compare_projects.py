# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]

from __future__ import annotations

import math
import sys
from dataclasses import dataclass, field
from pathlib import Path

from .corpus import Corpus, iter_function_units, load_corpus
from .correlate import correlate
from .normalize_python import normalize_python
from .pdg import PDG
from .proof import NullModel, ProofReport, evaluate, load_null
from .sigma import Sigma, SigmaError, load_sigma
from .wl import wl_features


# ─── collecting per-function units from a project tree ────────────────────────

@dataclass
class Unit:
    label: str  # "relative/path.py :: first line of def"
    pdg: PDG
    features: dict[str, int] = field(default_factory=dict)  # cached WL features (unweighted)


def collect_units(
    root: str,
    sigma: Sigma,
    *,
    iterations: int = 2,
    protected_only: bool = False,
) -> list[Unit]:
    """
    Walk `root` for .py files, split each into function units (corpus.py's
    iter_function_units), normalize each to a PDG, and cache its WL features.

    Files/units that fail to parse are skipped — never guessed, same discipline
    as corpus.iter_function_units and measure.measure_source.

    protected_only=True reuses rcf_cli.scanner's is_protected verdict (same
    source measure_project already relies on) to restrict collection to files
    the author marked [RCF:PROTECTED]/[RCF:RESTRICTED] — the realistic framing
    for the "origin" side of a comparison: "does the SUSPECT project (root_b,
    collected in full) contain anything correlating with MY protected units
    (root_a, protected_only=True)?"
    """
    base = Path(root).resolve()
    units: list[Unit] = []

    allowed_paths: set[str] | None = None
    if protected_only:
        from rcf_cli.scanner import RCFScanner

        scanner = RCFScanner(root)
        allowed_paths = {
            res["path"]
            for res in scanner.scan_directory(include_protected=True)
            if res.get("is_protected") and res["path"].endswith(".py")
        }

    for fpath in sorted(base.rglob("*.py")):
        rel = fpath.relative_to(base).as_posix()
        if allowed_paths is not None and rel not in allowed_paths:
            continue
        try:
            src = fpath.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for i, unit_src in enumerate(iter_function_units(src)):
            try:
                pdg = normalize_python(unit_src, sigma)
            except (SyntaxError, ValueError, SigmaError):
                continue
            first = unit_src.strip().splitlines()[0] if unit_src.strip() else f"unit#{i}"
            label = f"{rel} :: {first.strip()[:60]}"
            feats = wl_features(pdg, iterations)
            units.append(Unit(label=label, pdg=pdg, features=feats))
    return units


# ─── §8.3's lossy pre-filter: cheap, unweighted bag-of-features cosine ─────────

def _cosine_from_features(a: dict[str, int], b: dict[str, int]) -> float:
    """Plain (unweighted) cosine over WL feature-count dicts. Deliberately NOT
    the surprisal-weighted corr() of §4 — that is the expensive, corpus-aware
    signal saved for the narrowed candidate set (see prefilter_candidates)."""
    keys = set(a) | set(b)
    if not keys:
        return 0.0
    dot = sum(a.get(k, 0) * b.get(k, 0) for k in keys)
    na = math.sqrt(sum(v * v for v in a.values())) or 1.0
    nb = math.sqrt(sum(v * v for v in b.values())) or 1.0
    return dot / (na * nb)


def prefilter_candidates(
    units_a: list[Unit],
    units_b: list[Unit],
    *,
    threshold: float = 0.6,
    max_candidates: int | None = 500,
) -> list[tuple[Unit, Unit, float]]:
    """
    All-pairs coarse cosine over cached WL features (cheap: dict ops only — no
    corpus, no null). Keeps pairs scoring >= threshold — §8.3's "pairs that
    clear a threshold on the coarse signal" — the narrowed set the expensive
    per-unit proof() below actually runs on.

    O(|units_a| * |units_b|) dict comparisons; fine up to a few thousand units
    per side. For larger projects, raise `threshold`, lower `max_candidates`,
    or shard by file/module before calling this.
    """
    scored: list[tuple[Unit, Unit, float]] = []
    for ua in units_a:
        for ub in units_b:
            s = _cosine_from_features(ua.features, ub.features)
            if s >= threshold:
                scored.append((ua, ub, s))
    scored.sort(key=lambda t: t[2], reverse=True)
    if max_candidates is not None:
        scored = scored[:max_candidates]
    return scored


# ─── §8.4: combining independent fragment p-values (Fisher's method) ──────────
#
# No scipy/numpy in this codebase (pyproject.toml declares dependencies = []),
# so the regularized incomplete gamma function used by the chi-squared survival
# function is implemented from scratch below (Numerical-Recipes-style series /
# continued-fraction split — the standard, numerically stable way to do this
# with nothing but `math`).

def _gammaseries(a: float, x: float, itmax: int = 500, eps: float = 3e-16) -> float:
    if x == 0.0:
        return 0.0
    gln = math.lgamma(a)
    ap = a
    total = 1.0 / a
    delta = total
    for _ in range(itmax):
        ap += 1.0
        delta *= x / ap
        total += delta
        if abs(delta) < abs(total) * eps:
            break
    return total * math.exp(-x + a * math.log(x) - gln)


def _gammacf(a: float, x: float, itmax: int = 500, eps: float = 3e-16, fpmin: float = 1e-300) -> float:
    gln = math.lgamma(a)
    b = x + 1.0 - a
    c = 1.0 / fpmin
    d = 1.0 / b
    h = d
    for i in range(1, itmax + 1):
        an = -i * (i - a)
        b += 2.0
        d = an * d + b
        if abs(d) < fpmin:
            d = fpmin
        c = b + an / c
        if abs(c) < fpmin:
            c = fpmin
        d = 1.0 / d
        delta = d * c
        h *= delta
        if abs(delta - 1.0) < eps:
            break
    return math.exp(-x + a * math.log(x) - gln) * h


def _chi2_sf(x: float, df: int) -> float:
    """Survival function of the chi-squared distribution: P(X > x), X ~ chi2(df),
    via the regularized upper incomplete gamma function Q(df/2, x/2)."""
    if x <= 0:
        return 1.0
    a = df / 2.0
    xx = x / 2.0
    return _gammaseries(a, xx) * -1 + 1.0 if xx < a + 1.0 else _gammacf(a, xx)


def fisher_combine(p_values: list[float]) -> tuple[float, int, float]:
    """
    §8.4: chi2 = -2 * sum(ln(p_i)), df = 2n, combined p = chi2_sf(chi2, df).

    Caller is responsible for the §8.5 caveat this function does not and
    cannot resolve: it assumes the input p-values are independent, which is
    not proven for fragments drawn from the same project (see module
    docstring). Report the combined figure alongside its constituent p_i,
    never alone — the same §5.3 discipline the rest of this codebase follows.
    """
    n = len(p_values)
    if n == 0:
        raise ValueError("fisher_combine requires at least one p-value")
    clipped = [max(p, 1e-300) for p in p_values]  # guard ln(0)
    chi2 = -2.0 * sum(math.log(p) for p in clipped)
    df = 2 * n
    p_combined = _chi2_sf(chi2, df)
    return chi2, df, p_combined


# ─── end-to-end: compare two project roots ─────────────────────────────────────

@dataclass(frozen=True)
class MatchResult:
    label_a: str
    label_b: str
    coarse_score: float
    proof: ProofReport


@dataclass(frozen=True)
class ProjectComparisonReport:
    matches: list[MatchResult]      # all proven candidates, sorted by p_parametric ascending
    significant: list[MatchResult]  # subset with p_parametric < alpha
    fisher_chi2: float | None
    fisher_df: int | None
    fisher_p: float | None
    alpha: float

    def summary(self) -> str:
        lines = [
            f"candidate pairs proven: {len(self.matches)}",
            f"significant matches (p_parametric < {self.alpha:g}): {len(self.significant)}",
        ]
        if self.fisher_p is not None:
            lines.append(
                f"Fisher combined: chi2={self.fisher_chi2:.2f}  df={self.fisher_df}  "
                f"p={self.fisher_p:.2e}  (n={len(self.significant)} fragments)"
            )
        else:
            lines.append("Fisher combined: n/a (fewer than 2 significant fragments)")
        return "\n".join(lines)


def compare_projects(
    root_a: str,
    root_b: str,
    null: NullModel,
    corpus: Corpus,
    sigma: Sigma | None = None,
    *,
    iterations: int = 2,
    protected_only_a: bool = True,
    prefilter_threshold: float = 0.6,
    max_candidates: int = 500,
    alpha: float = 0.01,
    search_space: int | None = None,
) -> ProjectComparisonReport:
    """
    Compare every function unit in `root_a` against every unit in `root_b`.

    Pipeline (§8.3-honest): cheap bag-of-features cosine over ALL pairs ->
    keep candidates >= prefilter_threshold (capped at max_candidates) -> run
    the full, calibrated proof() (§5: corpus-weighted corr + null p-value)
    only on survivors -> combine the resulting p_parametric values with
    Fisher's method (§8.4, with the §8.5 independence caveat unresolved).

    protected_only_a=True (default) restricts root_a's side to RCF-protected
    units only — the realistic framing: "is anything in root_a's protected
    methodology correlated with ANYTHING in root_b" (the suspect project,
    collected in full). Set False to compare every unit on both sides.

    `search_space` defaults to the number of candidate pairs actually proven —
    a simple multiple-testing correction for each individual match's E-value;
    pass an explicit value to override.
    """
    sigma = sigma or load_sigma()
    units_a = collect_units(root_a, sigma, iterations=iterations, protected_only=protected_only_a)
    units_b = collect_units(root_b, sigma, iterations=iterations, protected_only=False)
    if not units_a or not units_b:
        return ProjectComparisonReport([], [], None, None, None, alpha)

    candidates = prefilter_candidates(
        units_a, units_b, threshold=prefilter_threshold, max_candidates=max_candidates
    )
    space = search_space if search_space is not None else max(len(candidates), 1)

    weight = corpus.weight_fn(null.weight_floor)
    matches: list[MatchResult] = []
    for ua, ub, coarse in candidates:
        try:
            score = correlate(ua.pdg, ub.pdg, iterations=iterations, weight=weight)
        except SigmaError:
            continue
        report = evaluate(score, null, search_space=space)
        matches.append(MatchResult(ua.label, ub.label, coarse, report))

    matches.sort(key=lambda m: m.proof.p_parametric)
    significant = [m for m in matches if m.proof.p_parametric < alpha]

    fisher_chi2 = fisher_df = fisher_p = None
    if len(significant) >= 2:
        fisher_chi2, fisher_df, fisher_p = fisher_combine(
            [m.proof.p_parametric for m in significant]
        )

    return ProjectComparisonReport(matches, significant, fisher_chi2, fisher_df, fisher_p, alpha)


# ─── CLI ────────────────────────────────────────────────────────────────────
 
_BANNER = (
    "RCF project comparison — §8 PRACTICAL INTERIM, not the full SDG spec.\n"
    "  this is a bag-of-units comparison with Fisher aggregation (§8.4), NOT\n"
    "  architecture/call-graph correlation (§8.1-8.2) -- that remains unimplemented (§8.5).\n"
    "  Fisher's combined p-value ASSUMES independent fragments; units from one\n"
    "  project are not obviously independent of each other -- treat the combined\n"
    "  figure as a strong LEAD, not a standalone verdict (see §6.3.3 / §8.4).\n"
)


def _cmd_compare(args) -> int:
    sigma = load_sigma()
    try:
        corpus = load_corpus(args.corpus, sigma=sigma)
        null = load_null(args.null, sigma=sigma)
    except SigmaError as e:
        print(f"❌ {e}", file=sys.stderr)
        return 1

    report = compare_projects(
        args.project_a,
        args.project_b,
        null,
        corpus,
        sigma,
        iterations=args.iterations,
        protected_only_a=not args.all_units_a,
        prefilter_threshold=args.prefilter_threshold,
        max_candidates=args.max_candidates,
        alpha=args.alpha,
    )

    print(_BANNER)
    print(report.summary())
    print()
    top_n = args.top
    for m in report.matches[:top_n]:
        floored = "  ← FLOORED" if m.proof.empirical_is_floored else ""
        print(f"◈ {m.label_a}\n  ~ {m.label_b}")
        print(
            f"    coarse={m.coarse_score:.3f}  corr={m.proof.score:.4f}  "
            f"p_empirical={m.proof.p_empirical:.2e}{floored}  "
            f"p_parametric={m.proof.p_parametric:.2e} ← MODEL EXTRAPOLATION  "
            f"E={m.proof.e_value:.2e}"
        )
    if len(report.matches) > top_n:
        print(f"... ({len(report.matches) - top_n} more candidates, see report.matches)")
    return 0


def main(argv: list[str] | None = None) -> int:
    import argparse

    parser = argparse.ArgumentParser(
        prog="python -m rcf_core.compare_projects",
        description="Compare two project trees unit-by-unit and combine evidence with Fisher's method (§8.4, practical interim — see module docstring for what §8 this does NOT implement).",
    )
    parser.add_argument("project_a", help="root of the protected/origin project")
    parser.add_argument("project_b", help="root of the suspect project (scanned in full)")
    parser.add_argument("--all-units-a", action="store_true",
                         help="compare ALL units of project_a, not just RCF-protected ones (default: protected-only)")
    parser.add_argument("--corpus", metavar="JSON", help="frozen corpus path (default: rcf_core/data/p_nat.json)")
    parser.add_argument("--null", metavar="JSON", help="frozen null path (default: rcf_core/data/null_model.json)")
    parser.add_argument("--iterations", type=int, default=2, help="WL depth k (must match the null)")
    parser.add_argument("--prefilter-threshold", type=float, default=0.6, dest="prefilter_threshold",
                         help="coarse cosine cutoff before the expensive proof (default 0.6)")
    parser.add_argument("--max-candidates", type=int, default=500, dest="max_candidates",
                         help="cap candidates proven after pre-filter (default 500)")
    parser.add_argument("--alpha", type=float, default=0.01, help="p_parametric cutoff for 'significant' (default 0.01)")
    parser.add_argument("--top", type=int, default=20, help="how many top matches to print (default 20)")

    args = parser.parse_args(argv)
    return _cmd_compare(args)


if __name__ == "__main__":
    raise SystemExit(main())
