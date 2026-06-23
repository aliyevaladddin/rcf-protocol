// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { readFileSync } from 'fs';
import path from 'path';
import { PDG } from './pdg.js';
import { Sigma, loadSigma, SigmaError } from './sigma.js';
import { wlFeatures } from './wl.js';
import { normalizeTypescript } from './normalize_typescript.js';
import { Corpus, iterFunctionUnits, safeJoinWithin } from './corpus.js';
import { Scanner } from './Scanner.js';

export const BANAL_PERCENTILE = 0.5;

export interface FeatureContribution {
  feature: string;
  pNat: number;
  weight: number;
  count: number;
  mass: number;
  banal: boolean;
}

export class UnitReport {
  public label: string;
  public totalMass: number = 0.0;
  public uniqueMass: number = 0.0;
  public banalMass: number = 0.0;
  public contributions: FeatureContribution[] = [];

  constructor(label: string) {
    this.label = label;
  }

  public get uniquenessRatio(): number {
    if (this.totalMass === 0.0) {
      return 0.0;
    }
    return this.uniqueMass / this.totalMass;
  }

  public topSignature(n: number = 5): FeatureContribution[] {
    const rare = this.contributions.filter(c => !c.banal);
    return rare.sort((a, b) => b.mass - a.mass).slice(0, n);
  }
}

/**
 * Compute the surprisal map of one PDG against a corpus.
 * Matches rcf_core.measure.measure_unit in Python.
 */
export function measureUnit(
  pdg: PDG,
  corpus: Corpus,
  label: string = '<unit>',
  options?: {
    iterations?: number;
    banalPercentile?: number;
  }
): UnitReport {
  const iterations = options?.iterations !== undefined ? options.iterations : 2;
  const banalPercentile = options?.banalPercentile !== undefined ? options.banalPercentile : BANAL_PERCENTILE;

  if (pdg.sigma.alphabetHash !== corpus.alphabetHash) {
    throw new SigmaError(
      `incomparable: PDG and corpus alphabet_hash differ\n` +
      `  pdg   : ${pdg.sigma.alphabetHash}\n` +
      `  corpus: ${corpus.alphabetHash}`
    );
  }

  const pNatMap = corpus.pNat();
  const weightFn = corpus.weightFn();
  const cut = corpus.weightThreshold(banalPercentile);
  const feats = wlFeatures(pdg, iterations);

  const report = new UnitReport(label);
  for (const [f, count] of Object.entries(feats)) {
    const p = pNatMap[f] !== undefined ? pNatMap[f] : 0.0;
    const w = weightFn(f);
    const mass = w * count;
    const banal = w < cut;
    report.contributions.push({
      feature: f,
      pNat: p,
      weight: w,
      count,
      mass,
      banal,
    });
    report.totalMass += mass;
    if (banal) {
      report.banalMass += mass;
    } else {
      report.uniqueMass += mass;
    }
  }
  return report;
}

/**
 * Measure every function unit in a source string.
 * Matches rcf_core.measure.measure_source in Python.
 */
export function measureSource(
  source: string,
  corpus: Corpus,
  sigma?: Sigma
): UnitReport[] {
  const s = sigma || loadSigma();
  const reports: UnitReport[] = [];
  const units = iterFunctionUnits(source);
  for (let i = 0; i < units.length; i++) {
    const unitSrc = units[i];
    let pdg: PDG;
    try {
      pdg = normalizeTypescript(unitSrc, s);
    } catch {
      continue;
    }
    const lines = unitSrc.trim().split('\n');
    const first = lines.length > 0 && lines[0].trim() !== '' ? lines[0].trim() : `unit#${i}`;
    reports.push(measureUnit(pdg, corpus, first.slice(0, 60)));
  }
  return reports;
}

/**
 * Measure the PROTECTED function units of a project.
 * Matches rcf_core.measure.measure_project in Python.
 */
export function measureProject(
  root: string,
  corpus: Corpus,
  sigma?: Sigma
): UnitReport[] {
  const s = sigma || loadSigma();
  const scanner = new Scanner();
  const results = scanner.scanDirectory(root);
  const reports: UnitReport[] = [];

  for (const res of results) {
    if (!res.isProtected) {
      continue;
    }
    const ext = path.extname(res.path).toLowerCase();
    if (!['.ts', '.js', '.tsx', '.jsx'].includes(ext)) {
      continue;
    }
    let src: string;
    try {
      const fpath = safeJoinWithin(root, path.relative(root, res.path));
      src = readFileSync(fpath, 'utf-8');
    } catch {
      continue;
    }
    const relativePath = path.relative(root, res.path);
    for (const rep of measureSource(src, corpus, s)) {
      rep.label = `${relativePath} :: ${rep.label}`;
      reports.push(rep);
    }
  }
  return reports;
}
