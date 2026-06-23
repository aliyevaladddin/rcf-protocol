import { describe, expect, it } from '@jest/globals';
import { loadSigma, SigmaError } from '../src/core/sigma.js';
import { normalizeTypescript } from '../src/core/normalize_typescript.js';
import {
  Corpus,
  buildCorpus,
  freezeCorpus,
  loadCorpus,
  iterFunctionUnits
} from '../src/core/corpus.js';
import { measureUnit, measureSource } from '../src/core/measure.js';
import fs from 'fs';
import path from 'path';

describe('Surprisal corpus and the measure mirror (rcf_core.measure)', () => {
  // 1. unit splitting
  it('should split nested and multiple function units correctly', () => {
    const src = `
function outer(x) {
    function inner(y) {
        return y * 2;
    }
    return inner(x);
}

function other(a, b) {
    return a + b;
}
`;
    const units = iterFunctionUnits(src);
    expect(units.length).toBe(3); // outer, inner, other

    // non-parsing yields nothing
    expect(iterFunctionUnits('function broken(').length).toBe(0);
  });

  // 2. document-frequency corpus
  it('should assign less weight to banal features than rare ones', () => {
    const sigma = loadSigma();
    const corpus = buildCorpus([
      'function f1(a, b) { return a + b; }',
      'function f2(c, d) { return c + d; }',
      'function f3(e, g) { return e + g; }',
      'function rare(x) {\n    return (x << 3) ^ (x >> 5);\n}'
    ], sigma);

    expect(corpus.totalUnits).toBe(4);
    const pNat = corpus.pNat();
    const w = corpus.weightFn();

    const add = Object.keys(pNat).find(f => f.includes('ARITH.ADD'))!;
    const xor = Object.keys(pNat).find(f => f.includes('BIT.XOR'))!;

    expect(pNat[add]).toBeCloseTo(0.75, 5);
    expect(pNat[xor]).toBeCloseTo(0.25, 5);
    expect(w(add)).toBeLessThan(w(xor));
    expect(w(add)).toBeCloseTo(-Math.log(0.75), 5);
  });

  // 3. alphabet binding (drift tripwire)
  it('should refuse loading a corpus with mismatched alphabet', () => {
    const sigma = loadSigma();
    const corpus = buildCorpus(['function f(a, b) { return a + b; }'], sigma);
    const tempPath = path.resolve('tests/temp_corpus.json');
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    const savedPath = freezeCorpus(corpus, tempPath);
    const loaded = loadCorpus(savedPath, sigma);
    expect(loaded.totalUnits).toBe(corpus.totalUnits);

    // Forge mismatch
    const data = JSON.parse(fs.readFileSync(savedPath, 'utf-8'));
    data.alphabet_hash = 'sha256:deadbeef';
    fs.writeFileSync(savedPath, JSON.stringify(data, null, 2), 'utf-8');

    expect(() => loadCorpus(savedPath, sigma)).toThrow(SigmaError);

    if (fs.existsSync(savedPath)) {
      fs.unlinkSync(savedPath);
    }
  });

  // 4. protected feature unseen in background is maximally surprising
  it('should make unseen features maximally surprising', () => {
    const sigma = loadSigma();
    const background = buildCorpus(
      Array.from({ length: 10 }, (_, i) => `function f${i}(a, b) { return a + b; }`),
      sigma
    );
    const pNat = background.pNat();

    expect(Object.keys(pNat).some(f => f.includes('BIT.XOR'))).toBe(false);
    const w = background.weightFn(1e-9);

    const unseen = w('L0:BIT.XOR');
    const seen = w(Object.keys(pNat).find(f => f.includes('ARITH.ADD'))!);
    expect(unseen).toBeGreaterThan(seen);
  });

  // 5. the mirror: banal vs unique
  it('should separate banal and unique code by surprisal mass', () => {
    const sigma = loadSigma();
    const background = buildCorpus([
      ...Array.from({ length: 20 }, (_, i) => `function f${i}(a, b) { return a + b; }`),
      ...Array.from({ length: 20 }, (_, i) => `function g${i}(x) {\n    let s = 0;\n    for (let i of x) {\n        s = s + i;\n    }\n    return s;\n}`)
    ], sigma);

    const banal = measureSource('function add(a, b) {\n    return a + b;\n}', background, sigma)[0];
    const unique = measureSource('function weird(x) {\n    let y = (x << 3) ^ (x >> 5);\n    return y & 0xAB;\n}', background, sigma)[0];

    expect(unique.totalMass).toBeGreaterThan(banal.totalMass);
    expect(unique.totalMass).toBeGreaterThan(5 * banal.totalMass);
  });

  // 6. weight threshold is corpus relative
  it('should derive weight threshold relative to the corpus', () => {
    const sigma = loadSigma();
    const corpus = new Corpus(
      sigma.alphabetHash,
      sigma.version,
      100,
      { common: 90, mid: 50, rare: 2 }
    );
    const w = corpus.weightFn();
    const cut = corpus.weightThreshold(0.5);

    expect(w('common')).toBeLessThan(w('mid'));
    expect(w('mid')).toBeLessThan(w('rare'));
    expect(w('common')).toBeLessThanOrEqual(cut);
    expect(cut).toBeLessThanOrEqual(w('rare'));
    expect(cut).toBeGreaterThan(0.0);
  });

  // 7. measure refuses alphabet mismatch
  it('should refuse measurement on alphabet mismatch', () => {
    const sigma = loadSigma();
    const corpus = buildCorpus(['function f(a, b) { return a + b; }'], sigma);
    const pdg = normalizeTypescript('function g(a, b) { return a + b; }', sigma);

    // Forge mismatch
    Object.defineProperty(corpus, 'alphabetHash', {
      value: 'sha256:deadbeef',
      writable: true
    });

    expect(() => measureUnit(pdg, corpus)).toThrow(SigmaError);
  });
});
