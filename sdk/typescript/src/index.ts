// NOTICE: This file is protected under RCF-PL
export { MarkerParser } from './core/MarkerParser.js';
export { Scanner } from './core/Scanner.js';
export { ComplianceValidator } from './core/ComplianceValidator.js';
export { RCF_MARKERS, MARKER_REGEX } from './core/constants.js';
export * from './core/types.js';
export type { LogicType, UnprotectedBlock, ScannerResult } from './core/Scanner.js';

export { loadSigma, Sigma, SigmaError } from './core/sigma.js';
export { PDG, PdgNode, PdgEdge } from './core/pdg.js';
export { normalizeTypescript } from './core/normalize_typescript.js';
export { normalizeGo } from './core/normalize_go.js';
export { normalizeRust } from './core/normalize_rust.js';
export { wlFeatures } from './core/wl.js';
export { correlate, unitWeight, surprisalWeightFromCorpus } from './core/correlate.js';
export type { WeightFn } from './core/correlate.js';

export {
  Corpus,
  buildCorpus,
  freezeCorpus,
  loadCorpus,
  collectProjectBackgroundSources,
  iterFunctionUnits,
  safeJoinWithin
} from './core/corpus.js';

export {
  BANAL_PERCENTILE,
  UnitReport,
  measureUnit,
  measureSource,
  measureProject
} from './core/measure.js';
export type { FeatureContribution } from './core/measure.js';

export { rankSentinels } from './core/sentinel.js';
export type { Sentinel } from './core/sentinel.js';

export {
  findSubgraphIsomorphisms,
  pdgFromDict,
  CanaryRecord,
  extractCanaryBlock
} from './core/canary.js';

export { injectAdversarialNoiseTypescript } from './core/noise.js';

export {
  DEFAULT_SEED,
  erfc,
  bisectLeft,
  SeededRandom,
  NullModel,
  ProofReport,
  buildNull,
  evaluate,
  prove,
  freezeNull,
  loadNull
} from './core/proof.js';

export const VERSION = '2.1.8';