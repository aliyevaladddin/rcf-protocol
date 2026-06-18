# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""Tests for the surprisal corpus and the measure mirror (RCF v3 §4.2, RESTRICT side)."""

import math

import pytest

from rcf_core.sigma import load_sigma, SigmaError
from rcf_core.corpus import (
    iter_function_units,
    build_corpus,
    freeze,
    load_corpus,
)
from rcf_core.measure import measure_source, measure_unit
from rcf_core.normalize_python import normalize_python


# ─── unit splitting ───────────────────────────────────────────────────────────

def test_iter_function_units_splits_nested_and_multiple():
    src = (
        "def outer(x):\n"
        "    def inner(y):\n"
        "        return y * 2\n"
        "    return inner(x)\n"
        "\n"
        "def other(a, b):\n"
        "    return a + b\n"
    )
    units = iter_function_units(src)
    assert len(units) == 3  # outer, inner, other

    # a non-parsing source yields nothing, never guesses
    assert iter_function_units("def broken(:\n") == []


# ─── document-frequency corpus ────────────────────────────────────────────────

def test_corpus_docfreq_banal_weighs_less_than_rare():
    sigma = load_sigma()
    corpus = build_corpus(
        [
            "def f1(a, b): return a + b",
            "def f2(c, d): return c + d",
            "def f3(e, g): return e + g",
            "def rare(x):\n    return (x << 3) ^ (x >> 5)",
        ],
        sigma,
    )
    assert corpus.total_units == 4
    p_nat = corpus.p_nat()
    w = corpus.weight_fn()

    add = next(f for f in p_nat if "ARITH.ADD" in f)
    xor = next(f for f in p_nat if "BIT.XOR" in f)
    assert p_nat[add] == pytest.approx(0.75)  # 3 of 4 units
    assert p_nat[xor] == pytest.approx(0.25)  # 1 of 4 units
    assert w(add) < w(xor)                     # banal weighs less
    assert w(add) == pytest.approx(-math.log(0.75))


# ─── alphabet binding (drift tripwire) ────────────────────────────────────────

def test_load_corpus_refuses_alphabet_mismatch(tmp_path):
    sigma = load_sigma()
    corpus = build_corpus(["def f(a, b): return a + b"], sigma)
    path = freeze(corpus, tmp_path / "p_nat.json")

    # round-trips fine under the same Σ
    loaded = load_corpus(path, sigma=sigma)
    assert loaded.total_units == corpus.total_units

    # forge a different alphabet_hash on disk -> refuse
    import json
    data = json.loads(path.read_text())
    data["alphabet_hash"] = "sha256:deadbeef"
    path.write_text(json.dumps(data))
    with pytest.raises(SigmaError, match="alphabet_hash mismatch"):
        load_corpus(path, sigma=sigma)


# ─── protected code must NOT poison the background ────────────────────────────

def test_protected_feature_unseen_in_background_is_maximally_surprising():
    # The background is ordinary code only; a method's rare feature is absent
    # from it, so its P_nat is 0 -> floor -> maximal surprisal.
    sigma = load_sigma()
    background = build_corpus(["def f%d(a, b): return a + b" % i for i in range(10)], sigma)
    p_nat = background.p_nat()

    # a XOR feature never appears in the add-only background
    assert not any("BIT.XOR" in f for f in p_nat)
    w = background.weight_fn(floor=1e-9)
    # unseen feature gets the floor surprisal, far above any seen one
    unseen = w("L0:BIT.XOR")
    seen = w(next(f for f in p_nat if "ARITH.ADD" in f))
    assert unseen > seen


# ─── the mirror: banal vs unique ──────────────────────────────────────────────

def test_measure_banal_low_unique_high():
    sigma = load_sigma()
    background = build_corpus(
        ["def f%d(a, b): return a + b" % i for i in range(20)]
        + ["def g%d(x):\n    s = 0\n    for i in x:\n        s = s + i\n    return s" % i for i in range(20)],
        sigma,
    )

    banal = measure_source("def add(a, b):\n    return a + b\n", background, sigma)[0]
    unique = measure_source(
        "def weird(x):\n    y = (x << 3) ^ (x >> 5)\n    return y & 0xAB\n", background, sigma
    )[0]

    # Raw surprisal MASS separates the two at ANY corpus size — it is the signal
    # we trust unconditionally (a rare unit carries far more surprisal). The
    # uniqueness RATIO needs a rich corpus to calibrate (verified live against the
    # 16k-unit stdlib corpus: trivial≈0%, sum-loop≈16%, bit-hash≈74%); on tiny
    # synthetic corpora the median cut degenerates, so we don't assert it here.
    assert unique.total_mass > banal.total_mass
    assert unique.total_mass > 5 * banal.total_mass


def test_weight_threshold_is_corpus_relative():
    # Regression for the scale bug found live: a FIXED P_nat cut saturated the
    # ratio near 100% on a large corpus. The cut must instead be DERIVED from the
    # corpus's own weight distribution. We build a Corpus with a CONTROLLED
    # doc_freq (a real, non-degenerate spread of frequencies) and assert the
    # median weight lands between a common feature and a rare one — separation
    # comes from the corpus's own distribution, no hardcoded P_nat anywhere.
    from rcf_core.corpus import Corpus

    sigma = load_sigma()
    # 100 units. "common" appears in 90, "mid" in 50, "rare" in 2.
    corpus = Corpus(
        alphabet_hash=sigma.alphabet_hash,
        sigma_version=sigma.version,
        total_units=100,
        doc_freq={"common": 90, "mid": 50, "rare": 2},
    )
    w = corpus.weight_fn()
    cut = corpus.weight_threshold(0.5)  # median of the three feature weights

    assert w("common") < w("mid") < w("rare")   # rarer == heavier
    assert w("common") <= cut <= w("rare")        # the cut splits common from rare
    assert cut > 0.0


def test_measure_refuses_alphabet_mismatch():
    sigma = load_sigma()
    corpus = build_corpus(["def f(a, b): return a + b"], sigma)
    pdg = normalize_python("def g(a, b): return a + b", sigma)
    # forge the corpus alphabet so it disagrees with the live PDG
    object.__setattr__(corpus, "alphabet_hash", "sha256:deadbeef")
    with pytest.raises(SigmaError, match="alphabet_hash"):
        measure_unit(pdg, corpus)
