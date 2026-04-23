// NOTICE: This file is protected under RCF-PL v2.0.3
// [RCF:PROTECTED]

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, extname } from 'path';
import { MarkerType, RCFMarker, FileScanResult } from './types.js';

const MARKER_REGEX = /\[RCF:(PUBLIC|PROTECTED|RESTRICTED|NOTICE)\]/g;
const HEADER_REGEX = /NOTICE: This file is protected under RCF-PL v[\d.]+/;

const SCANNABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.cpp', '.c',
  '.cs', '.rb', '.php', '.swift', '.kt', '.scala',
  '.h', '.s', '.md', 'makefile'
]);

const DEFAULT_IGNORE = new Set([
  '.git', '__pycache__', '.venv', 'node_modules',
  'dist', 'build', '.next', '.nuxt', 'coverage',
  '.turbo', '.cache', '.parcel-cache',
]);

export class MarkerParser {
  private root: string;
  private ignoreList: Set<string>;

  constructor(root = '.') {
    this.root = root;
    this.ignoreList = new Set(DEFAULT_IGNORE);
    this.loadRcfIgnore();
  }

  private loadRcfIgnore(): void {
    try {
      const content = readFileSync(join(this.root, '.rcfignore'), 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          this.ignoreList.add(trimmed);
        }
      }
    } catch {
      // .rcfignore is optional
    }
  }

  private shouldIgnore(filePath: string): boolean {
    const rel = relative(this.root, filePath);
    const parts = rel.split(/[\\/]/);
    return parts.some(p => this.ignoreList.has(p));
  }

  parseFile(filePath: string): FileScanResult {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch (err: any) {
      return { file: filePath, markers: [], hasHeader: false, isProtected: false, error: err.message };
    }

    const lines = content.split('\n');
    const markers: RCFMarker[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let match: RegExpExecArray | null;
      MARKER_REGEX.lastIndex = 0;

      while ((match = MARKER_REGEX.exec(line)) !== null) {
        markers.push({
          type: match[1] as MarkerType,
          line: i + 1,
          column: match.index + 1,
          context: line.trim().slice(0, 80),
          raw: match[0],
        });
      }
    }

    const hasHeader = HEADER_REGEX.test(content);

    return {
      file: filePath,
      markers,
      hasHeader,
      isProtected: markers.length > 0 || hasHeader,
    };
  }

  async scan(directory: string = this.root): Promise<FileScanResult[]> {
    const results: FileScanResult[] = [];
    this.walkDir(directory, results);
    return results;
  }

  private walkDir(dir: string, results: FileScanResult[]): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (this.shouldIgnore(fullPath)) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        this.walkDir(fullPath, results);
      } else if (
        SCANNABLE_EXTENSIONS.has(extname(entry).toLowerCase()) ||
        SCANNABLE_EXTENSIONS.has(entry.toLowerCase())
      ) {
        const result = this.parseFile(fullPath);
        if (result.isProtected || result.error) {
          results.push(result);
        }
      }
    }
  }

  async scanAll(directory: string = this.root): Promise<FileScanResult[]> {
    const results: FileScanResult[] = [];
    this.walkDirAll(directory, results);
    return results;
  }

  private walkDirAll(dir: string, results: FileScanResult[]): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      if (this.shouldIgnore(fullPath)) continue;

      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        this.walkDirAll(fullPath, results);
      } else if (
        SCANNABLE_EXTENSIONS.has(extname(entry).toLowerCase()) ||
        SCANNABLE_EXTENSIONS.has(entry.toLowerCase())
      ) {
        results.push(this.parseFile(fullPath));
      }
    }
  }
}
