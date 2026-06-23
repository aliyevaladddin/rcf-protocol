import { describe, expect, it } from '@jest/globals';
import { PDG } from '../src/core/pdg.js';
import { loadSigma } from '../src/core/sigma.js';
import { normalizeTypescript } from '../src/core/normalize_typescript.js';
import {
  findSubgraphIsomorphisms,
  extractCanaryBlock,
  CanaryRegistry
} from '../src/core/canary.js';
import fs from 'fs';
import path from 'path';

describe('Designed Canary engine (rcf_core.canary)', () => {
  // 1. subgraph isomorphism exact match
  it('should find exact subgraph isomorphism matches', () => {
    const sigma = loadSigma();
    const g_c = new PDG(sigma);
    const c0 = g_c.addNode('ARITH', 'ADD');
    const c1 = g_c.addNode('CONST', 'NUM');
    g_c.addEdge(c1, c0, 'DATA');

    const g_t = new PDG(sigma);
    const t0 = g_t.addNode('ARITH', 'ADD');
    const t1 = g_t.addNode('CONST', 'NUM');
    g_t.addEdge(t1, t0, 'DATA');
    const t2 = g_t.addNode('CALL', 'FUNC');
    g_t.addEdge(t0, t2, 'DATA');

    const matches = findSubgraphIsomorphisms(g_c, g_t);
    expect(matches.length).toBe(1);
    expect(matches[0][c0]).toBe(t0);
    expect(matches[0][c1]).toBe(t1);
  });

  // 2. subgraph isomorphism wildcard operator
  it('should support wildcard operators', () => {
    const sigma = loadSigma();
    const g_c = new PDG(sigma);
    const c0 = g_c.addNode('CONST', null);

    const g_t = new PDG(sigma);
    const t0 = g_t.addNode('CONST', 'NUM');
    const t1 = g_t.addNode('CONST', 'STR');

    const matches = findSubgraphIsomorphisms(g_c, g_t);
    expect(matches.length).toBe(2);
    const mapped = new Set(matches.map(m => m[c0]));
    expect(mapped.has(t0)).toBe(true);
    expect(mapped.has(t1)).toBe(true);
  });

  // 3. subgraph isomorphism mismatch edges
  it('should handle mismatched edges correctly', () => {
    const sigma = loadSigma();
    const g_c = new PDG(sigma);
    const c0 = g_c.addNode('ARITH', 'ADD');
    const c1 = g_c.addNode('CONST', 'NUM');
    g_c.addEdge(c1, c0, 'DATA');

    const g_t = new PDG(sigma);
    const t0 = g_t.addNode('ARITH', 'ADD');
    const t1 = g_t.addNode('CONST', 'NUM');
    g_t.addEdge(t1, t0, 'CTRL');

    const matches = findSubgraphIsomorphisms(g_c, g_t);
    expect(matches.length).toBe(0);
  });

  // 4. extract canary block
  it('should extract canary blocks correctly', () => {
    const source = `
function process(x) {
    // [RCF:CANARY_START]
    let tmp = x ^ 98765;
    let res = tmp ^ (98765 ^ 0xFFFF);
    // [RCF:CANARY_END]
    return res;
}
`;
    const extracted = extractCanaryBlock(source);
    expect(extracted).toContain('function __canary_dummy()');
    expect(extracted).toContain('let tmp = x ^ 98765;');
    expect(extracted).toContain('let res = tmp ^ (98765 ^ 0xFFFF);');
    expect(extracted).not.toContain('function process(x)');
  });

  // 5. registry register and load save
  it('should handle registering and saving/loading registry files', () => {
    const sigma = loadSigma();
    const regFile = path.resolve('tests/temp_canaries.json');
    if (fs.existsSync(regFile)) {
      fs.unlinkSync(regFile);
    }

    const registry = new CanaryRegistry(regFile, sigma);
    const canarySrc = 'function f(x) {\n    return x ^ 42;\n}\n';
    registry.register('xor_42', canarySrc, 'XOR with 42 canary');

    expect(registry.canaries['xor_42']).toBeDefined();
    expect(registry.canaries['xor_42'].description).toBe('XOR with 42 canary');

    const registry2 = new CanaryRegistry(regFile, sigma);
    expect(registry2.canaries['xor_42']).toBeDefined();
    expect(registry2.canaries['xor_42'].description).toBe('XOR with 42 canary');

    if (fs.existsSync(regFile)) {
      fs.unlinkSync(regFile);
    }
  });

  // 6. end-to-end designed canary detection
  it('should run end-to-end designed canary detection', () => {
    const sigma = loadSigma();
    const canarySrc = `
function canary() {
    let tmp = x ^ 12345;
    x = tmp ^ (12345 ^ mask);
}
`;
    const g_c = normalizeTypescript(canarySrc, sigma);

    const honestSrc = `
function solve(x, mask) {
    return x ^ mask;
}
`;
    const g_honest = normalizeTypescript(honestSrc, sigma);

    const theftSrc = `
function solve_stolen(x, mask) {
    let temp = x ^ 12345;
    x = temp ^ (12345 ^ mask);
    return x;
}
`;
    const g_theft = normalizeTypescript(theftSrc, sigma);

    const honestMatches = findSubgraphIsomorphisms(g_c, g_honest);
    expect(honestMatches.length).toBe(0);

    const theftMatches = findSubgraphIsomorphisms(g_c, g_theft);
    expect(theftMatches.length).toBeGreaterThanOrEqual(1);
  });
});
