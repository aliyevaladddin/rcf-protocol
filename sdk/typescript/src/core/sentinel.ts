// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { PDG } from './pdg.js';
import { Sigma } from './sigma.js';
import { Corpus } from './corpus.js';
import { measureProject } from './measure.js';

export interface Sentinel {
  label: string;
  totalMass: number;
  uniqueMass: number;
  uniquenessRatio: number;
}

/**
 * Measure a project's PROTECTED function units live and return the `topN` by
 * surprisal mass — the natural signatures worth watching.
 * Matches rcf_core.sentinel.rank_sentinels in Python.
 */
export function rankSentinels(
  root: string,
  corpus: Corpus,
  sigma?: Sigma,
  options?: {
    topN?: number;
  }
): Sentinel[] {
  const topN = options?.topN !== undefined ? options.topN : 5;
  const reports = measureProject(root, corpus, sigma);
  const ranked = [...reports].sort((a, b) => b.totalMass - a.totalMass);
  return ranked.slice(0, topN).map(r => ({
    label: r.label,
    totalMass: r.totalMass,
    uniqueMass: r.uniqueMass,
    uniquenessRatio: r.uniquenessRatio,
  }));
}
