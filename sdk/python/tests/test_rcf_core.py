# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""Tests for rcf_core — Σ loader, PDG, and the Python normalizer (RCF v3)."""

import ast
import copy
import json

import pytest

from rcf_core import load_sigma, SigmaError
from rcf_core.sigma import compute_alphabet_hash
from rcf_core.pdg import PDG
from rcf_core.normalize_python import normalize_python


# ─── Σ loader ─────────────────────────────────────────────────────────────────

def test_sigma_loads_and_hash_matches():
    s = load_sigma()
    assert s.version  # non-empty
    assert s.alphabet_hash.startswith("sha256:")
    # the stored hash must equal the recomputed one (no drift in the repo)
    recomputed = compute_alphabet_hash(s.nodes, s.edges)
    assert recomputed == s.alphabet_hash


def test_sigma_label_validation():
    s = load_sigma()
    assert s.is_label("ARITH", "MUL")
    assert s.is_label("ARITH")            # class-only label is valid
    assert not s.is_label("ARITH", "XYZ")  # bogus op
    assert not s.is_label("NOPE")          # bogus class
    assert s.is_edge("DATA") and s.is_edge("CTRL")
    assert set(s.normative_edges()) == {"DATA", "CTRL"}


def test_sigma_detects_alphabet_drift(tmp_path):
    s = load_sigma()
    data = {
        "sigma_version": s.version,
        "alphabet_hash": s.alphabet_hash,  # stale on purpose
        "nodes": copy.deepcopy(s.nodes),
        "edges": copy.deepcopy(s.edges),
    }
    data["nodes"]["ARITH"]["ops"].append("TETRATE")  # change alphabet, keep old hash
    p = tmp_path / "sigma.json"
    p.write_text(json.dumps(data), encoding="utf-8")

    with pytest.raises(SigmaError, match="drift"):
        load_sigma(p)


# ─── PDG rejects non-Σ labels ─────────────────────────────────────────────────

def test_pdg_rejects_out_of_alphabet():
    g = PDG(load_sigma())
    g.add_node("ARITH", "MUL")  # ok
    with pytest.raises(SigmaError):
        g.add_node("ARITH", "BOGUS")
    with pytest.raises(SigmaError):
        g.add_node("BOGUS")


# ─── Python normalizer ────────────────────────────────────────────────────────

WORKED_EXAMPLE = """
def f(data):
    total = 0
    for item in data:
        result = item * 2
        if result > 10:
            total = total + result
    return total
"""


def test_normalizer_labels_are_all_in_sigma():
    s = load_sigma()
    g = normalize_python(WORKED_EXAMPLE, s)
    for n in g.nodes:
        assert s.is_label(n.cls, n.op), f"label not in Σ: {n.label}"
    for e in g.edges:
        assert s.is_edge(e.etype)


def test_normalizer_matches_worked_example():
    g = normalize_python(WORKED_EXAMPLE)
    labels = g.label_multiset()
    # the §6 example must produce these semantic operations
    assert labels.get("ARITH.MUL") == 1
    assert labels.get("ARITH.ADD") == 1
    assert labels.get("CMP.GT") == 1
    assert labels.get("LOOP.FOR") == 1
    assert labels.get("BRANCH.IF") == 1
    assert labels.get("RET.RETURN") == 1
    # both edge kinds appear (data flow + control dependence)
    assert {e.etype for e in g.edges} == {"DATA", "CTRL"}


def test_no_identifier_text_leaks_into_graph():
    # Checks the REAL invariant: no node label is an identifier from the source.
    # (Unlike a naive substring scan of the serialized blob, which false-matches
    #  on hex digests — e.g. 'data' inside a sha256 string.)
    src = "def secretfn(payload):\n    magicvar = payload * 7\n    return magicvar\n"
    g = normalize_python(src)
    identifiers = {"secretfn", "payload", "magicvar"}
    for n in g.nodes:
        assert n.cls not in identifiers
        assert n.op not in identifiers
        assert n.label not in identifiers
    # the literal 7 collapses to CONST.NUM, not its value
    assert g.label_multiset().get("CONST.NUM") == 1


def test_constants_collapse_by_kind_not_value():
    # 1, 1.0, 999999 must all be CONST.NUM — concrete values are not in Σ.
    g = normalize_python("def f():\n    return 1 + 1.0 + 999999\n")
    assert g.label_multiset().get("CONST.NUM") == 3


def test_translation_invariance_smoke():
    # Same method, different surface form (renamed identifiers, reordered-irrelevant)
    # must yield the same label multiset — the core promise of the PDG approach.
    a = normalize_python("def f(x):\n    y = x * 2\n    return y\n")
    b = normalize_python("def g(input):\n    out = input * 2\n    return out\n")
    assert a.label_multiset() == b.label_multiset()
