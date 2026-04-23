import { describe, expect, it } from '@jest/globals';
import { Scanner } from '../src/core/Scanner.js';
import { ComplianceValidator } from '../src/core/ComplianceValidator.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RCF v2.0 Ghost Protocol', () => {
  const secretKey = 'aladdin-secret-key-2026';
  const testFile = join(tmpdir(), 'rcf-ghost-test.ts');

  it('should generate a valid Ghost Marker for a code block', () => {
    const code = 'export function secretLogic() { return 42; }';
    const marker = Scanner.generateGhostMarker(code, secretKey);
    expect(marker).toContain('RCF:GHOST:');
    expect(marker.length).toBe(10 + 16); // RCF:GHOST: + 16 hex chars
  });

  it('should verify a file with valid integrity chain', () => {
    const code = [
      '// [RCF:PROTECTED]',
      'export function myLogic() {',
      '  console.log("Protected");',
      '}',
    ].join('\n');

    const validator = new ComplianceValidator();
    const ghostedCode = validator.injectIntegrityCheck(code, secretKey);
    
    expect(ghostedCode).toContain('[RCF:GHOST:');
    
    writeFileSync(testFile, ghostedCode);
    
    const result = validator.verifyIntegrityChain(testFile, secretKey);
    expect(result.valid).toBe(true);
    expect(result.violations).toBe(0);
    
    if (existsSync(testFile)) unlinkSync(testFile);
  });

  it('should detect tampering in the integrity chain', () => {
    const code = [
      '// [RCF:PROTECTED]',
      'export function myLogic() {',
      '  console.log("Protected");',
      '}',
    ].join('\n');

    const validator = new ComplianceValidator();
    const ghostedCode = validator.injectIntegrityCheck(code, secretKey);
    
    // Tamper with the code
    const tamperedCode = ghostedCode.replace('Protected', 'Hacked');
    
    writeFileSync(testFile, tamperedCode);
    
    const result = validator.verifyIntegrityChain(testFile, secretKey);
    expect(result.valid).toBe(false);
    expect(result.violations).toBe(1);
    
    if (existsSync(testFile)) unlinkSync(testFile);
  });
});
