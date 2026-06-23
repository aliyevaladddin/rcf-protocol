// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { PDG } from './pdg.js';
import { SigmaError } from './sigma.js';
import { wlFeatures } from './wl.js';

export type WeightFn = (feature: string) => number;

export function unitWeight(_feature: string): number {
  return 1.0;
}

export function surprisalWeightFromCorpus(pNat: Record<string, number>, floor: number = 1e-9): WeightFn {
  return (feature: string): number => {
    const p = pNat[feature] !== undefined ? pNat[feature] : 0.0;
    return -Math.log(Math.max(p, floor));
  };
}

function weightedCosine(
  a: Record<string, number>,
  b: Record<string, number>,
  weight: WeightFn
): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0.0;
  let na = 0.0;
  let nb = 0.0;

  for (const f of keys) {
    const w = weight(f);
    const av = a[f] !== undefined ? a[f] : 0;
    const bv = b[f] !== undefined ? b[f] : 0;
    dot += w * av * bv;
    na += w * av * av;
    nb += w * bv * bv;
  }

  if (na === 0.0 || nb === 0.0) {
    return 0.0;
  }

  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Calculates correlation between two PDGs using surprisal-weighted cosine.
 * Matches rcf_core.correlate.correlate in Python.
 */
export function correlate(
  a: PDG,
  b: PDG,
  options?: {
    iterations?: number;
    weight?: WeightFn;
  }
): number {
  const iterations = options?.iterations !== undefined ? options.iterations : 2;
  const weight = options?.weight !== undefined ? options.weight : unitWeight;

  if (a.sigma.alphabetHash !== b.sigma.alphabetHash) {
    throw new SigmaError(
      `incomparable: alphabet_hash mismatch\n` +
      `  A: ${a.sigma.alphabetHash}\n` +
      `  B: ${b.sigma.alphabetHash}`
    );
  }

  const fa = wlFeatures(a, iterations);
  const fb = wlFeatures(b, iterations);

  return weightedCosine(fa, fb, weight);
}
