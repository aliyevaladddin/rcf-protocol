# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Tests for the natural-sentinel watch-list (RCF v3, the §6-adjacent RESTRICT tool).

Sentinel's only real contribution over measure.py is ordering: rank protected
units by surprisal mass and cap at top-N. So the tests pin exactly that — the
ranking and the cap — by feeding controlled UnitReports, plus a live smoke test
against a real protected project (rcf_core itself).
"""

import pytest

from rcf_core.sentinel import Sentinel, rank_sentinels
from rcf_core.measure import UnitReport
from rcf_core.corpus import build_corpus
from rcf_core.sigma import load_sigma


def _report(label: str, total: float, unique: float = 0.0) -> UnitReport:
    return UnitReport(label=label, total_mass=total, unique_mass=unique)


# ─── ranking: heaviest surprisal mass first, capped at top_n ───────────────────

def test_ranks_by_mass_desc_and_caps(monkeypatch):
    import rcf_core.sentinel as sentinel

    reports = [
        _report("light", 10.0),
        _report("heavy", 90.0),
        _report("mid", 50.0),
        _report("tiny", 2.0),
    ]
    monkeypatch.setattr(sentinel, "measure_project", lambda *a, **k: reports)

    sigma = load_sigma()
    corpus = build_corpus(["def f(a, b): return a + b"], sigma)
    out = rank_sentinels("ignored", corpus, sigma, top_n=2)

    assert [s.label for s in out] == ["heavy", "mid"]   # heaviest first, capped at 2
    assert all(isinstance(s, Sentinel) for s in out)
    assert out[0].total_mass == 90.0


def test_top_n_larger_than_pool_returns_all(monkeypatch):
    import rcf_core.sentinel as sentinel
    reports = [_report("a", 5.0), _report("b", 3.0)]
    monkeypatch.setattr(sentinel, "measure_project", lambda *a, **k: reports)

    sigma = load_sigma()
    corpus = build_corpus(["def f(a, b): return a + b"], sigma)
    out = rank_sentinels("ignored", corpus, sigma, top_n=10)
    assert [s.label for s in out] == ["a", "b"]          # all of them, still sorted


def test_empty_project_yields_no_sentinels(monkeypatch):
    import rcf_core.sentinel as sentinel
    monkeypatch.setattr(sentinel, "measure_project", lambda *a, **k: [])

    sigma = load_sigma()
    corpus = build_corpus(["def f(a, b): return a + b"], sigma)
    assert rank_sentinels("ignored", corpus, sigma) == []


def test_uniqueness_ratio_carried_through(monkeypatch):
    import rcf_core.sentinel as sentinel
    monkeypatch.setattr(sentinel, "measure_project", lambda *a, **k: [_report("u", 100.0, unique=40.0)])

    sigma = load_sigma()
    corpus = build_corpus(["def f(a, b): return a + b"], sigma)
    out = rank_sentinels("ignored", corpus, sigma)
    assert out[0].uniqueness_ratio == pytest.approx(0.4)   # 40 / 100


# ─── live smoke test against a real protected project ──────────────────────────

def test_live_ranks_rcf_core_protected_units():
    # rcf_core is itself an [RCF:PROTECTED] project, so measure_project finds real
    # units. We don't assert a specific order (corpus-dependent) — only that the
    # tool produces a sane, mass-sorted, capped watch-list end to end.
    sigma = load_sigma()
    corpus = build_corpus(
        ["def f%d(a, b): return a + b" % i for i in range(15)]
        + ["def g%d(x):\n    return (x << 3) ^ (x >> 5) & 0xAB" % i for i in range(15)],
        sigma,
    )
    out = rank_sentinels("rcf_core", corpus, sigma, top_n=3)
    assert len(out) <= 3
    # sorted descending by mass
    masses = [s.total_mass for s in out]
    assert masses == sorted(masses, reverse=True)
