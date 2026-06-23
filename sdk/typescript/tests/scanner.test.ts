import { describe, expect, it } from '@jest/globals';
import { Scanner, ScannerResult } from '../src/core/Scanner.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

function setupTempWorkspace(): string {
  const tmpDir = path.resolve('tests/temp_scanner_workspace');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  // Create a temporary file with RCF markers
  fs.writeFileSync(
    path.join(tmpDir, 'protected_code.py'),
    '# NOTICE: This file is protected under RCF-PL\n# [RCF:RESTRICTED]\ndef secret(): pass'
  );

  // Create a public file
  fs.writeFileSync(
    path.join(tmpDir, 'public_code.py'),
    '# [RCF:PUBLIC]\ndef architecture(): pass'
  );

  // Create an unmarked file
  fs.writeFileSync(
    path.join(tmpDir, 'normal_code.py'),
    'def normal(): pass'
  );

  return tmpDir;
}

function teardownTempWorkspace(tmpDir: string) {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('RCF Scanner (rcf_cli.scanner)', () => {
  // 1. test_scanner_detects_markers
  it('should detect RCF markers and headers correctly', () => {
    const tmpDir = setupTempWorkspace();
    const scanner = new Scanner();
    const results = scanner.scanDirectory(tmpDir);

    expect(results.length).toBe(3);

    const restrictedMatch = results.find(r => r.path.includes('protected_code.py'))!;
    expect(restrictedMatch).toBeDefined();
    expect(restrictedMatch.markers).toContain('RESTRICTED');
    expect(restrictedMatch.hasHeader).toBe(true);

    const publicMatch = results.find(r => r.path.includes('public_code.py'))!;
    expect(publicMatch).toBeDefined();
    expect(publicMatch.markers).toContain('PUBLIC');
    expect(publicMatch.hasHeader).toBe(false);

    teardownTempWorkspace(tmpDir);
  });

  // 2. test_scanner_ignores_files
  it('should ignore scannable files inside ignored directories like node_modules', () => {
    const tmpDir = setupTempWorkspace();
    const nodeModules = path.join(tmpDir, 'node_modules');
    fs.mkdirSync(nodeModules);
    fs.writeFileSync(
      path.join(nodeModules, 'ignored.py'),
      '# [RCF:RESTRICTED]'
    );

    const scanner = new Scanner();
    const results = scanner.scanDirectory(tmpDir);

    // Should still be 3 because node_modules is ignored
    expect(results.length).toBe(3);

    teardownTempWorkspace(tmpDir);
  });

  // 3. test_audit_excludes_unprotected_files
  it('should exclude unprotected files from the ownership/audit asset list', () => {
    const tmpDir = setupTempWorkspace();
    const scanner = new Scanner();
    const results = scanner.scanDirectory(tmpDir);

    const assets: any[] = [];
    for (const res of results) {
      if (!res.isProtected) continue;
      const content = fs.readFileSync(res.path);
      const digest = crypto.createHash('sha256').update(content).digest('hex');
      assets.push({
        file: path.basename(res.path),
        markers: res.markers,
        sha256: digest
      });
    }

    const recorded = new Set(assets.map(a => a.file));
    expect(recorded.has('normal_code.py')).toBe(false);
    expect(recorded).toEqual(new Set(['protected_code.py', 'public_code.py']));

    teardownTempWorkspace(tmpDir);
  });
});
