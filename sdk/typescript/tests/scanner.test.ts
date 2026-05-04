// NOTICE: This file is protected under RCF-PL v2.0.4
import { describe, expect, it } from '@jest/globals';
import { ComplianceValidator } from '../src/core/ComplianceValidator.js';
import { Scanner } from '../src/core/Scanner.js';
import type { FileScanResult } from '../src/core/types.js';

// ─── ComplianceValidator ──────────────────────────────────────────────────────

describe('ComplianceValidator', () => {
  it('strict mode — missing header triggers error', async () => {
    const validator = new ComplianceValidator({ strict: true });

    const mockResults: FileScanResult[] = [
      {
        file: 'src/protected.ts',
        markers: [{ type: 'PROTECTED', line: 2, column: 0, context: '', raw: '[RCF:PROTECTED]' }],
        hasHeader: false,
        isProtected: true,
      },
    ];

    const result = await validator.validate(mockResults);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(1);
    expect(result.errors[0].file).toBe('src/protected.ts');
  });

  it('strict mode — header present, passes validation', async () => {
    const validator = new ComplianceValidator({ strict: true });

    const mockResults: FileScanResult[] = [
      {
        file: 'src/public.ts',
        markers: [{ type: 'PUBLIC', line: 2, column: 0, context: '', raw: '[RCF:PUBLIC]' }],
        hasHeader: true,
        isProtected: true,
      },
    ];

    const result = await validator.validate(mockResults);
    expect(result.valid).toBe(true);
    expect(result.errors.length).toBe(0);
  });

  it('non-strict mode — missing header does not trigger error', async () => {
    const validator = new ComplianceValidator({ strict: false });

    const mockResults: FileScanResult[] = [
      {
        file: 'src/algo.ts',
        markers: [{ type: 'PROTECTED', line: 5, column: 0, context: '', raw: '[RCF:PROTECTED]' }],
        hasHeader: false,
        isProtected: true,
      },
    ];

    const result = await validator.validate(mockResults);
    expect(result.valid).toBe(true);
  });

  it('diff — detects removed markers', () => {
    const validator = new ComplianceValidator();

    const currentResults: FileScanResult[] = [
      {
        file: '/root/src/algo.ts',
        markers: [],           // PROTECTED was removed
        hasHeader: true,
        isProtected: true,
      },
    ];

    const report = {
      rcf_version: '2.0.3',
      timestamp: new Date().toISOString(),
      audit_type: 'RCF-Audit v2.0.4',
      root: '/root',
      protected_assets: [
        { file: 'src/algo.ts', markers: ['PROTECTED'], sha256: 'abc123' },
      ],
    };

    const diff = validator.diff(currentResults, report, '/root');
    expect(diff.passed).toBe(false);
    expect(diff.violations.length).toBe(1);
    expect(diff.violations[0].type).toBe('markers_removed');
    expect(diff.violations[0].removed).toContain('PROTECTED');
  });

  it('diff — detects missing file', () => {
    const validator = new ComplianceValidator();

    const report = {
      rcf_version: '2.0.3',
      timestamp: new Date().toISOString(),
      audit_type: 'RCF-Audit v2.0.4',
      root: '/root',
      protected_assets: [
        { file: 'src/deleted.ts', markers: ['PROTECTED'], sha256: 'abc123' },
      ],
    };

    const diff = validator.diff([], report, '/root');
    expect(diff.passed).toBe(false);
    expect(diff.violations[0].type).toBe('file_missing');
  });

  it('diff — passes when markers are intact', () => {
    const validator = new ComplianceValidator();

    const currentResults: FileScanResult[] = [
      {
        file: '/root/src/algo.ts',
        markers: [{ type: 'PROTECTED', line: 3, column: 0, context: '', raw: '[RCF:PROTECTED]' }],
        hasHeader: true,
        isProtected: true,
      },
    ];

    const report = {
      rcf_version: '2.0.3',
      timestamp: new Date().toISOString(),
      audit_type: 'RCF-Audit v2.0.4',
      root: '/root',
      protected_assets: [
        { file: 'src/algo.ts', markers: ['PROTECTED'], sha256: 'irrelevant' },
      ],
    };

    const diff = validator.diff(currentResults, report, '/root');
    expect(diff.passed).toBe(true);
    expect(diff.violations.length).toBe(0);
  });
});

// ─── Scanner ──────────────────────────────────────────────────────────────────

describe('Scanner', () => {
  describe('commentPrefix()', () => {
    it('returns // for TypeScript', () => {
      expect(Scanner.commentPrefix('test.ts')).toBe('//');
    });
    it('returns // for JavaScript', () => {
      expect(Scanner.commentPrefix('test.js')).toBe('//');
    });
    it('returns // for TSX', () => {
      expect(Scanner.commentPrefix('component.tsx')).toBe('//');
    });
    it('returns # for Python', () => {
      expect(Scanner.commentPrefix('script.py')).toBe('#');
    });
    it('returns # for Ruby', () => {
      expect(Scanner.commentPrefix('app.rb')).toBe('#');
    });
    it('returns <!-- for HTML', () => {
      expect(Scanner.commentPrefix('index.html')).toBe('<!--');
    });
    it('returns /* for CSS', () => {
      expect(Scanner.commentPrefix('styles.css')).toBe('/*');
    });
  });

  describe('makeMarkerLine()', () => {
    it('generates correct TS marker', () => {
      expect(Scanner.makeMarkerLine('test.ts')).toBe('// [RCF:PROTECTED]\n');
    });
    it('generates correct HTML marker', () => {
      expect(Scanner.makeMarkerLine('index.html')).toBe('<!-- [RCF:PROTECTED] -->\n');
    });
    it('generates correct CSS marker', () => {
      expect(Scanner.makeMarkerLine('styles.css')).toBe('/* [RCF:PROTECTED] */\n');
    });
    it('generates correct Python marker', () => {
      expect(Scanner.makeMarkerLine('algo.py')).toBe('# [RCF:PROTECTED]\n');
    });
    it('supports custom marker type', () => {
      expect(Scanner.makeMarkerLine('test.ts', 'RCF:RESTRICTED')).toBe('// [RCF:RESTRICTED]\n');
    });
  });

  describe('headerLine()', () => {
    it('generates correct TS header', () => {
      expect(Scanner.headerLine('test.ts')).toBe(
        '// NOTICE: This file is protected under RCF-PL v2.0.4\n'
      );
    });
    it('generates correct HTML header', () => {
      expect(Scanner.headerLine('index.html')).toBe(
        '<!-- NOTICE: This file is protected under RCF-PL v2.0.4 -->\n'
      );
    });
  });

  describe('scanFile()', () => {
    it('returns empty result for nonexistent file', () => {
      const scanner = new Scanner();
      const result = scanner.scanFile('/nonexistent/path/file.ts');
      expect(result.markers).toEqual([]);
      expect(result.hasHeader).toBe(false);
      expect(result.isProtected).toBe(false);
      expect(result.hasUnprotectedLogic).toBe(false);
    });
  });
});
