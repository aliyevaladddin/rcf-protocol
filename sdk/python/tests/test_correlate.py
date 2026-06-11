# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""Tests for the WL-kernel and surprisal-weighted correlation (RCF v3 §3.1, §4.3)."""

import math

import pytest

from rcf_core import (
    load_sigma,
    normalize_python,
    wl_features,
    correlate,
    surprisal_weight_from_corpus,
)
from rcf_core.sigma import SigmaError


# ─── WL features ──────────────────────────────────────────────────────────────

def test_wl_includes_all_levels():
    g = normalize_python("def f(x):\n    return x * 2\n")
    f0 = wl_features(g, iterations=0)
    f2 = wl_features(g, iterations=2)
    # level-0 only -> all features namespaced L0
    assert all(k.startswith("L0:") for k in f0)
    # deeper run includes L0, L1, L2 namespaces
    levels = {k.split(":", 1)[0] for k in f2}
    assert levels == {"L0", "L1", "L2"}


def test_wl_rejects_negative_iterations():
    g = normalize_python("def f():\n    return 1\n")
    with pytest.raises(ValueError):
        wl_features(g, iterations=-1)


# ─── correlation core properties ──────────────────────────────────────────────

def test_corr_self_is_one():
    g = normalize_python("def f(x):\n    y = x * 2\n    return y\n")
    assert correlate(g, g) == pytest.approx(1.0)


def test_corr_renamed_identical_is_one():
    # The central RCF v3 claim: identifiers don't matter, the method does.
    a = normalize_python("def f(x):\n    y = x * 2\n    return y\n")
    b = normalize_python("def g(input):\n    out = input * 2\n    return out\n")
    assert correlate(a, b) == pytest.approx(1.0)


def test_corr_different_method_is_less_than_one():
    a = normalize_python("def f(x):\n    return x * 2\n")
    b = normalize_python("def f(x):\n    return x + 99\n")
    c = correlate(a, b)
    assert 0.0 < c < 1.0


def test_corr_is_symmetric():
    a = normalize_python("def f(x):\n    y = x * 2\n    return y\n")
    b = normalize_python("def k(a, b):\n    for i in a:\n        return i\n    return 0\n")
    assert correlate(a, b) == pytest.approx(correlate(b, a))


def test_corr_in_unit_interval():
    a = normalize_python("def f(x):\n    return x * 2 + 1\n")
    b = normalize_python("def g(y):\n    for z in y:\n        if z > 0:\n            return z\n")
    c = correlate(a, b)
    assert 0.0 <= c <= 1.0


# ─── comparability guard ──────────────────────────────────────────────────────

def test_corr_refuses_mismatched_alphabet(monkeypatch):
    a = normalize_python("def f(x):\n    return x\n")
    b = normalize_python("def g(y):\n    return y\n")
    # Forge a different alphabet_hash on b's sigma view.
    object.__setattr__(b.sigma, "alphabet_hash", "sha256:deadbeef")
    with pytest.raises(SigmaError, match="alphabet_hash mismatch"):
        correlate(a, b)


# ─── surprisal weight wiring ──────────────────────────────────────────────────

def test_surprisal_weight_downweights_common_features():
    # A feature seen often (high P_nat) must weigh LESS than a rare one.
    w = surprisal_weight_from_corpus({"L0:ARITH.MUL": 0.9, "L0:CONST.NUM": 0.5})
    common = w("L0:ARITH.MUL")     # P_nat 0.9 -> small surprisal
    rare = w("L0:REF.GLOBAL")      # unseen -> floor -> large surprisal
    assert rare > common
    assert common == pytest.approx(-math.log(0.9))


def test_surprisal_weighted_corr_still_unit_on_self():
    # Whatever the weights, A vs A must remain 1.0.
    g = normalize_python("def f(x):\n    y = x * 2\n    return y\n")
    w = surprisal_weight_from_corpus({"L0:ARITH.MUL": 0.01})
    assert correlate(g, g, weight=w) == pytest.approx(1.0)
