import { describe, expect, it } from '@jest/globals';
import { loadSigma, SigmaError } from '../src/core/sigma.js';
import { normalizeTypescript } from '../src/core/normalize_typescript.js';
import { wlFeatures } from '../src/core/wl.js';
import { correlate, surprisalWeightFromCorpus } from '../src/core/correlate.js';

describe('WL-kernel and surprisal-weighted correlation (rcf_core.correlate)', () => {
  // 1. wl includes all levels
  it('should include all levels in WL features', () => {
    const g = normalizeTypescript('function f(x) {\n    return x * 2;\n}');
    const f0 = wlFeatures(g, 0);
    const f2 = wlFeatures(g, 2);

    expect(Object.keys(f0).every(k => k.startsWith('L0:'))).toBe(true);

    const levels = new Set(Object.keys(f2).map(k => k.split(':', 1)[0]));
    expect(levels).toEqual(new Set(['L0', 'L1', 'L2']));
  });

  // 2. wl rejects negative iterations
  it('should reject negative iterations', () => {
    const g = normalizeTypescript('function f() {\n    return 1;\n}');
    expect(() => wlFeatures(g, -1)).toThrow(Error);
  });

  // 3. corr self is one
  it('should return 1.0 for self correlation', () => {
    const g = normalizeTypescript('function f(x) {\n    const y = x * 2;\n    return y;\n}');
    expect(correlate(g, g)).toBeCloseTo(1.0, 5);
  });

  // 4. corr renamed identical is one
  it('should return 1.0 for renamed identical functions', () => {
    const a = normalizeTypescript('function f(x) {\n    const y = x * 2;\n    return y;\n}');
    const b = normalizeTypescript('function g(input) {\n    const out = input * 2;\n    return out;\n}');
    expect(correlate(a, b)).toBeCloseTo(1.0, 5);
  });

  // 5. corr different method is less than one
  it('should return less than 1.0 for different methods', () => {
    const a = normalizeTypescript('function f(x) {\n    return x * 2;\n}');
    const b = normalizeTypescript('function f(x) {\n    return x + 99;\n}');
    const c = correlate(a, b);
    expect(c).toBeGreaterThan(0.0);
    expect(c).toBeLessThan(1.0);
  });

  // 6. corr is symmetric
  it('should be symmetric', () => {
    const a = normalizeTypescript('function f(x) {\n    const y = x * 2;\n    return y;\n}');
    const b = normalizeTypescript('function k(a, b) {\n    for (let i of a) {\n        return i;\n    }\n    return 0;\n}');
    expect(correlate(a, b)).toBeCloseTo(correlate(b, a), 5);
  });

  // 7. corr in unit interval
  it('should lie within the unit interval [0, 1]', () => {
    const a = normalizeTypescript('function f(x) {\n    return x * 2 + 1;\n}');
    const b = normalizeTypescript('function g(y) {\n    for (let z of y) {\n        if (z > 0) {\n            return z;\n        }\n    }\n}');
    const c = correlate(a, b);
    expect(c).toBeGreaterThanOrEqual(0.0);
    expect(c).toBeLessThanOrEqual(1.0);
  });

  // 8. corr refuses mismatched alphabet
  it('should refuse correlation of mismatched alphabets', () => {
    const a = normalizeTypescript('function f(x) {\n    return x;\n}');
    const b = normalizeTypescript('function g(y) {\n    return y;\n}');
    
    // Forge a different alphabetHash on b's sigma view
    Object.defineProperty(b.sigma, 'alphabetHash', {
      value: 'sha256:deadbeef',
      writable: true
    });

    expect(() => correlate(a, b)).toThrow(SigmaError);
  });

  // 9. surprisal weight downweights common features
  it('should downweight common features under surprisal weight', () => {
    const w = surprisalWeightFromCorpus({ 'L0:ARITH.MUL': 0.9, 'L0:CONST.NUM': 0.5 });
    const common = w('L0:ARITH.MUL');
    const rare = w('L0:REF.GLOBAL');
    
    expect(rare).toBeGreaterThan(common);
    expect(common).toBeCloseTo(-Math.log(0.9), 5);
  });

  // 10. surprisal weighted corr still unit on self
  it('should remain 1.0 on self correlation under custom weights', () => {
    const g = normalizeTypescript('function f(x) {\n    const y = x * 2;\n    return y;\n}');
    const w = surprisalWeightFromCorpus({ 'L0:ARITH.MUL': 0.01 });
    expect(correlate(g, g, { weight: w })).toBeCloseTo(1.0, 5);
  });
});
