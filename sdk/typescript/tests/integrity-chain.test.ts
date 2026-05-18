import { describe, expect, it } from '@jest/globals';
import { ComplianceValidator } from '../src/core/ComplianceValidator.js';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

describe('RCF Integrity Verification (SHA-256)', () => {
  const testDir = join(tmpdir(), 'rcf-verify-test');

  it('should successfully verify file against a valid audit report', () => {
    const validator = new ComplianceValidator();
    const mockReport = {

      timestamp: new Date().toISOString(),
      audit_type: 'RCF-Audit',
      root: testDir,
      protected_assets: [
        {
          file: 'protected.ts',
          markers: ['PROTECTED'],
          sha256: createHash('sha256').update('// [RCF:PROTECTED]\nexport const val = 42;\n').digest('hex')
        }
      ]
    };

    const reportPath = join(tmpdir(), 'rcf-temp-report.json');
    writeFileSync(reportPath, JSON.stringify(mockReport, null, 2));

    const filePath = join(tmpdir(), 'protected.ts');
    writeFileSync(filePath, '// [RCF:PROTECTED]\nexport const val = 42;\n');

    const result = validator.verifyFile(filePath, reportPath);
    expect(result.verified).toBe(true);
    expect(result.currentHash).toBe(mockReport.protected_assets[0].sha256);

    if (existsSync(reportPath)) unlinkSync(reportPath);
    if (existsSync(filePath)) unlinkSync(filePath);
  });

  it('should fail verification when file content is modified', () => {
    const validator = new ComplianceValidator();
    const mockReport = {

      timestamp: new Date().toISOString(),
      audit_type: 'RCF-Audit',
      root: testDir,
      protected_assets: [
        {
          file: 'protected.ts',
          markers: ['PROTECTED'],
          sha256: createHash('sha256').update('// [RCF:PROTECTED]\nexport const val = 42;\n').digest('hex')
        }
      ]
    };

    const reportPath = join(tmpdir(), 'rcf-temp-report-fail.json');
    writeFileSync(reportPath, JSON.stringify(mockReport, null, 2));

    const filePath = join(tmpdir(), 'protected.ts');
    writeFileSync(filePath, '// [RCF:PROTECTED]\nexport const val = 99;\n'); // Modified!

    const result = validator.verifyFile(filePath, reportPath);
    expect(result.verified).toBe(false);
    expect(result.currentHash).not.toBe(mockReport.protected_assets[0].sha256);

    if (existsSync(reportPath)) unlinkSync(reportPath);
    if (existsSync(filePath)) unlinkSync(filePath);
  });
});
