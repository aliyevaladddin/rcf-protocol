# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Tests for compare_projects.py — the §8 practical-interim whole-project comparator.

The doctrine under test:
  - a renamed/cosmetically-refactored copy of a protected unit is found and
    scored as significant (low p_parametric), the way a single-pair prove()
    already would (§5) — this module just runs that machinery across every
    pair in two trees instead of one pair by hand;
  - unrelated code produces no significant match;
  - the cheap pre-filter (unweighted cosine) actually prunes — it is not a
    no-op that lets everything through to the expensive proof() stage;
  - Fisher's combination (§8.4) matches its closed-form definition exactly,
    including on known chi-squared reference points, independent of the rest
    of the pipeline;
  - protected_only_a actually restricts collection to RCF-marked files, the
    same is_protected verdict rcf_cli.scanner / measure_project already rely
    on — this module does not reinvent that detection.
"""

from __future__ import annotations

import math

import pytest

from rcf_core.corpus import build_corpus
from rcf_core.proof import build_null
from rcf_core.sigma import load_sigma
from rcf_core.compare_projects import (
    collect_units,
    compare_projects,
    fisher_combine,
    prefilter_candidates,
    _chi2_sf,
    _cosine_from_features,
)

# Same discipline as test_proof.py's VARIED pool: structurally varied units so
# distinct pairs rarely collide at corr 1.0 by accident.
VARIED = [
    "def a(x): return x + 1",
    "def b(x): return x * 2",
    "def c(x):\n    return (x << 3) ^ (x >> 5)",
    "def d(x):\n    s = 0\n    for i in x:\n        s = s + i\n    return s",
    "def e(x, y):\n    if x > y:\n        return x\n    return y",
    "def f(x):\n    return x & 0xAB",
    "def g(x):\n    return [i * i for i in x]",
    "def h(x):\n    while x > 0:\n        x = x - 1\n    return x",
    "def n(a, b, c):\n    return a * b + c - a",
    "def j(x):\n    try:\n        return 1 / x\n    except ZeroDivisionError:\n        return 0",
    "def k(x):\n    return x ** 2 + 2 * x + 1",
    "def m(s):\n    return s.upper().strip()",
]

# An "idiosyncratic" pair: same arbitrary, functionally-neutral quirks (odd
# modulus, xor-then-multiply ordering, reversed-if-long-enough logic) that an
# honest independent author would not reproduce by chance (§4.1).
ORIGINAL_SRC = '''
def weird_checksum_v7(data):
    total = 0
    skip_every = 7
    for idx, byte in enumerate(data):
        if idx % skip_every == 3:
            total = total ^ (byte << 2)
        else:
            total = total + byte * 13
        total = total & 0xFFFFFFFF
    return total ^ 0xDEADBEEF


def normalize_header_block(raw):
    parts = []
    buffer = []
    for ch in raw:
        if ch == '|':
            parts.append(''.join(buffer))
            buffer = []
        else:
            buffer.append(ch)
    if buffer:
        parts.append(''.join(buffer))
    reordered = parts[::-1] if len(parts) > 2 else parts
    return '::'.join(reordered)
'''

# Same methodology, every identifier renamed — simulates an AI/human rewrite
# that preserves the PDG (§1.1: identifiers do not survive translation, the
# dependence structure does).
COPY_SRC = '''
def compute_hash_thing(payload):
    acc = 0
    step = 7
    for i, b in enumerate(payload):
        if i % step == 3:
            acc = acc ^ (b << 2)
        else:
            acc = acc + b * 13
        acc = acc & 0xFFFFFFFF
    return acc ^ 0xDEADBEEF


def rebuild_header_segment(text):
    segments = []
    buf = []
    for c in text:
        if c == '|':
            segments.append(''.join(buf))
            buf = []
        else:
            buf.append(c)
    if buf:
        segments.append(''.join(buf))
    flipped = segments[::-1] if len(segments) > 2 else segments
    return '::'.join(flipped)
'''

UNRELATED_SRC = '''
def add_all(numbers):
    result = 0
    for n in numbers:
        result += n
    return result


def find_max(items):
    best = items[0]
    for item in items[1:]:
        if item > best:
            best = item
    return best
'''


def _fixture(seed: int = 7, n_pairs: int = 200):
    sigma = load_sigma()
    corpus = build_corpus(VARIED, sigma)
    null = build_null(VARIED, corpus, sigma, n_pairs=n_pairs, seed=seed)
    return sigma, corpus, null


def _write_project(tmp_path, name: str, files: dict[str, str], protected: bool = False):
    """Write {relative_path: source} under tmp_path/name. `protected=True` adds
    the RCF header so rcf_cli.scanner's is_protected verdict picks the file up,
    the same convention measure_project already relies on."""
    root = tmp_path / name
    root.mkdir()
    for rel, src in files.items():
        if protected:
            src = "# NOTICE: This file is protected under RCF-PL\n# [RCF:PROTECTED]\n" + src
        (root / rel).write_text(src)
    return root


# ─── 1. end-to-end: a renamed copy is found and scored significant ─────────────

def test_renamed_copy_is_significant(tmp_path):
    sigma, corpus, null = _fixture()
    root_a = _write_project(tmp_path, "project_a", {"core.py": ORIGINAL_SRC}, protected=True)
    root_b = _write_project(tmp_path, "project_b", {"engine.py": COPY_SRC})

    report = compare_projects(
        str(root_a), str(root_b), null, corpus, sigma,
        prefilter_threshold=0.3, alpha=0.05,
    )

    assert len(report.matches) == 2          # both functions paired with their renamed twin
    assert len(report.significant) == 2
    for m in report.matches:
        assert m.proof.score == pytest.approx(1.0)       # identical PDG after renaming
        assert m.proof.p_parametric < 1e-6                # not chance, per the model
    # Fisher's combined figure is strictly more extreme than either single p
    assert report.fisher_p is not None
    assert report.fisher_p < min(m.proof.p_parametric for m in report.significant)


# ─── 2. unrelated code: no significant match ────────────────────────────────────

def test_unrelated_code_has_no_significant_match(tmp_path):
    sigma, corpus, null = _fixture()
    root_a = _write_project(tmp_path, "project_a", {"core.py": ORIGINAL_SRC}, protected=True)
    root_c = _write_project(tmp_path, "project_c", {"utils.py": UNRELATED_SRC})

    report = compare_projects(
        str(root_a), str(root_c), null, corpus, sigma,
        prefilter_threshold=0.3, alpha=0.05,
    )

    assert report.significant == []
    assert report.fisher_p is None
    assert report.fisher_chi2 is None


# ─── 3. protected_only_a actually restricts collection ─────────────────────────

def test_protected_only_restricts_side_a(tmp_path):
    sigma = load_sigma()
    root = _write_project(
        tmp_path, "mixed_project",
        {"protected.py": ORIGINAL_SRC, "scratch.py": UNRELATED_SRC},
    )
    # mark only protected.py
    (root / "protected.py").write_text(
        "# NOTICE: This file is protected under RCF-PL\n# [RCF:PROTECTED]\n" + ORIGINAL_SRC
    )

    all_units = collect_units(str(root), sigma, protected_only=False)
    protected_units = collect_units(str(root), sigma, protected_only=True)

    assert len(all_units) == 4          # 2 functions x 2 files
    assert len(protected_units) == 2    # only protected.py's 2 functions
    assert all("protected.py" in u.label for u in protected_units)


# ─── 4. the pre-filter actually prunes, it is not a pass-through ───────────────

def test_prefilter_prunes_dissimilar_pairs(tmp_path):
    sigma = load_sigma()
    units_a = collect_units(str(_write_project(tmp_path, "a", {"x.py": ORIGINAL_SRC})), sigma)
    units_b = collect_units(str(_write_project(tmp_path, "b", {"y.py": UNRELATED_SRC})), sigma)

    loose = prefilter_candidates(units_a, units_b, threshold=0.0)
    strict = prefilter_candidates(units_a, units_b, threshold=0.95)

    assert len(loose) == len(units_a) * len(units_b)   # threshold 0 lets everything through
    assert len(strict) < len(loose)                     # a high bar prunes dissimilar pairs
    assert all(score >= 0.95 for *_pair, score in strict)


def test_prefilter_respects_max_candidates(tmp_path):
    sigma = load_sigma()
    units_a = collect_units(str(_write_project(tmp_path, "a", {"x.py": ORIGINAL_SRC})), sigma)
    units_b = collect_units(str(_write_project(tmp_path, "b", {"y.py": ORIGINAL_SRC})), sigma)

    capped = prefilter_candidates(units_a, units_b, threshold=0.0, max_candidates=1)
    assert len(capped) == 1


# ─── 5. cosine helper: identity, symmetry, bounds ───────────────────────────────

def test_cosine_from_features_basic_properties():
    a = {"f1": 2, "f2": 1}
    b = {"f1": 2, "f2": 1}
    c = {"f3": 5}

    assert _cosine_from_features(a, b) == pytest.approx(1.0)   # identical -> 1.0
    assert _cosine_from_features(a, c) == pytest.approx(0.0)   # disjoint -> 0.0
    assert _cosine_from_features(a, b) == pytest.approx(_cosine_from_features(b, a))  # symmetric
    assert _cosine_from_features({}, {}) == 0.0                # empty guard, no ZeroDivisionError


# ─── 6. chi-squared survival function against known reference points ───────────

@pytest.mark.parametrize("x,df,expected", [
    (3.841, 1, 0.05),
    (5.991, 2, 0.05),
    (9.488, 4, 0.05),
    (18.307, 10, 0.05),
])
def test_chi2_sf_matches_known_critical_values(x, df, expected):
    assert _chi2_sf(x, df) == pytest.approx(expected, abs=1e-3)


def test_chi2_sf_edge_cases():
    assert _chi2_sf(0.0, 4) == 1.0
    assert _chi2_sf(-1.0, 4) == 1.0     # non-positive x -> certainty, never raises


# ─── 7. Fisher's method: closed-form check + monotonicity ──────────────────────

def test_fisher_combine_matches_closed_form():
    ps = [0.05, 0.05]
    chi2, df, p = fisher_combine(ps)

    expected_chi2 = -2.0 * sum(math.log(p_i) for p_i in ps)
    assert chi2 == pytest.approx(expected_chi2)
    assert df == 2 * len(ps)
    assert p == pytest.approx(_chi2_sf(chi2, df))


def test_fisher_combine_more_evidence_is_more_significant():
    # adding another small p-value should only make the combined figure more
    # extreme, never less — more independent corroborating fragments strengthens
    # the lead (§6.3.3 / §8.4 doctrine), it does not dilute it.
    _, _, p_two = fisher_combine([0.01, 0.01])
    _, _, p_three = fisher_combine([0.01, 0.01, 0.01])
    assert p_three < p_two


def test_fisher_combine_rejects_empty_input():
    with pytest.raises(ValueError):
        fisher_combine([])


def test_fisher_combine_guards_against_log_zero():
    # a p-value of exactly 0.0 must not raise (math.log(0) domain error) —
    # the module clips to a floor before taking the log.
    chi2, df, p = fisher_combine([0.0, 0.5])
    assert math.isfinite(chi2)
    assert 0.0 <= p <= 1.0
