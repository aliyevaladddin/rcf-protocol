import { describe, expect, it } from '@jest/globals';
import { loadSigma } from '../src/core/sigma.js';
import { buildCorpus } from '../src/core/corpus.js';
import { rankSentinels } from '../src/core/sentinel.js';
import fs from 'fs';
import path from 'path';

function setupWorkspace(files?: string[]): string {
  const tmpDir = path.resolve('tests/temp_sentinel_workspace');
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
  fs.mkdirSync(tmpDir, { recursive: true });

  const allFiles = {
    'light.ts': '// NOTICE: This file is protected under RCF-PL\n// [RCF:PROTECTED]\nfunction light(x) { return x; }',
    'heavy.ts': '// NOTICE: This file is protected under RCF-PL\n// [RCF:PROTECTED]\nfunction heavy(x) {\n  let tmp = x ^ 12345;\n  let res = tmp ^ (12345 ^ x) & 0xFF;\n  if (res > 10) {\n    return res;\n  }\n  return 0;\n}',
    'mid.ts': '// NOTICE: This file is protected under RCF-PL\n// [RCF:PROTECTED]\nfunction mid(x) { return x * 2 + 1; }',
    'tiny.ts': '// NOTICE: This file is protected under RCF-PL\n// [RCF:PROTECTED]\nfunction tiny() { return 0; }'
  };

  const targets = files || Object.keys(allFiles);
  for (const name of targets) {
    fs.writeFileSync(path.join(tmpDir, name), allFiles[name as keyof typeof allFiles]);
  }

  return tmpDir;
}

function teardownWorkspace(tmpDir: string) {
  if (fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

describe('Sentinel ranking watch-list (rcf_core.sentinel)', () => {
  // 1. test_ranks_by_mass_desc_and_caps
  it('should rank sentinels by total mass descending and cap them', () => {
    const tmpDir = setupWorkspace();
    const sigma = loadSigma();

    // Build background corpus from the same files
    const sources = [
      fs.readFileSync(path.join(tmpDir, 'light.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'heavy.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'mid.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'tiny.ts'), 'utf-8')
    ];
    const corpus = buildCorpus(sources, sigma);

    const out = rankSentinels(tmpDir, corpus, sigma, { topN: 2 });

    expect(out.length).toBe(2);
    expect(out[0].label).toContain('heavy');
    expect(out[1].label).toContain('mid');
    expect(out[0].totalMass).toBeGreaterThan(out[1].totalMass);

    teardownWorkspace(tmpDir);
  });

  // 2. test_top_n_larger_than_pool_returns_all
  it('should return all units if topN is larger than the reports pool', () => {
    const tmpDir = setupWorkspace(['light.ts', 'heavy.ts']);
    const sigma = loadSigma();
    const sources = [
      fs.readFileSync(path.join(tmpDir, 'light.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'heavy.ts'), 'utf-8')
    ];
    const corpus = buildCorpus(sources, sigma);

    const out = rankSentinels(tmpDir, corpus, sigma, { topN: 10 });
    expect(out.length).toBe(2); // only 2 exist

    teardownWorkspace(tmpDir);
  });

  // 3. test_empty_project_yields_no_sentinels
  it('should yield an empty watch-list if the project is empty', () => {
    const tmpDir = path.resolve('tests/temp_empty_sentinel_workspace');
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tmpDir, { recursive: true });

    const sigma = loadSigma();
    const corpus = buildCorpus(['function f(a) { return a; }'], sigma);

    const out = rankSentinels(tmpDir, corpus, sigma);
    expect(out).toEqual([]);

    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // 4. test_uniqueness_ratio_carried_through
  it('should calculate and carry through uniqueness ratio correctly', () => {
    const tmpDir = setupWorkspace(['heavy.ts']);
    const sigma = loadSigma();
    const sources = [
      fs.readFileSync(path.join(tmpDir, 'heavy.ts'), 'utf-8')
    ];
    const corpus = buildCorpus(sources, sigma);

    const out = rankSentinels(tmpDir, corpus, sigma);
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].uniquenessRatio).toBeLessThanOrEqual(1.0);
    expect(out[0].uniquenessRatio).toBeGreaterThanOrEqual(0.0);

    teardownWorkspace(tmpDir);
  });

  // 5. test_live_ranks_rcf_core_protected_units
  it('should sort live reports descending and cap them', () => {
    const tmpDir = setupWorkspace();
    const sigma = loadSigma();
    const sources = [
      fs.readFileSync(path.join(tmpDir, 'light.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'heavy.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'mid.ts'), 'utf-8'),
      fs.readFileSync(path.join(tmpDir, 'tiny.ts'), 'utf-8')
    ];
    const corpus = buildCorpus(sources, sigma);

    const out = rankSentinels(tmpDir, corpus, sigma, { topN: 3 });
    expect(out.length).toBeLessThanOrEqual(3);

    const masses = out.map(s => s.totalMass);
    const expectedSorted = [...masses].sort((a, b) => b - a);
    expect(masses).toEqual(expectedSorted);

    teardownWorkspace(tmpDir);
  });
});
