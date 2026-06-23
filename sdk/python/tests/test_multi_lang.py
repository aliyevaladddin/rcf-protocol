# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Unit tests for cross-language integration (Python, Go, Rust) in Python SDK.
"""

from pathlib import Path
import pytest

from rcf_core.sigma import load_sigma
from rcf_core.normalize import normalize_by_extension
from rcf_core.proof import prove_sources_from_files, build_null, NullModel
from rcf_core.corpus import build_corpus


def test_normalize_go_via_node():
    go_src = """
package main

func AddAndCompare(x int, y int) bool {
    sum := x + y
    return sum > 10
}
"""
    sigma = load_sigma()
    pdg = normalize_by_extension(go_src, "test.go", sigma)
    
    assert len(pdg.nodes) > 0
    ops = [n.op for n in pdg.nodes]
    assert "ADD" in ops
    assert "GT" in ops
    assert "RETURN" in ops


def test_normalize_rust_via_node():
    rust_src = """
fn add_and_compare(x: i32, y: i32) -> bool {
    let sum = x + y;
    sum > 10
}
"""
    sigma = load_sigma()
    pdg = normalize_by_extension(rust_src, "test.rs", sigma)
    
    assert len(pdg.nodes) > 0
    ops = [n.op for n in pdg.nodes]
    assert "ADD" in ops
    assert "GT" in ops


def test_prove_sources_from_files_cross_lang(tmp_path):
    # Go file
    go_file = tmp_path / "calc.go"
    go_file.write_text("""
package main
func Calc(a int, b int) int {
    return a + b
}
""", encoding="utf-8")

    # Rust file
    rust_file = tmp_path / "calc.rs"
    rust_file.write_text("""
fn calc(a: i32, b: i32) -> i32 {
    return a + b;
}
""", encoding="utf-8")

    # Python background corpus/null
    pool = [
        "def f(x):\n    return x + 1",
        "def g(y):\n    return y * 2",
        "def h(z):\n    return z - 3",
    ]
    sigma = load_sigma()
    corpus = build_corpus(pool, sigma)
    null_model = build_null(pool, corpus, sigma, n_pairs=50, seed=42)

    # Prove similarity between Go and Rust implementations
    rep = prove_sources_from_files(
        go_file, rust_file, null_model, corpus, sigma, iterations=2
    )

    # They implement the identical logic (a + b), so they should correlate perfectly
    assert rep.score == pytest.approx(1.0)
    assert rep.significant is True
