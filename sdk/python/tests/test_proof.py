# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Tests for the proof layer — null distribution, p-value / E-value (RCF v3 §5).

The doctrine under test: the headline E-value is a MODEL extrapolation and must
never be passed off as the empirical p (which has a hard 1/(K+1) floor). So the
tests pin BOTH numbers and the floor that separates them.
"""

import json
import math

import pytest

from rcf_core.proof import (
    NullModel,
    build_null,
    evaluate,
    prove,
    prove_sources,
    freeze_null,
    load_null,
)
from rcf_core.corpus import build_corpus
from rcf_core.normalize_python import normalize_python
from rcf_core.sigma import load_sigma, SigmaError

# A structurally VARIED pool so distinct pairs rarely hit corr 1.0 (a duplicate
# structure would put 1.0 into the null and stop a self-score from flooring).
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


def _fixture(seed: int = 7, n_pairs: int = 200):
    sigma = load_sigma()
    corpus = build_corpus(VARIED, sigma)
    null = build_null(VARIED, corpus, sigma, n_pairs=n_pairs, seed=seed)
    return sigma, corpus, null


# ─── 1. self-correlation: huge z, tiny parametric p, empirical floored ─────────

def test_self_correlation_tiny_p_huge_z():
    sigma, corpus, null = _fixture()
    g = normalize_python(VARIED[2], sigma)  # the xor unit
    rep = prove(g, g, null, corpus)

    assert rep.score == pytest.approx(1.0)         # a unit correlates perfectly with itself
    assert rep.z_score > 3.0                        # far out in the null's tail
    assert rep.p_parametric < 1e-3                  # the model says: not chance
    assert rep.p_empirical == pytest.approx(null.p_floor)
    assert rep.empirical_is_floored is True


# ─── 2. unrelated pair: not floored, p sits in the body of the null ────────────

def test_unrelated_pair_p_near_mid():
    sigma, corpus, null = _fixture()
    rep = prove_sources(VARIED[0], VARIED[3], null, corpus, sigma)  # add-1 vs sum-loop

    assert 0.0 < rep.p_empirical <= 1.0
    assert rep.empirical_is_floored is False        # an ordinary, explainable score


# ─── 3. determinism: same seed → identical null ────────────────────────────────

def test_determinism_same_seed_identical_null():
    sigma = load_sigma()
    corpus = build_corpus(VARIED, sigma)
    a = build_null(VARIED, corpus, sigma, n_pairs=200, seed=7)
    b = build_null(VARIED, corpus, sigma, n_pairs=200, seed=7)

    assert a.samples == b.samples
    assert a.mean == b.mean
    assert a.std == b.std
    assert a.n_pairs == b.n_pairs


# ─── 4. a different seed draws different pairs ──────────────────────────────────

def test_different_seed_changes_samples():
    sigma = load_sigma()
    corpus = build_corpus(VARIED, sigma)
    a = build_null(VARIED, corpus, sigma, n_pairs=200, seed=7)
    b = build_null(VARIED, corpus, sigma, n_pairs=200, seed=8)
    assert a.samples != b.samples


# ─── 5. alphabet drift is refused, both in prove() and load_null() ─────────────

def test_alphabet_mismatch_refuses(tmp_path):
    sigma, corpus, null = _fixture()
    g = normalize_python(VARIED[0], sigma)

    # forge the null's alphabet so it disagrees with the live PDG/corpus
    object.__setattr__(null, "alphabet_hash", "sha256:deadbeef")
    with pytest.raises(SigmaError, match="alphabet_hash"):
        prove(g, g, null, corpus)

    # forge it on disk -> load_null refuses under the live Σ
    good = build_null(VARIED, corpus, sigma, n_pairs=50, seed=7)
    path = freeze_null(good, tmp_path / "null_model.json")
    data = json.loads(path.read_text())
    data["alphabet_hash"] = "sha256:deadbeef"
    path.write_text(json.dumps(data))
    with pytest.raises(SigmaError, match="alphabet_hash"):
        load_null(path, sigma=sigma)


# ─── 6. the empirical floor is real and never breached ─────────────────────────

def test_empirical_floor_respected():
    _, _, null = _fixture(n_pairs=200)
    assert null.p_floor == pytest.approx(1 / (null.n_pairs + 1))

    # a score above every sample saturates at the floor, never below
    above = null.samples[-1] + 1.0
    assert null.p_empirical(above) == pytest.approx(null.p_floor)

    for s in (0.0, 0.1, 0.5, 0.9, 1.0, above):
        assert null.p_empirical(s) >= null.p_floor - 1e-12


# ─── 7. parametric p is labeled separately and can reach past the floor ────────

def test_parametric_labeled_separately_and_can_beat_floor():
    sigma, corpus, null = _fixture()
    g = normalize_python(VARIED[2], sigma)
    rep = prove(g, g, null, corpus)

    # the model extrapolates deeper than the empirical floor — and the report
    # carries them as two distinct numbers, never collapsed
    assert rep.p_parametric < rep.p_empirical
    assert rep.p_parametric != rep.p_empirical


# ─── 8. E-value = parametric p × search space (BLAST correction) ───────────────

def test_evalue_is_p_parametric_times_search_space():
    _, _, null = _fixture()
    s = 0.95
    rep = evaluate(s, null, search_space=1000)
    assert rep.e_value == pytest.approx(null.p_parametric(s) * 1000)
    assert rep.search_space == 1000


# ─── 9. freeze / load round-trip; non-json refused ─────────────────────────────

def test_freeze_load_round_trip(tmp_path):
    sigma, _, null = _fixture(n_pairs=120)
    path = freeze_null(null, tmp_path / "null_model.json")
    back = load_null(path, sigma=sigma)

    assert back.n_pairs == null.n_pairs
    assert back.seed == null.seed
    assert back.iterations == null.iterations
    assert back.mean == pytest.approx(null.mean)
    assert back.std == pytest.approx(null.std)
    assert back.samples == null.samples

    with pytest.raises(SigmaError, match="json"):
        freeze_null(null, tmp_path / "null_model.txt")


# ─── 10. the deep tail uses erfc, not a naive 1-cdf that underflows to 0 ────────

def test_parametric_uses_erfc_deep_tail():
    # A synthetic standard-normal null. At z=10 the survival is ~7.6e-24 — a
    # number 1 - NormalDist().cdf(10) underflows to exactly 0.0. erfc keeps it.
    null = NullModel(
        alphabet_hash="x", sigma_version="t", n_pairs=10, seed=0,
        iterations=2, weight_floor=1e-9, mean=0.0, std=1.0,
        samples=tuple(sorted([-1.0, 0.0, 1.0])),
    )
    p = null.p_parametric(10.0)
    assert p > 0.0                      # the whole point: it does NOT underflow to 0
    assert p < 1e-20                    # and it is genuinely deep in the tail
    assert p == pytest.approx(0.5 * math.erfc(10.0 / math.sqrt(2.0)))
