// NOTICE: This file is protected under RCF-PL
export { MarkerParser } from './core/MarkerParser.js';
export { Scanner } from './core/Scanner.js';
export { ComplianceValidator } from './core/ComplianceValidator.js';
export { RCF_MARKERS, MARKER_REGEX } from './core/constants.js';
export * from './core/types.js';
export type { LogicType, UnprotectedBlock, ScannerResult } from './core/Scanner.js';

export const VERSION = '2.1.1';