// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

/**
 * Language-aware normalization router.
 *
 * Detects the source language from a file extension and dispatches to the
 * appropriate tree-sitter normalizer.  All normalizers share the same Sigma
 * IR alphabet so the resulting PDG is directly comparable regardless of the
 * source language.
 *
 * Supported extensions:
 *   .go           → normalizeGo      (tree-sitter-go)
 *   .rs           → normalizeRust    (tree-sitter-rust)
 *   .ts .tsx .js  → normalizeTypescript (tree-sitter-typescript)
 *   .jsx (default)→ normalizeTypescript
 */

import { PDG } from './pdg.js';
import { Sigma } from './sigma.js';
import { normalizeTypescript } from './normalize_typescript.js';
import { normalizeGo } from './normalize_go.js';
import { normalizeRust } from './normalize_rust.js';

export type SupportedLanguage = 'typescript' | 'go' | 'rust';

const EXT_MAP: Record<string, SupportedLanguage> = {
  '.ts':  'typescript',
  '.tsx': 'typescript',
  '.js':  'typescript',
  '.jsx': 'typescript',
  '.mjs': 'typescript',
  '.cjs': 'typescript',
  '.go':  'go',
  '.rs':  'rust',
};

/**
 * Resolve a SupportedLanguage from a file path or bare extension string.
 * Returns `'typescript'` as the safe default for unknown extensions.
 */
export function languageFromExtension(filePathOrExt: string): SupportedLanguage {
  // Handle both ".go" and "path/to/file.go"
  const lower = filePathOrExt.toLowerCase();
  const ext = lower.includes('.') ? '.' + lower.split('.').pop()! : lower;
  return EXT_MAP[ext] ?? 'typescript';
}

/**
 * Normalize `source` code to a PDG using the normalizer that corresponds to
 * the given file extension.
 *
 * @param source       - Raw source code string.
 * @param filePathOrExt - File path (e.g. `"cmd/main.go"`) or bare extension
 *                        (e.g. `".go"`).  Used only for language detection.
 * @param sigma        - Optional pre-loaded Sigma alphabet.  If omitted, the
 *                       default sigma.json is loaded automatically.
 */
export function normalizeByExtension(
  source: string,
  filePathOrExt: string,
  sigma?: Sigma,
): PDG {
  const lang = languageFromExtension(filePathOrExt);
  switch (lang) {
    case 'go':
      return normalizeGo(source, sigma);
    case 'rust':
      return normalizeRust(source, sigma);
    case 'typescript':
    default:
      return normalizeTypescript(source, sigma);
  }
}
