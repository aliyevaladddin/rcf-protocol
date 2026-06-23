// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { PDG } from './pdg.js';
import { Sigma, loadSigma, SigmaError } from './sigma.js';
import { wlFeatures } from './wl.js';
import { normalizeTypescript } from './normalize_typescript.js';
import { Corpus, iterFunctionUnits, loadCorpus } from './corpus.js';
import { correlate } from './correlate.js';

export const DEFAULT_SEED = 20250619;

/**
 * Complementary error function erfc(x) approximation.
 * Fractional error <= 1.2e-7.
 */
export function erfc(x: number): number {
  if (x < 0) {
    return 2.0 - erfc(-x);
  }
  const t = 1.0 / (1.0 + 0.5 * x);
  const tau = t * Math.exp(
    -x * x - 1.26551223 +
    t * (1.00002368 +
    t * (0.37409196 +
    t * (0.09678418 +
    t * (-0.18628806 +
    t * (0.27886807 +
    t * (-1.13520398 +
    t * (1.48851587 +
    t * (-0.82215223 +
    t * 0.17087277))))))))
  );
  return tau;
}

export function bisectLeft(arr: number[], x: number): number {
  let low = 0;
  let high = arr.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (arr[mid] < x) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }
  return low;
}

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  public next(): number {
    let z = (this.state += 0x6d2b79f5);
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }

  public randrange(n: number): number {
    return Math.floor(this.next() * n);
  }
}

export class NullModel {
  public readonly alphabetHash: string;
  public readonly sigmaVersion: string;
  public readonly nPairs: number;
  public readonly seed: number;
  public readonly iterations: number;
  public readonly weightFloor: number;
  public readonly mean: number;
  public readonly std: number;
  public readonly samples: number[];

  constructor(
    alphabetHash: string,
    sigmaVersion: string,
    nPairs: number,
    seed: number,
    iterations: number,
    weightFloor: number,
    mean: number,
    std: number,
    samples: number[]
  ) {
    this.alphabetHash = alphabetHash;
    this.sigmaVersion = sigmaVersion;
    this.nPairs = nPairs;
    this.seed = seed;
    this.iterations = iterations;
    this.weightFloor = weightFloor;
    this.mean = mean;
    this.std = std;
    this.samples = samples;
  }

  public get pFloor(): number {
    return 1.0 / (this.nPairs + 1);
  }

  public pEmpirical(score: number): number {
    if (this.nPairs === 0) {
      return 1.0;
    }
    const idx = bisectLeft(this.samples, score);
    const ge = this.samples.length - idx;
    return (ge + 1) / (this.nPairs + 1);
  }

  public zScore(score: number): number {
    if (this.std === 0.0) {
      return 0.0;
    }
    return (score - this.mean) / this.std;
  }

  public pParametric(score: number): number {
    if (this.std === 0.0) {
      return 1.0;
    }
    const z = this.zScore(score);
    return 0.5 * erfc(z / Math.sqrt(2.0));
  }
}

export class ProofReport {
  public readonly score: number;
  public readonly zScore: number;
  public readonly pEmpirical: number;
  public readonly pEmpiricalFloor: number;
  public readonly pParametric: number;
  public readonly eValue: number;
  public readonly nPairs: number;
  public readonly searchSpace: number;

  constructor(
    score: number,
    zScore: number,
    pEmpirical: number,
    pEmpiricalFloor: number,
    pParametric: number,
    eValue: number,
    nPairs: number,
    searchSpace: number = 1
  ) {
    this.score = score;
    this.zScore = zScore;
    this.pEmpirical = pEmpirical;
    this.pEmpiricalFloor = pEmpiricalFloor;
    this.pParametric = pParametric;
    this.eValue = eValue;
    this.nPairs = nPairs;
    this.searchSpace = searchSpace;
  }

  public get empiricalIsFloored(): boolean {
    return this.pEmpirical <= this.pEmpiricalFloor + 1e-300;
  }

  public get significant(): boolean {
    return this.empiricalIsFloored;
  }
}

export function buildNull(
  unitSources: Iterable<string>,
  corpus: Corpus,
  sigma?: Sigma,
  options?: {
    nPairs?: number;
    seed?: number;
    iterations?: number;
  }
): NullModel {
  const s = sigma || loadSigma();
  if (corpus.alphabetHash !== s.alphabetHash) {
    throw new SigmaError(
      `incomparable: corpus and live Σ alphabet_hash differ\n` +
      `  corpus: ${corpus.alphabetHash}\n` +
      `  live  : ${s.alphabetHash}`
    );
  }

  const nPairs = options?.nPairs !== undefined ? options.nPairs : 5000;
  const seed = options?.seed !== undefined ? options.seed : DEFAULT_SEED;
  const iterations = options?.iterations !== undefined ? options.iterations : 2;

  const weightFloor = 1e-9;
  const weight = corpus.weightFn(weightFloor);

  // Lower each unit source to its WL feature vector
  const pool: Array<Record<string, number>> = [];
  for (const src of unitSources) {
    let pdg: PDG;
    try {
      pdg = normalizeTypescript(src, s);
    } catch {
      continue;
    }
    const feats = wlFeatures(pdg, iterations);
    if (Object.keys(feats).length > 0) {
      pool.push(feats);
    }
  }

  const n = pool.length;
  if (n < 2) {
    throw new SigmaError(`null needs ≥2 usable units, got ${n}`);
  }

  const rng = new SeededRandom(seed);
  const scores: number[] = [];
  for (let step = 0; step < nPairs; step++) {
    const i = rng.randrange(n);
    let j = rng.randrange(n);
    while (j === i) {
      j = rng.randrange(n);
    }

    // Weighted cosine calculation inline/delegated
    const vecA = pool[i];
    const vecB = pool[j];
    
    // Calculate weighted dot product and magnitudes
    let dot = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    
    const allKeys = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
    for (const key of allKeys) {
      const w = weight(key);
      const valA = vecA[key] || 0.0;
      const valB = vecB[key] || 0.0;
      
      dot += w * w * valA * valB;
      normA += w * w * valA * valA;
      normB += w * w * valB * valB;
    }
    
    const score = normA > 0 && normB > 0 ? dot / Math.sqrt(normA * normB) : 0.0;
    scores.push(score);
  }

  const mean = scores.reduce((sum, v) => sum + v, 0) / scores.length;
  const variance = scores.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / scores.length;
  const std = Math.sqrt(variance);
  scores.sort((a, b) => a - b);

  return new NullModel(
    s.alphabetHash,
    s.version,
    scores.length,
    seed,
    iterations,
    weightFloor,
    mean,
    std,
    scores
  );
}

export function evaluate(score: number, nullModel: NullModel, options?: { searchSpace?: number }): ProofReport {
  const searchSpace = options?.searchSpace !== undefined ? options.searchSpace : 1;
  const pParam = nullModel.pParametric(score);
  return new ProofReport(
    score,
    nullModel.zScore(score),
    nullModel.pEmpirical(score),
    nullModel.pFloor,
    pParam,
    pParam * searchSpace,
    nullModel.nPairs,
    searchSpace
  );
}

export function prove(
  a: PDG,
  b: PDG,
  nullModel: NullModel,
  corpus: Corpus,
  options?: {
    iterations?: number;
    searchSpace?: number;
  }
): ProofReport {
  const iterations = options?.iterations !== undefined ? options.iterations : 2;
  const searchSpace = options?.searchSpace !== undefined ? options.searchSpace : 1;

  const hashes = {
    A: a.sigma.alphabetHash,
    B: b.sigma.alphabetHash,
    corpus: corpus.alphabetHash,
    null: nullModel.alphabetHash,
  };

  if (new Set(Object.values(hashes)).size !== 1) {
    const detail = Object.entries(hashes).map(([k, v]) => `  ${k.padEnd(6)}: ${v}`).join('\n');
    throw new SigmaError('incomparable: alphabet_hash mismatch\n' + detail);
  }

  if (iterations !== nullModel.iterations) {
    throw new SigmaError(
      `iterations mismatch: the null calibrates one feature space\n` +
      `  requested : ${iterations}\n` +
      `  null built: ${nullModel.iterations}`
    );
  }

  const score = correlate(a, b, {
    iterations,
    weight: corpus.weightFn(nullModel.weightFloor),
  });

  return evaluate(score, nullModel, { searchSpace });
}

export function proveSources(
  srcA: string,
  srcB: string,
  nullModel: NullModel,
  corpus: Corpus,
  sigma?: Sigma,
  options?: {
    iterations?: number;
    searchSpace?: number;
  }
): ProofReport {
  const s = sigma || loadSigma();
  const a = normalizeTypescript(srcA, s);
  const b = normalizeTypescript(srcB, s);
  return prove(a, b, nullModel, corpus, options);
}

export function freezeNull(nullModel: NullModel, filePath: string): string {
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== '.json') {
    throw new SigmaError(`null target must be a .json file, got: ${path.basename(resolvedPath)}`);
  }
  const parent = path.dirname(resolvedPath);
  mkdirSync(parent, { recursive: true });

  const payload = {
    alphabet_hash: nullModel.alphabetHash,
    sigma_version: nullModel.sigmaVersion,
    n_pairs: nullModel.nPairs,
    seed: nullModel.seed,
    iterations: nullModel.iterations,
    weight_floor: nullModel.weightFloor,
    mean: nullModel.mean,
    std: nullModel.std,
    samples: nullModel.samples,
  };
  writeFileSync(resolvedPath, JSON.stringify(payload, null, 2), 'utf-8');
  return resolvedPath;
}

export function loadNull(
  filePath: string,
  sigma?: Sigma,
  verifyAlphabet: boolean = true
): NullModel {
  const resolvedPath = path.resolve(filePath);
  if (path.extname(resolvedPath).toLowerCase() !== '.json') {
    throw new SigmaError(`null source must be a .json file, got: ${path.basename(resolvedPath)}`);
  }
  if (!existsSync(resolvedPath)) {
    throw new SigmaError(`null model not found at: ${resolvedPath}`);
  }

  let data: any;
  try {
    data = JSON.parse(readFileSync(resolvedPath, 'utf-8'));
  } catch (e: any) {
    throw new SigmaError(`null model is not valid JSON: ${e.message}`);
  }

  const required = [
    'alphabet_hash', 'sigma_version', 'n_pairs', 'seed',
    'iterations', 'weight_floor', 'mean', 'std', 'samples',
  ];
  for (const key of required) {
    if (data[key] === undefined) {
      throw new SigmaError(`null model missing required key: '${key}'`);
    }
  }

  if (verifyAlphabet) {
    const live = (sigma || loadSigma()).alphabetHash;
    if (data.alphabet_hash !== live) {
      throw new SigmaError(
        `null model alphabet_hash mismatch — rebuild the null for this Σ.\n` +
        `  null: ${data.alphabet_hash}\n` +
        `  live: ${live}`
      );
    }
  }

  return new NullModel(
    data.alphabet_hash,
    data.sigma_version,
    data.n_pairs,
    data.seed,
    data.iterations,
    data.weight_floor,
    data.mean,
    data.std,
    data.samples.map(Number)
  );
}
