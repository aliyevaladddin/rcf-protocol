// NOTICE: This file is protected under RCF-PL v1.3
// [RCF:PROTECTED]

import { readFileSync } from 'fs';
import { extname, basename } from 'path';

export type LogicType =
  | 'class'
  | 'abstract_class'
  | 'interface'
  | 'type_alias'
  | 'enum'
  | 'function'
  | 'async_function'
  | 'arrow_function'
  | 'decorator'
  | 'crypto_logic'
  | 'python_function'
  | 'python_class'
  | 'logic_block';

export interface UnprotectedBlock {
  line: number;
  type: LogicType;
  snippet: string;
}

export interface ScannerResult {
  path: string;
  hasHeader: boolean;
  isProtected: boolean;
  hasUnprotectedLogic: boolean;
  unprotectedLogic: UnprotectedBlock[];
  markers: string[];
}

// TS/JS heuristic patterns — ordered by specificity
const TS_PATTERNS: Array<{ regex: RegExp; type: LogicType }> = [
  { regex: /^\s*abstract\s+class\s+\w+/,                           type: 'abstract_class' },
  { regex: /^\s*export\s+(default\s+)?class\s+\w+/,               type: 'class' },
  { regex: /^\s*class\s+\w+/,                                      type: 'class' },
  { regex: /^\s*export\s+interface\s+\w+/,                         type: 'interface' },
  { regex: /^\s*interface\s+\w+\s*\{/,                             type: 'interface' },
  { regex: /^\s*export\s+type\s+\w+\s*=/,                          type: 'type_alias' },
  { regex: /^\s*(export\s+)?(const\s+)enum\s+\w+/,                type: 'enum' },
  { regex: /^\s*@\w+/,                                              type: 'decorator' },
  { regex: /^\s*(export\s+)?async\s+function\s+\w+/,              type: 'async_function' },
  { regex: /^\s*(export\s+)?function\s+\w+/,                      type: 'function' },
  { regex: /^\s*(export\s+)?(const|let)\s+\w+\s*=\s*async\s*\(/, type: 'arrow_function' },
  { regex: /^\s*(export\s+)?(const|let)\s+\w+\s*=\s*\(/,         type: 'arrow_function' },
  { regex: /(crypto|createHash|createHmac|subtle\.digest|bcrypt|argon2|scrypt)/i, type: 'crypto_logic' },
  { regex: /(encrypt|decrypt|sign|verify|pbkdf2|hmac)/i,           type: 'crypto_logic' },
];

// C/C++/Assembly heuristic patterns
const C_PATTERNS: Array<{ regex: RegExp; type: LogicType }> = [
  { regex: /^\s*(typedef\s+)?struct\s+\w+/,                        type: 'logic_block' },
  { regex: /^\s*(typedef\s+)?enum\s+\w+/,                          type: 'logic_block' },
  { regex: /^\s*\w+\s+\w+\s*\(.*\)\s*\{/,                          type: 'function' }, // standard func
  { regex: /^\s*#define\s+\w+/,                                    type: 'logic_block' },
  { regex: /^\s*#include\s+["<]/,                                 type: 'logic_block' },
  { regex: /^\s*[A-Z_0-9]+:\s*$/,                                  type: 'logic_block' }, // Assembly labels
  { regex: /(uint8_t|uint16_t|uint32_t|uint64_t|size_t|bool)/,      type: 'logic_block' },
  { regex: /(encrypt|decrypt|sign|verify|hash|sha256|aes|rsa|pqc)/i, type: 'crypto_logic' },
];

// Python heuristic patterns (for mixed-language repos)
const PY_PATTERNS: Array<{ regex: RegExp; type: LogicType }> = [
  { regex: /^\s*class\s+\w+/,                 type: 'python_class' },
  { regex: /^\s*(async\s+)?def\s+\w+\s*\(/, type: 'python_function' },
  { regex: /^\s*@\w+/,                         type: 'decorator' },
  { regex: /(hashlib|hmac|cryptography|Fernet|sha256|encrypt)/i, type: 'crypto_logic' },
];

const MARKER_INLINE = /\[RCF:(PUBLIC|PROTECTED|RESTRICTED|NOTICE)\]/;
const HEADER_REGEX  = /NOTICE: This file is protected under RCF-PL v[\d.]+/;

const CONTEXT_LINES = 5; // how many lines above to check for a marker

export class Scanner {
  private getPatternsForFile(filePath: string): Array<{ regex: RegExp; type: LogicType }> {
    const ext = extname(filePath).toLowerCase();
    if (ext === '.py') return PY_PATTERNS;
    if (['.c', '.h', '.cpp', '.hpp', '.s', '.asm'].includes(ext)) return C_PATTERNS;
    return TS_PATTERNS;
  }

  scanFile(filePath: string): ScannerResult {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      return {
        path: filePath,
        hasHeader: false,
        isProtected: false,
        hasUnprotectedLogic: false,
        unprotectedLogic: [],
        markers: [],
      };
    }

    const lines = content.split('\n');
    const hasHeader = HEADER_REGEX.test(content);

    // Collect all marker positions and marker types
    const markerLines = new Set<number>();
    const markerTypes: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const m = MARKER_INLINE.exec(lines[i]);
      if (m) {
        markerLines.add(i + 1);
        if (!markerTypes.includes(m[1])) markerTypes.push(m[1]);
      }
    }

    const isProtected = hasHeader || markerTypes.length > 0;
    const patterns = this.getPatternsForFile(filePath);
    const unprotectedLogic: UnprotectedBlock[] = [];
    const seen = new Set<number>();

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      if (seen.has(lineNum)) continue;

      for (const { regex, type } of patterns) {
        if (!regex.test(lines[i])) continue;

        // Check context window above for a marker
        const contextStart = Math.max(0, i - CONTEXT_LINES);
        const contextLines = lines.slice(contextStart, i);
        const hasNearbyMarker = contextLines.some(l => MARKER_INLINE.test(l));

        if (!hasNearbyMarker) {
          unprotectedLogic.push({
            line: lineNum,
            type,
            snippet: lines[i].trim().slice(0, 80),
          });
          seen.add(lineNum);
        }
        break; // one finding per line
      }
    }

    return {
      path: filePath,
      hasHeader,
      isProtected,
      hasUnprotectedLogic: unprotectedLogic.length > 0,
      unprotectedLogic,
      markers: markerTypes,
    };
  }

  /**
   * Returns the correct comment prefix for a given file extension.
   * Used by protect logic to insert markers.
   */
  static commentPrefix(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const file = basename(filePath).toLowerCase();
    if (['.html', '.xml', '.svg'].includes(ext)) return '<!--';
    if (['.css', '.scss', '.less'].includes(ext)) return '/*';
    if (ext === '.py' || ext === '.rb' || ext === '.sh' || file === 'makefile' || ext === '.s') return '#';
    return '//';
  }

  static makeMarkerLine(filePath: string, marker = 'RCF:PROTECTED'): string {
    const ext = extname(filePath).toLowerCase();
    const file = basename(filePath).toLowerCase();
    if (['.html', '.xml'].includes(ext)) return `<!-- [${marker}] -->\n`;
    if (['.css', '.scss'].includes(ext)) return `/* [${marker}] */\n`;
    const prefix = Scanner.commentPrefix(filePath);
    return `${prefix} [${marker}]\n`;
  }

  static headerLine(filePath: string): string {
    const ext = extname(filePath).toLowerCase();
    const file = basename(filePath).toLowerCase();
    const notice = 'NOTICE: This file is protected under RCF-PL v1.3';
    if (['.html', '.xml'].includes(ext)) return `<!-- ${notice} -->\n`;
    if (['.css', '.scss'].includes(ext)) return `/* ${notice} */\n`;
    const prefix = Scanner.commentPrefix(filePath);
    return `${prefix} ${notice}\n`;
  }
}
