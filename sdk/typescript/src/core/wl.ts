// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { createHash } from 'crypto';
import { PDG } from './pdg.js';

function stableHash(text: string): string {
  return createHash('sha256').update(text).digest('hex').substring(0, 16);
}

/**
 * Extract the WL feature multiset from a PDG.
 * Matches rcf_core.wl.wl_features in Python.
 */
export function wlFeatures(pdg: PDG, iterations: number = 2): Record<string, number> {
  if (iterations < 0) {
    throw new Error('iterations must be >= 0');
  }

  // Level 0: raw label of each node.
  let current: Record<number, string> = {};
  for (const n of pdg.nodes) {
    current[n.nid] = n.label;
  }

  const features: Record<string, number> = {};

  const emit = (level: number, labels: Record<number, string>) => {
    for (const lab of Object.values(labels)) {
      const key = `L${level}:${lab}`;
      features[key] = (features[key] || 0) + 1;
    }
  };

  emit(0, current);

  for (let level = 1; level <= iterations; level++) {
    const nextLabels: Record<number, string> = {};
    for (const nidStr of Object.keys(current)) {
      const nid = parseInt(nidStr, 10);
      
      const neighbors = pdg.neighbors(nid);
      const ctx = neighbors.map(([direction, etype, other]) => {
        return `${direction}/${etype}/${current[other]}`;
      });
      ctx.sort();

      const signature = current[nid] + '|' + ctx.join(',');
      nextLabels[nid] = stableHash(signature);
    }
    emit(level, nextLabels);
    current = nextLabels;
  }

  return features;
}
