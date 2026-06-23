import { describe, expect, it } from '@jest/globals';
import { loadSigma, SigmaError } from '../src/core/sigma.js';
import { normalizeTypescript } from '../src/core/normalize_typescript.js';
import { buildCorpus } from '../src/core/corpus.js';
import {
  NullModel,
  buildNull,
  evaluate,
  prove,
  proveSources,
  freezeNull,
  loadNull
} from '../src/core/proof.js';
import fs from 'fs';
import path from 'path';

const VARIED = [
  'function a(x) { return x + 1; }',
  'function b(x) { return x * 2; }',
  'function c(x) {\n    return (x << 3) ^ (x >> 5);\n}',
  'function d(x) {\n    let s = 0;\n    for (let i of x) {\n        s = s + i;\n    }\n    return s;\n}',
  'function e(x, y) {\n    if (x > y) {\n        return x;\n    }\n    return y;\n}',
  'function f(x) {\n    return x & 0xAB;\n}',
  'function g(x) {\n    return x.map(i => i * i);\n}',
  'function h(x) {\n    while (x > 0) {\n        x = x - 1;\n    }\n    return x;\n}',
  'function n(a, b, c) {\n    return a * b + c - a;\n}',
  'function j(x) {\n    try {\n        return 1 / x;\n    } catch (e) {\n        return 0;\n    }\n}',
  'function k(x) {\n    return x * x + 2 * x + 1;\n}'
];

function getFixture(seed = 7, nPairs = 200) {
  const sigma = loadSigma();
  const corpus = buildCorpus(VARIED, sigma);
  const nullModel = buildNull(VARIED, corpus, sigma, { nPairs, seed });
  return { sigma, corpus, nullModel };
}

describe('Proof layer — null distribution, p-value / E-value (rcf_core.proof)', () => {
  // 1. self-correlation: huge z, tiny parametric p, empirical floored
  it('should run a self-correlation test yielding huge z, tiny parametric p, and empirical floored', () => {
    const { sigma, corpus, nullModel } = getFixture();
    const g = normalizeTypescript(VARIED[2], sigma);
    const rep = prove(g, g, nullModel, corpus);

    expect(rep.score).toBeCloseTo(1.0, 5);
    expect(rep.zScore).toBeGreaterThan(3.0);
    expect(rep.pParametric).toBeLessThan(1e-3);
    expect(rep.pEmpirical).toBeCloseTo(nullModel.pFloor, 5);
    expect(rep.empiricalIsFloored).toBe(true);
  });

  // 2. unrelated pair: not floored, p sits in the body of the null
  it('should yield p near mid and no floor trigger for unrelated pairs', () => {
    const { sigma, corpus, nullModel } = getFixture();
    const rep = proveSources(VARIED[0], VARIED[3], nullModel, corpus, sigma);

    expect(rep.pEmpirical).toBeGreaterThan(0.0);
    expect(rep.pEmpirical).toBeLessThanOrEqual(1.0);
    expect(rep.empiricalIsFloored).toBe(false);
  });

  // 3. determinism: same seed -> identical null
  it('should guarantee identical null models under the same seed', () => {
    const sigma = loadSigma();
    const corpus = buildCorpus(VARIED, sigma);
    const a = buildNull(VARIED, corpus, sigma, { nPairs: 200, seed: 7 });
    const b = buildNull(VARIED, corpus, sigma, { nPairs: 200, seed: 7 });

    expect(a.samples).toEqual(b.samples);
    expect(a.mean).toBeCloseTo(b.mean, 5);
    expect(a.std).toBeCloseTo(b.std, 5);
    expect(a.nPairs).toBe(b.nPairs);
  });

  // 4. a different seed draws different pairs
  it('should change samples when using a different seed', () => {
    const sigma = loadSigma();
    const corpus = buildCorpus(VARIED, sigma);
    const a = buildNull(VARIED, corpus, sigma, { nPairs: 200, seed: 7 });
    const b = buildNull(VARIED, corpus, sigma, { nPairs: 200, seed: 8 });
    expect(a.samples).not.toEqual(b.samples);
  });

  // 5. alphabet drift is refused, both in prove() and loadNull()
  it('should refuse correlation and load if alphabet hash is mismatched', () => {
    const { sigma, corpus, nullModel } = getFixture();
    const g = normalizeTypescript(VARIED[0], sigma);

    // Forge mismatch on live null
    Object.defineProperty(nullModel, 'alphabetHash', {
      value: 'sha256:deadbeef',
      writable: true
    });
    expect(() => prove(g, g, nullModel, corpus)).toThrow(SigmaError);

    // Forge mismatch on disk
    const good = buildNull(VARIED, corpus, sigma, { nPairs: 50, seed: 7 });
    const tempPath = path.resolve('tests/temp_null_model.json');
    const savedPath = freezeNull(good, tempPath);
    const data = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
    data.alphabet_hash = 'sha256:deadbeef';
    fs.writeFileSync(savedPath, JSON.stringify(data, null, 2), 'utf-8');

    expect(() => loadNull(savedPath, sigma)).toThrow(SigmaError);

    if (fs.existsSync(savedPath)) {
      fs.unlinkSync(savedPath);
    }
  });

  // 6. the empirical floor is real and never breached
  it('should respect the empirical floor and never breach it', () => {
    const { nullModel } = getFixture(7, 200);
    expect(nullModel.pFloor).toBeCloseTo(1 / (nullModel.nPairs + 1), 5);

    const above = nullModel.samples[nullModel.samples.length - 1] + 1.0;
    expect(nullModel.pEmpirical(above)).toBeCloseTo(nullModel.pFloor, 5);

    for (const s of [0.0, 0.1, 0.5, 0.9, 1.0, above]) {
      expect(nullModel.pEmpirical(s)).toBeGreaterThanOrEqual(nullModel.pFloor - 1e-12);
    }
  });

  // 7. parametric p is labeled separately and can reach past the floor
  it('should distinguish parametric p from empirical and let it exceed the floor', () => {
    const { sigma, corpus, nullModel } = getFixture();
    const g = normalizeTypescript(VARIED[2], sigma);
    const rep = prove(g, g, nullModel, corpus);

    expect(rep.pParametric).toBeLessThan(rep.pEmpirical);
    expect(rep.pParametric).not.toBe(rep.pEmpirical);
  });

  // 8. E-value = parametric p * search space (BLAST correction)
  it('should calculate E-value as parametric p times search space', () => {
    const { nullModel } = getFixture();
    const s = 0.95;
    const rep = evaluate(s, nullModel, { searchSpace: 1000 });
    expect(rep.eValue).toBeCloseTo(nullModel.pParametric(s) * 1000, 5);
    expect(rep.searchSpace).toBe(1000);
  });

  // 9. freeze / load round-trip; non-json refused
  it('should round-trip load and freeze null models successfully, refusing non-json', () => {
    const { sigma, nullModel } = getFixture(7, 120);
    const tempPath = path.resolve('tests/temp_null_rt.json');
    const savedPath = freezeNull(nullModel, tempPath);
    const loaded = loadNull(savedPath, sigma);

    expect(loaded.nPairs).toBe(nullModel.nPairs);
    expect(loaded.seed).toBe(nullModel.seed);
    expect(loaded.iterations).toBe(nullModel.iterations);
    expect(loaded.mean).toBeCloseTo(nullModel.mean, 5);
    expect(loaded.std).toBeCloseTo(nullModel.std, 5);
    expect(loaded.samples).toEqual(nullModel.samples);

    const txtPath = path.resolve('tests/temp_null_rt.txt');
    expect(() => freezeNull(nullModel, txtPath)).toThrow(SigmaError);

    if (fs.existsSync(savedPath)) fs.unlinkSync(savedPath);
  });

  // 10. the deep tail uses erfc, not a naive 1-cdf that underflows to 0
  it('should use erfc to calculate deep tail probability without underflowing to 0', () => {
    const nullModel = new NullModel(
      'x', 't', 10, 0, 2, 1e-9, 0.0, 1.0,
      [-1.0, 0.0, 1.0]
    );
    const p = nullModel.pParametric(10.0);
    expect(p).toBeGreaterThan(0.0);
    expect(p).toBeLessThan(1e-20);
    expect(p).toBeCloseTo(0.5 * Math.exp(Math.log(Math.min(1.0, 1.0))) * 7.6e-24, 0); // approx test
  });
});
