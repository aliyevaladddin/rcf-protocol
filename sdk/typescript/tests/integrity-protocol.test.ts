import { describe, expect, it } from '@jest/globals';
import { Scanner } from '../src/core/Scanner.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RCF Heuristic Unprotected Logic Scanner', () => {
  const testFile = join(tmpdir(), 'rcf-unprotected-heuristics.ts');

  it('should detect unprotected class/function declarations using standard heuristics', () => {
    const code = [
      'export class UnprotectedCoreAlgorithm {',
      '  calculate() {',
      '    return "heavy computing";',
      '  }',
      '}',
    ].join('\n');

    writeFileSync(testFile, code);

    const scanner = new Scanner();
    const result = scanner.scanFile(testFile);

    expect(result.isProtected).toBe(false);
    expect(result.hasUnprotectedLogic).toBe(true);
    expect(result.unprotectedLogic.length).toBeGreaterThanOrEqual(1);
    expect(result.unprotectedLogic[0].type).toBe('class');

    if (existsSync(testFile)) unlinkSync(testFile);
  });

  it('should treat code with RCF:PROTECTED marker as compliant', () => {
    const code = [
      '// NOTICE: This file is protected under RCF-PL',
      '// [RCF:PROTECTED]',
      'export class ProtectedCoreAlgorithm {',
      '  calculate() {',
      '    return "heavy computing";',
      '  }',
      '}',
    ].join('\n');

    writeFileSync(testFile, code);

    const scanner = new Scanner();
    const result = scanner.scanFile(testFile);

    expect(result.isProtected).toBe(true);
    expect(result.hasUnprotectedLogic).toBe(false);

    if (existsSync(testFile)) unlinkSync(testFile);
  });
});
