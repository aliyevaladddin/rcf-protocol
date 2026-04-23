// NOTICE: This file is protected under RCF-PL v2.0
// [RCF:PROTECTED]

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, join } from 'path';
import { createHash, createHmac } from 'crypto';
import { FileScanResult, ValidationError, AuditAsset, AuditReport, DiffResult, DiffViolation, VerifyFileResult } from './types.js';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

// [RCF:PROTECTED]
export class ComplianceValidator {
  private strict: boolean;
  private secretKey: string | null;

  constructor(options: { strict?: boolean; secretKey?: string } = {}) {
    this.strict = options.strict ?? false;
    this.secretKey = options.secretKey ?? null;
  }

  // ─── Validate (basic compliance check) ───────────────────────────────────

  async validate(results: FileScanResult[]): Promise<ValidationResult> {
    const errors: ValidationError[] = [];

    for (const result of results) {
      if (result.error) {
        errors.push({ file: result.file, message: `Read error: ${result.error}` });
        continue;
      }

      if (this.strict && !result.hasHeader) {
        errors.push({
          file: result.file,
          message: 'Missing RCF file header (strict mode)',
        });
      }

      if (this.strict && result.markers.length === 0) {
        errors.push({
          file: result.file,
          message: 'No RCF markers found (strict mode)',
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ─── Generate Audit Report ────────────────────────────────────────────────

  generateReport(results: FileScanResult[], root: string): AuditReport {
    const protected_assets: AuditAsset[] = [];

    for (const result of results) {
      if (!result.isProtected || result.error) continue;

      try {
        const content = readFileSync(result.file);
        const sha256 = createHash('sha256').update(content).digest('hex');
        const relPath = relative(resolve(root), resolve(result.file));

        protected_assets.push({
          file: relPath,
          markers: result.markers.map(m => m.type),
          sha256,
        });
      } catch {
        // skip unreadable files
      }
    }

    return {
      timestamp: new Date().toISOString(),
      audit_type: 'RCF-Audit v2.0',
      protected_assets,
    };
  }

  // ─── Diff: compare current state against audit report ─────────────────────

  diff(
    currentResults: FileScanResult[],
    report: AuditReport,
    root: string
  ): DiffResult {
    const violations: DiffViolation[] = [];
    const newUnprotectedFiles: string[] = [];

    // Index current results by relative path
    const currentByPath = new Map<string, FileScanResult>();
    for (const r of currentResults) {
      const rel = relative(resolve(root), resolve(r.file));
      currentByPath.set(rel, r);
    }

    const auditedPaths = new Set(report.protected_assets.map(a => a.file));

    // Check each recorded asset
    for (const asset of report.protected_assets) {
      const current = currentByPath.get(asset.file);

      if (!current) {
        violations.push({
          type: 'file_missing',
          file: asset.file,
          detail: 'Previously protected file is missing or was deleted',
        });
        continue;
      }

      const storedMarkers = new Set(asset.markers);
      const currentMarkers = new Set(current.markers.map(m => m.type));
      const removed = [...storedMarkers].filter(m => !currentMarkers.has(m as any));

      if (removed.length > 0) {
        violations.push({
          type: 'markers_removed',
          file: asset.file,
          detail: `Markers removed: ${removed.join(', ')}`,
          removed: removed as string[],
        });
      }
    }

    // Detect new files with unprotected logic (not in audit)
    for (const [relPath, result] of currentByPath) {
      if (!auditedPaths.has(relPath) && !result.isProtected) {
        newUnprotectedFiles.push(relPath);
      }
    }

    return {
      violations,
      newUnprotectedFiles,
      passed: violations.length === 0,
    };
  }

  // ─── Verify single file against audit report ──────────────────────────────

  verifyFile(filePath: string, reportPath: string): VerifyFileResult {
    if (!existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    if (!existsSync(reportPath)) {
      throw new Error(`Audit report not found: ${reportPath}`);
    }

    const report: AuditReport = JSON.parse(
      readFileSync(reportPath, 'utf-8')
    );

    const reportRoot = resolve(reportPath, '..');
    let relPath: string;
    try {
      relPath = relative(resolve(reportRoot), resolve(filePath));
    } catch {
      relPath = filePath;
    }

    // Match by relative path, normalized path, or filename
    const asset = report.protected_assets.find(
      a =>
        a.file === relPath ||
        a.file.replace(/\\/g, '/') === relPath.replace(/\\/g, '/') ||
        a.file.split('/').pop() === relPath.split('/').pop()
    );

    if (!asset) {
      throw new Error(
        `File '${relPath}' not found in audit report.\n` +
        `Available: ${report.protected_assets.map(a => a.file).join(', ')}`
      );
    }

    const content = readFileSync(filePath);
    const currentHash = createHash('sha256').update(content).digest('hex');

    return {
      file: filePath,
      reportPath,
      storedHash: asset.sha256,
      currentHash,
      verified: currentHash === asset.sha256,
      recordedAt: report.timestamp,
    };
  }

  // ─── Verify all files in directory ────────────────────────────────────────

  verifyAll(
    root: string,
    report: AuditReport
  ): { verified: number; missing: string[]; tampered: string[] } {
    const missing: string[] = [];
    const tampered: string[] = [];
    let verified = 0;

    for (const asset of report.protected_assets) {
      const fullPath = join(root, asset.file);

      if (!existsSync(fullPath)) {
        missing.push(asset.file);
        continue;
      }

      const content = readFileSync(fullPath);
      const hash = createHash('sha256').update(content).digest('hex');

      if (hash === asset.sha256) {
        verified++;
      } else {
        tampered.push(asset.file);
      }
    }

    return { verified, missing, tampered };
  }

  // ─── Load report from disk ────────────────────────────────────────────────

  static loadReport(reportPath: string): AuditReport {
    if (!existsSync(reportPath)) {
      throw new Error(`RCF-AUDIT-REPORT.json not found at: ${reportPath}`);
    }
    return JSON.parse(readFileSync(reportPath, 'utf-8'));
  }

  /**
   * Verifies the integrity chain of a file by validating all dynamic markers
   * against the secret key.
   */
  verifyIntegrityChain(filePath: string, secretKey: string): { valid: boolean; violations: number } {
    if (!existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    let violations = 0;

    const GHOST_REGEX = /\[RCF:GHOST:([a-f0-9]+)\]/;

    for (let i = 0; i < lines.length; i++) {
      const match = GHOST_REGEX.exec(lines[i]);
      if (match) {
        const providedHmac = match[1];
        // The block is assumed to be below the marker. In v2.0 we check the next 10 lines
        // or until the next marker.
        const blockContent = lines.slice(i + 1, i + 11).join('\n');
        const expectedHmac = createHmac('sha256', secretKey)
          .update(blockContent.trim())
          .digest('hex')
          .slice(0, 16);

        if (providedHmac !== expectedHmac) {
          violations++;
        }
      }
    }

    return { valid: violations === 0, violations };
  }

  /**
   * Injects active integrity checks into a code block.
   * This is part of the Ghost Protocol v2.0 self-enforcement mechanism.
   */
  injectIntegrityCheck(code: string, secretKey: string): string {
    const lines = code.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      result.push(lines[i]);
      // If we find a PROTECTED marker, we inject a GHOST marker after it
      if (lines[i].includes('[RCF:PROTECTED]')) {
        // Collect next 10 lines for the block signature
        const block = lines.slice(i + 1, i + 11).join('\n');
        const hmac = createHmac('sha256', secretKey)
          .update(block.trim())
          .digest('hex')
          .slice(0, 16);
        
        result.push(`// [RCF:GHOST:${hmac}]`);
      }
    }

    return result.join('\n');
  }
}
