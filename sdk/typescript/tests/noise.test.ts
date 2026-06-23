import { describe, expect, it } from '@jest/globals';
import { injectAdversarialNoiseTypescript } from '../src/core/noise.js';

describe('Adversarial AST Noise Injection', () => {
  it('should inject noise into a protected TypeScript function', () => {
    const source = `// [RCF:PROTECTED]
function processData(x: number): number {
  return x + 1;
}
`;
    const result = injectAdversarialNoiseTypescript(source);
    expect(result).toContain('_rcf_');
    expect(result).toContain('function processData');
    expect(result).toContain('return x + 1;');

    // Test idempotency
    const result2 = injectAdversarialNoiseTypescript(result);
    expect(result2).toBe(result);
  });
});
