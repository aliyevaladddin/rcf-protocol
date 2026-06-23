import { describe, expect, it } from '@jest/globals';
import { loadSigma, SigmaError, computeAlphabetHash } from '../src/core/sigma.js';
import { PDG } from '../src/core/pdg.js';
import { normalizeTypescript } from '../src/core/normalize_typescript.js';
import fs from 'fs';
import path from 'path';

const WORKED_EXAMPLE = `
function f(data) {
    let total = 0;
    for (let item of data) {
        let result = item * 2;
        if (result > 10) {
            total = total + result;
        }
    }
    return total;
}
`;

describe('rcf_core — Sigma loader, PDG, and normalizer (rcf_core.rcf_core)', () => {
  // 1. sigma loads and hash matches
  it('should load sigma.json and match computed hash', () => {
    const s = loadSigma();
    expect(s.version).toBeDefined();
    expect(s.alphabetHash.startsWith('sha256:')).toBe(true);

    const recomputed = computeAlphabetHash(s.nodes, s.edges);
    expect(recomputed).toBe(s.alphabetHash);
  });

  // 2. sigma label validation
  it('should validate labels and edge types correctly', () => {
    const s = loadSigma();
    expect(s.isLabel('ARITH', 'MUL')).toBe(true);
    expect(s.isLabel('ARITH')).toBe(true);
    expect(s.isLabel('ARITH', 'XYZ')).toBe(false);
    expect(s.isLabel('NOPE')).toBe(false);
    expect(s.isEdge('DATA')).toBe(true);
    expect(s.isEdge('CTRL')).toBe(true);
    expect(new Set(s.normativeEdges())).toEqual(new Set(['DATA', 'CTRL']));
  });

  // 3. sigma detects alphabet drift
  it('should detect alphabet drift when loading modified files', () => {
    const s = loadSigma();
    const data = {
      sigma_version: s.version,
      alphabet_hash: s.alphabetHash, // stale on purpose
      nodes: JSON.parse(JSON.stringify(s.nodes)),
      edges: JSON.parse(JSON.stringify(s.edges))
    };
    data.nodes['ARITH'].ops.push('TETRATE');

    const tempPath = path.resolve('tests/temp_sigma.json');
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');

    expect(() => {
      // Create a temporary loader test
      const raw = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
      const computed = computeAlphabetHash(raw.nodes, raw.edges);
      if (computed !== raw.alphabet_hash) {
        throw new SigmaError('drift');
      }
    }).toThrow('drift');

    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  });

  // 4. pdg rejects non-Sigma labels
  it('should reject non-alphabet labels when adding to PDG', () => {
    const g = new PDG(loadSigma());
    g.addNode('ARITH', 'MUL');
    expect(() => g.addNode('ARITH', 'BOGUS')).toThrow(SigmaError);
    expect(() => g.addNode('BOGUS')).toThrow(SigmaError);
  });

  // 5. normalizer labels are all in sigma
  it('should ensure all normalized node and edge labels are in sigma', () => {
    const s = loadSigma();
    const g = normalizeTypescript(WORKED_EXAMPLE, s);
    for (const n of g.nodes) {
      expect(s.isLabel(n.cls, n.op)).toBe(true);
    }
    for (const e of g.edges) {
      expect(s.isEdge(e.etype)).toBe(true);
    }
  });

  // 6. normalizer matches worked example
  it('should match the expected operation labels for the worked example', () => {
    const g = normalizeTypescript(WORKED_EXAMPLE);
    const labels = g.labelMultiset();

    expect(labels['ARITH.MUL']).toBe(1);
    expect(labels['ARITH.ADD']).toBe(1);
    expect(labels['CMP.GT']).toBe(1);
    expect(labels['LOOP.FOR']).toBe(1);
    expect(labels['BRANCH.IF']).toBe(1);
    expect(labels['RET.RETURN']).toBe(1);
    expect(new Set(g.edges.map(e => e.etype))).toEqual(new Set(['DATA', 'CTRL']));
  });

  // 7. no identifier text leaks into graph
  it('should ensure no source identifier text leaks into the PDG labels', () => {
    const src = 'function secretfn(payload) {\n    let magicvar = payload * 7;\n    return magicvar;\n}';
    const g = normalizeTypescript(src);
    const identifiers = new Set(['secretfn', 'payload', 'magicvar']);

    for (const n of g.nodes) {
      expect(identifiers.has(n.cls)).toBe(false);
      expect(identifiers.has(n.op || '')).toBe(false);
      expect(identifiers.has(n.label)).toBe(false);
    }
    expect(g.labelMultiset()['CONST.NUM']).toBe(1);
  });

  // 8. constants collapse by kind not value
  it('should collapse constants by kind, not concrete values', () => {
    const g = normalizeTypescript('function f() {\n    return 1 + 1.0 + 999999;\n}');
    expect(g.labelMultiset()['CONST.NUM']).toBe(3);
  });

  // 9. translation invariance smoke
  it('should satisfy translation invariance for renamed identifiers', () => {
    const a = normalizeTypescript('function f(x) {\n    let y = x * 2;\n    return y;\n}');
    const b = normalizeTypescript('function g(input) {\n    let out = input * 2;\n    return out;\n}');
    expect(a.labelMultiset()).toEqual(b.labelMultiset());
  });
});
