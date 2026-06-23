# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""Tests for the Designed Canary engine (rcf_core.canary)."""

import json
import pytest
from pathlib import Path

from rcf_core.sigma import load_sigma
from rcf_core.pdg import PDG
from rcf_core.normalize_python import normalize_python
from rcf_core.canary import (
    find_subgraph_isomorphisms,
    extract_canary_block,
    CanaryRegistry,
    CanaryRecord,
)

# ─── Subgraph Isomorphism Verification ────────────────────────────────────────

def test_subgraph_isomorphism_exact_match():
    sigma = load_sigma()
    # Simple canary graph
    g_c = PDG(sigma)
    c0 = g_c.add_node("ARITH", "ADD")
    c1 = g_c.add_node("CONST", "NUM")
    g_c.add_edge(c1, c0, "DATA")

    # Target graph containing the canary as a subgraph
    g_t = PDG(sigma)
    t0 = g_t.add_node("ARITH", "ADD")
    t1 = g_t.add_node("CONST", "NUM")
    g_t.add_edge(t1, t0, "DATA")
    # extra noise nodes
    t2 = g_t.add_node("CALL", "FUNC")
    g_t.add_edge(t0, t2, "DATA")

    matches = find_subgraph_isomorphisms(g_c, g_t)
    assert len(matches) == 1
    assert matches[0][c0] == t0
    assert matches[0][c1] == t1


def test_subgraph_isomorphism_wildcard_operator():
    sigma = load_sigma()
    g_c = PDG(sigma)
    # op=None acts as a wildcard for the class
    c0 = g_c.add_node("CONST", None)

    g_t = PDG(sigma)
    t0 = g_t.add_node("CONST", "NUM")
    t1 = g_t.add_node("CONST", "STR")

    matches = find_subgraph_isomorphisms(g_c, g_t)
    # matches should find both since CONST is matched and op is a wildcard
    assert len(matches) == 2
    assert {m[c0] for m in matches} == {t0, t1}


def test_subgraph_isomorphism_mismatch_edges():
    sigma = load_sigma()
    g_c = PDG(sigma)
    c0 = g_c.add_node("ARITH", "ADD")
    c1 = g_c.add_node("CONST", "NUM")
    # edge from c1 -> c0 (DATA)
    g_c.add_edge(c1, c0, "DATA")

    g_t = PDG(sigma)
    t0 = g_t.add_node("ARITH", "ADD")
    t1 = g_t.add_node("CONST", "NUM")
    # wrong edge direction or type (e.g. CTRL)
    g_t.add_edge(t1, t0, "CTRL")

    matches = find_subgraph_isomorphisms(g_c, g_t)
    assert len(matches) == 0


# ─── Block Extraction Verification ───────────────────────────────────────────

def test_extract_canary_block():
    source = """
def process(x):
    # [RCF:CANARY_START]
    tmp = x ^ 98765
    res = tmp ^ (98765 ^ 0xFFFF)
    # [RCF:CANARY_END]
    return res
"""
    extracted = extract_canary_block(source)
    assert "def __canary_dummy():" in extracted
    assert "tmp = x ^ 98765" in extracted
    assert "res = tmp ^ (98765 ^ 0xFFFF)" in extracted
    assert "def process(x):" not in extracted


# ─── Registry Verification ───────────────────────────────────────────────────

def test_registry_register_and_load_save(tmp_path):
    sigma = load_sigma()
    reg_file = tmp_path / "canaries.json"
    
    registry = CanaryRegistry(reg_file, sigma)
    canary_src = "def f(x):\n    return x ^ 42\n"
    registry.register("xor_42", canary_src, "XOR with 42 canary")

    assert "xor_42" in registry.canaries
    assert registry.canaries["xor_42"].description == "XOR with 42 canary"

    # Reload registry
    registry2 = CanaryRegistry(reg_file, sigma)
    assert "xor_42" in registry2.canaries
    assert registry2.canaries["xor_42"].description == "XOR with 42 canary"


# ─── End-to-End Designed Canary Detection ───────────────────────────────────

def test_e2e_canary_detection():
    sigma = load_sigma()
    
    # Canary: Technique 1 - XOR redundant intermediate step
    canary_src = """
def canary():
    tmp = x ^ 12345
    x = tmp ^ (12345 ^ mask)
"""
    g_c = normalize_python(canary_src, sigma)

    # Honest implementation (directly x ^ mask)
    honest_src = """
def solve(x, mask):
    return x ^ mask
"""
    g_honest = normalize_python(honest_src, sigma)

    # Theft implementation with the canary code preserved
    theft_src = """
def solve_stolen(x, mask):
    temp = x ^ 12345
    x = temp ^ (12345 ^ mask)
    return x
"""
    g_theft = normalize_python(theft_src, sigma)

    # 1. Honest implementation must NOT trigger the canary
    honest_matches = find_subgraph_isomorphisms(g_c, g_honest)
    assert len(honest_matches) == 0

    # 2. Theft implementation MUST trigger the canary
    theft_matches = find_subgraph_isomorphisms(g_c, g_theft)
    assert len(theft_matches) >= 1
