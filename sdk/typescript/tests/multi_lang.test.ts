import { describe, expect, it } from '@jest/globals';
import { normalizeGo } from '../src/core/normalize_go.js';
import { normalizeRust } from '../src/core/normalize_rust.js';
import { loadSigma } from '../src/core/sigma.js';
import { buildCorpus } from '../src/core/corpus.js';
import { buildNull, prove } from '../src/core/proof.js';

describe('Cross-language Tree-sitter Normalizers', () => {
  it('should normalize Go source code to PDG', () => {
    const source = `
package main

func AddAndCompare(x int, y int) bool {
    sum := x + y
    return sum > 10
}
`;
    const pdg = normalizeGo(source);
    const nodes = pdg.nodes;

    // Check we have nodes mapped to Sigma
    expect(nodes.length).toBeGreaterThan(0);

    // Should contain ARITH.ADD, RET.RETURN, CMP.GT etc.
    const ops = nodes.map(n => n.op);
    expect(ops).toContain('ADD');
    expect(ops).toContain('GT');
    expect(ops).toContain('RETURN');
  });

  it('should normalize Rust source code to PDG', () => {
    const source = `
fn add_and_compare(x: i32, y: i32) -> bool {
    let sum = x + y;
    sum > 10
}
`;
    const pdg = normalizeRust(source);
    const nodes = pdg.nodes;

    // Check we have nodes mapped to Sigma
    expect(nodes.length).toBeGreaterThan(0);

    const ops = nodes.map(n => n.op);
    expect(ops).toContain('ADD');
    expect(ops).toContain('GT');
  });

  it('should prove similarity between Go and Rust implementations', () => {
    const goSource = `
package main
func Calc(a int, b int) int {
    return a + b
}
`;
    const rustSource = `
fn calc(a: i32, b: i32) -> i32 {
    return a + b;
}
`;

    const pool = [
      'function f(x) { return x + 1; }',
      'function g(y) { return y * 2; }',
      'function h(z) { return z - 3; }'
    ];

    const sigma = loadSigma();
    const corpus = buildCorpus(pool, sigma);
    const nullModel = buildNull(pool, corpus, sigma, { nPairs: 50, seed: 42 });

    const pdgGo = normalizeGo(goSource, sigma);
    const pdgRust = normalizeRust(rustSource, sigma);

    const rep = prove(pdgGo, pdgRust, nullModel, corpus);

    expect(rep.score).toBeCloseTo(1.0, 5);
    expect(rep.significant).toBe(true);
  });
});
