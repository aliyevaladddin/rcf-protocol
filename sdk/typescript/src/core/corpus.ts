// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import Parser from 'tree-sitter';
// @ts-ignore
import TypeScript from 'tree-sitter-typescript';
import { PDG } from './pdg.js';
import { Sigma, loadSigma, SigmaError, timingSafeHashEqual } from './sigma.js';

import { wlFeatures } from './wl.js';
import { normalizeTypescript } from './normalize_typescript.js';
import { normalizeByExtension } from './normalize.js';
import { Scanner } from './Scanner.js';

export function safeJoinWithin(basePath: string, rel: string): string {
  const base = path.resolve(basePath);
  const p = path.resolve(base, rel);
  if (base !== p && !p.startsWith(base + path.sep)) {
    throw new Error(`path escapes project root: ${rel}`);
  }
  return p;
}

export function iterFunctionUnits(source: string): string[] {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  let tree;
  try {
    tree = parser.parse(source);
  } catch (e) {
    return [];
  }

  const units: string[] = [];
  function visit(node: Parser.SyntaxNode) {
    if (
      node.type === 'function_declaration' ||
      node.type === 'arrow_function' ||
      node.type === 'function_expression' ||
      node.type === 'method_definition'
    ) {
      units.push(node.text);
    }
    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i)!);
    }
  }
  if (tree.rootNode) {
    visit(tree.rootNode);
  }
  return units;
}

export class Corpus {
  public readonly alphabetHash: string;
  public readonly sigmaVersion: string;
  public readonly totalUnits: number;
  public readonly docFreq: Record<string, number>;

  constructor(
    alphabetHash: string,
    sigmaVersion: string,
    totalUnits: number,
    docFreq: Record<string, number>
  ) {
    this.alphabetHash = alphabetHash;
    this.sigmaVersion = sigmaVersion;
    this.totalUnits = totalUnits;
    this.docFreq = docFreq;
  }

  public pNat(): Record<string, number> {
    if (this.totalUnits === 0) {
      return {};
    }
    const n = this.totalUnits;
    const p: Record<string, number> = {};
    for (const [f, c] of Object.entries(this.docFreq)) {
      p[f] = c / n;
    }
    return p;
  }

  public weightFn(floor: number = 1e-9): (feature: string) => number {
    const pNatMap = this.pNat();
    return (feature: string): number => {
      const p = pNatMap[feature] !== undefined ? pNatMap[feature] : 0.0;
      return -Math.log(Math.max(p, floor));
    };
  }

  public weightThreshold(percentile: number = 0.5): number {
    const keys = Object.keys(this.docFreq);
    if (keys.length === 0) {
      return 0.0;
    }
    const w = this.weightFn();
    const weights = keys.map(f => w(f));
    weights.sort((a, b) => a - b);
    const idx = Math.min(weights.length - 1, Math.max(0, Math.floor(percentile * (weights.length - 1))));
    return weights[idx];
  }
}

export function buildCorpus(
  unitSources: Iterable<string>,
  sigma?: Sigma,
  iterations: number = 2
): Corpus {
  const s = sigma || loadSigma();
  const docFreq: Record<string, number> = {};
  let total = 0;

  for (const src of unitSources) {
    let pdg: PDG;
    try {
      pdg = normalizeTypescript(src, s);
    } catch {
      continue;
    }
    const feats = wlFeatures(pdg, iterations);
    if (Object.keys(feats).length === 0) {
      continue;
    }
    total++;
    for (const f of Object.keys(feats)) {
      docFreq[f] = (docFreq[f] || 0) + 1;
    }
  }

  return new Corpus(s.alphabetHash, s.version, total, docFreq);
}

export function freezeCorpus(corpus: Corpus, filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== '.json') {
    throw new SigmaError(`corpus target must be a .json file, got: ${path.basename(resolvedPath)}`);
  }
  const parent = path.dirname(resolvedPath);
  mkdirSync(parent, { recursive: true });

  const payload = {
    alphabet_hash: corpus.alphabetHash,
    sigma_version: corpus.sigmaVersion,
    total_units: corpus.totalUnits,
    doc_freq: corpus.docFreq,
  };
  writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
  return resolvedPath;
}

export function loadCorpus(
  filePath: string,
  sigma?: Sigma,
  verifyAlphabet: boolean = true
): Corpus {
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== '.json') {
    throw new SigmaError(`corpus source must be a .json file, got: ${path.basename(resolvedPath)}`);
  }
  if (!existsSync(resolvedPath)) {
    throw new SigmaError(`corpus not found at: ${resolvedPath}`);
  }

  let data: any;
  try {
    data = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
  } catch (e: any) {
    throw new SigmaError(`corpus is not valid JSON: ${e.message}`);
  }

  for (const key of ['alphabet_hash', 'sigma_version', 'total_units', 'doc_freq']) {
    if (data[key] === undefined) {
      throw new SigmaError(`corpus missing required key: '${key}'`);
    }
  }

  if (verifyAlphabet) {
    const live = (sigma || loadSigma()).alphabetHash;
    if (!timingSafeHashEqual(data.alphabet_hash ?? '', live)) {
      throw new SigmaError(
        `corpus alphabet_hash mismatch — rebuild the corpus for this Σ.`
      );
    }
  }

  return new Corpus(
    data.alphabet_hash,
    data.sigma_version,
    data.total_units,
    data.doc_freq
  );
}

export function collectProjectBackgroundSources(root: string): string[] {
  const scanner = new Scanner();
  const results = scanner.scanDirectory(root);
  const units: string[] = [];

  for (const res of results) {
    if (res.isProtected) {
      continue;
    }
    const ext = path.extname(res.path).toLowerCase();
    if (!['.ts', '.js', '.tsx', '.jsx', '.go', '.rs'].includes(ext)) {
      continue;
    }
    let src: string;
    try {
      const fpath = safeJoinWithin(root, path.relative(root, res.path));
      src = readFileSync(fpath, 'utf-8');
    } catch {
      continue;
    }
    units.push(...iterFunctionUnits(src));
  }
  return units;
}

/**
 * Build a Corpus from a list of file paths.
 * Each file is read from disk and dispatched to the correct normalizer
 * based on its extension (.go → Go, .rs → Rust, .ts/.js → TypeScript).
 */
export function buildCorpusFromFiles(
  filePaths: string[],
  sigma?: Sigma,
  iterations: number = 2
): Corpus {
  const s = sigma || loadSigma();
  const docFreq: Record<string, number> = {};
  let total = 0;

  for (const fpath of filePaths) {
    let src: string;
    try {
      src = readFileSync(fpath, 'utf-8');
    } catch {
      continue;
    }
    const ext = path.extname(fpath).toLowerCase();
    let pdg: PDG;
    try {
      pdg = normalizeByExtension(src, ext, s);
    } catch {
      continue;
    }
    const feats = wlFeatures(pdg, iterations);
    if (Object.keys(feats).length === 0) continue;
    total++;
    for (const f of Object.keys(feats)) {
      docFreq[f] = (docFreq[f] || 0) + 1;
    }
  }

  return new Corpus(s.alphabetHash, s.version, total, docFreq);
}
