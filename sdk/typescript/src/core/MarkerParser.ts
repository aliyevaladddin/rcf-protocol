import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { RCF_MARKERS, MARKER_REGEX } from './constants';
import { ParseResult, ParsedMarker, RCFMarkerType } from './types';

interface ParserOptions {
  extensions?: string[];
  ignore?: string[];
}

export class MarkerParser {
  private extensions: string[];
  private ignore: string[];

  constructor(options: ParserOptions = {}) {
    this.extensions = options.extensions || ['.ts', '.js', '.tsx', '.jsx', '.py'];
    this.ignore = options.ignore || ['node_modules/**', 'dist/**', '.git/**'];
  }

  async scan(directory: string): Promise<ParseResult[]> {
    const pattern = `**/*{${this.extensions.join(',')}}`;
    const files = await glob(pattern, {
      cwd: directory,
      ignore: this.ignore,
      absolute: true
    });

    const results: ParseResult[] = [];
    for (const file of files) {
      const markers = await this.parseFile(file);
      if (markers.length > 0) {
        results.push({ file, markers });
      }
    }
    return results;
  }

  async parseFile(filePath: string): Promise<ParsedMarker[]> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const markers: ParsedMarker[] = [];

    lines.forEach((line, index) => {
      const matches = line.matchAll(MARKER_REGEX);
      for (const match of matches) {
        const type = match[1] as RCFMarkerType;
        markers.push({
          type,
          marker: RCF_MARKERS[type],
          line: index + 1,
          column: match.index || 0,
          context: line.trim()
        });
      }
    });

    return markers;
  }
}