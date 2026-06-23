// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Constant-time string comparison for hash values.
 * Prevents timing side-channel attacks on alphabet hash checks.
 */
export function timingSafeHashEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export class SigmaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SigmaError';
  }
}

// Find repository root from current file context
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '../../../../');
const DEFAULT_SIGMA_PATH = join(REPO_ROOT, 'SPECIFICATION', 'sigma.json');

export function computeAlphabetHash(nodes: Record<string, any>, edges: Record<string, any>): string {
  const alphabet: Record<string, any> = {
    nodes: {},
    edges: Object.keys(edges).sort()
  };

  for (const [cls, spec] of Object.entries(nodes)) {
    alphabet.nodes[cls] = [...spec.ops].sort();
  }

  // Deterministic JSON stringify without whitespace
  const sortedKeys = Object.keys(alphabet).sort();
  const canonicalForm: Record<string, any> = {};
  for (const k of sortedKeys) {
    if (k === 'nodes') {
      const sortedNodes: Record<string, string[]> = {};
      for (const cls of Object.keys(alphabet.nodes).sort()) {
        sortedNodes[cls] = alphabet.nodes[cls];
      }
      canonicalForm[k] = sortedNodes;
    } else {
      canonicalForm[k] = alphabet[k];
    }
  }

  const blob = JSON.stringify(canonicalForm);
  const hash = createHash('sha256').update(blob).digest('hex');
  return 'sha256:' + hash;
}

export class Sigma {
  constructor(
    public readonly version: string,
    public readonly alphabetHash: string,
    public readonly nodes: Record<string, { ops: string[]; doc: string }>,
    public readonly edges: Record<string, { doc: string; normative: boolean }>
  ) {}

  public isClass(cls: string): boolean {
    return cls in this.nodes;
  }

  public isLabel(cls: string, op?: string): boolean {
    if (!(cls in this.nodes)) {
      return false;
    }
    if (op === undefined) {
      return true;
    }
    return this.nodes[cls].ops.includes(op);
  }

  public isEdge(edgeType: string): boolean {
    return edgeType in this.edges;
  }

  public normativeEdges(): string[] {
    return Object.entries(this.edges)
      .filter(([_, spec]) => spec.normative)
      .map(([type]) => type);
  }

  public requireLabel(cls: string, op?: string): void {
    if (!this.isLabel(cls, op)) {
      throw new SigmaError(`label not in Σ ${this.version}: (${cls}, ${op})`);
    }
  }

  public classes(): string[] {
    return Object.keys(this.nodes);
  }

  public ops(cls: string): string[] {
    return [...this.nodes[cls].ops];
  }
}

export function loadSigma(filePath?: string, verifyHash = true): Sigma {
  const p = filePath ? resolve(filePath) : DEFAULT_SIGMA_PATH;
  if (!p.endsWith('.json')) {
    throw new SigmaError(`Σ source must be a .json file, got: ${p}`);
  }
  if (!existsSync(p)) {
    throw new SigmaError(`sigma.json not found at: ${p}`);
  }

  let data: any;
  try {
    data = JSON.parse(readFileSync(p, 'utf-8'));
  } catch (e: any) {
    throw new SigmaError(`sigma.json is not valid JSON: ${e.message}`);
  }

  for (const key of ['sigma_version', 'alphabet_hash', 'nodes', 'edges']) {
    if (!(key in data)) {
      throw new SigmaError(`sigma.json missing required key: '${key}'`);
    }
  }

  const { nodes, edges } = data;
  if (typeof nodes !== 'object' || typeof edges !== 'object' || nodes === null || edges === null) {
    throw new SigmaError("sigma.json 'nodes'/'edges' must be objects");
  }

  for (const [cls, spec] of Object.entries(nodes)) {
    if (typeof spec !== 'object' || spec === null || !('ops' in spec) || !Array.isArray((spec as any).ops)) {
      throw new SigmaError(`sigma.json node '${cls}' must have an 'ops' list`);
    }
  }

  const recomputed = computeAlphabetHash(nodes, edges);
  if (verifyHash && !timingSafeHashEqual(recomputed, data.alphabet_hash)) {
    throw new SigmaError(
      `alphabet_hash drift — sigma.json was edited without recomputing the hash.\n` +
      `  stored    : [redacted]\n` +
      `  recomputed: [redacted]\n` +
      `Either revert the change or update alphabet_hash (this is a breaking Σ change).`
    );
  }

  return new Sigma(
    data.sigma_version,
    data.alphabet_hash,
    nodes,
    edges
  );
}
