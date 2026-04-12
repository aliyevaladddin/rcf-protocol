// NOTICE: This file is protected under RCF-PL v1.3

export type MarkerType = 'PUBLIC' | 'PROTECTED' | 'RESTRICTED' | 'NOTICE';

export interface RCFMarker {
  type: MarkerType;
  line: number;
  column: number;
  context: string;
  raw: string;
}

export interface MarkerDefinition {
  name: string;
  level: number | 'meta';
  description: string;
  permissions?: string[];
  restrictions?: string[];
  action?: string;
}

export interface FileScanResult {
  file: string;
  markers: RCFMarker[];
  hasHeader: boolean;
  isProtected: boolean;
  error?: string;
}

export interface ValidationError {
  file: string;
  line?: number;
  message: string;
  severity?: 'error' | 'warning'; // added as optional for backward/internal compatibility
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export interface AuditAsset {
  file: string;
  markers: string[];
  sha256: string;
}

export interface AuditReport {
  timestamp: string;
  audit_type: string;
  protected_assets: AuditAsset[];
}

export interface DiffViolation {
  type: 'markers_removed' | 'file_missing' | 'hash_mismatch';
  file: string;
  detail: string;
  removed?: string[];
}

export interface DiffResult {
  violations: DiffViolation[];
  newUnprotectedFiles: string[];
  passed: boolean;
}

export interface VerifyFileResult {
  file: string;
  reportPath: string;
  storedHash: string;
  currentHash: string;
  verified: boolean;
  recordedAt: string;
}