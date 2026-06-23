// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import os from 'os';
import { PDG } from './pdg.js';
import { Sigma, loadSigma, SigmaError, timingSafeHashEqual } from './sigma.js';
import { normalizeTypescript } from './normalize_typescript.js';

/**
 * Find all injective subgraph isomorphism mappings f: V_c -> V_t.
 * Matches rcf_core.canary.find_subgraph_isomorphisms in Python.
 */
export function findSubgraphIsomorphisms(gC: PDG, gT: PDG): Array<Record<number, number>> {
  const nodesC = gC.nodes;
  const nodesT = gT.nodes;

  if (nodesC.length === 0) {
    return [];
  }

  // Pre-calculate adjacency lists to speed up edge verification
  const adjC: Record<number, Array<{ dst: number; etype: string; dir: 'OUT' | 'IN' }>> = {};
  for (const n of nodesC) {
    adjC[n.nid] = [];
  }
  for (const e of gC.edges) {
    adjC[e.src]?.push({ dst: e.dst, etype: e.etype, dir: 'OUT' });
    adjC[e.dst]?.push({ dst: e.src, etype: e.etype, dir: 'IN' });
  }

  const adjT: Record<number, Array<{ dst: number; etype: string; dir: 'OUT' | 'IN' }>> = {};
  for (const n of nodesT) {
    adjT[n.nid] = [];
  }
  for (const e of gT.edges) {
    adjT[e.src]?.push({ dst: e.dst, etype: e.etype, dir: 'OUT' });
    adjT[e.dst]?.push({ dst: e.src, etype: e.etype, dir: 'IN' });
  }

  const results: Array<Record<number, number>> = [];

  function backtrack(idx: number, mapping: Record<number, number>, usedT: Set<number>) {
    if (idx === nodesC.length) {
      results.push({ ...mapping });
      return;
    }

    const uC = nodesC[idx];

    for (const uT of nodesT) {
      if (usedT.has(uT.nid)) {
        continue;
      }

      // Class must match
      if (uC.cls !== uT.cls) {
        continue;
      }

      // Treat REF.PARAM, REF.LOCAL, REF.GLOBAL as equivalent variable references
      if (uC.cls === 'REF' && ['PARAM', 'LOCAL', 'GLOBAL'].includes(uC.op || '')) {
        if (!['PARAM', 'LOCAL', 'GLOBAL'].includes(uT.op || '')) {
          continue;
        }
      } else {
        if (uC.op !== null && uC.op !== undefined && uC.op !== uT.op) {
          continue;
        }
      }

      // Check structural consistency with all already-mapped nodes
      let consistent = true;
      const neighbors = adjC[uC.nid] || [];
      for (const { dst: neighborC, etype, dir } of neighbors) {
        if (mapping[neighborC] !== undefined) {
          const mappedNeighborT = mapping[neighborC];
          // Verify edge exists in gT in the same direction and of the same type
          let edgeFound = false;
          const tNeighbors = adjT[uT.nid] || [];
          for (const { dst: neighborT, etype: tEtype, dir: tDir } of tNeighbors) {
            if (neighborT === mappedNeighborT && tEtype === etype && tDir === dir) {
              edgeFound = true;
              break;
            }
          }
          if (!edgeFound) {
            consistent = false;
            break;
          }
        }
      }

      if (consistent) {
        mapping[uC.nid] = uT.nid;
        usedT.add(uT.nid);
        backtrack(idx + 1, mapping, usedT);
        usedT.delete(uT.nid);
        delete mapping[uC.nid];
      }
    }
  }

  backtrack(0, {}, new Set());
  return results;
}

export function pdgFromDict(d: any, sigma: Sigma): PDG {
  const g = new PDG(sigma);
  const idMap: Record<number, number> = {};
  for (const nodeData of d.nodes) {
    const oldId = nodeData.id;
    const label = nodeData.label;
    let cls: string;
    let op: string | null = null;
    if (label.includes('.')) {
      const parts = label.split('.');
      cls = parts[0];
      op = parts.slice(1).join('.');
    } else {
      cls = label;
    }
    const newId = g.addNode(cls, op);
    idMap[oldId] = newId;
  }

  for (const edgeData of d.edges) {
    const src = idMap[edgeData.src];
    const dst = idMap[edgeData.dst];
    const etype = edgeData.type;
    g.addEdge(src, dst, etype);
  }

  return g;
}

export class CanaryRecord {
  public name: string;
  public createdAt: string;
  public description: string;
  public pdg: PDG;

  constructor(name: string, createdAt: string, description: string, pdg: PDG) {
    this.name = name;
    this.createdAt = createdAt;
    this.description = description;
    this.pdg = pdg;
  }

  public toDict(): any {
    const pdgDict = this.pdg.toDict();
    return {
      name: this.name,
      created_at: this.createdAt,
      description: this.description,
      sigma_version: pdgDict.sigma_version,
      alphabet_hash: pdgDict.alphabet_hash,
      nodes: pdgDict.nodes,
      edges: pdgDict.edges,
    };
  }

  public static fromDict(d: any, sigma: Sigma): CanaryRecord {
    const pdg = pdgFromDict(d, sigma);
    return new CanaryRecord(
      d.name,
      d.created_at,
      d.description || '',
      pdg
    );
  }
}

export function extractCanaryBlock(fileContent: string): string {
  const lines = fileContent.split('\n');
  const blockLines: string[] = [];
  let inBlock = false;
  for (const line of lines) {
    if (line.includes('[RCF:CANARY_START]')) {
      inBlock = true;
      continue;
    }
    if (line.includes('[RCF:CANARY_END]')) {
      inBlock = false;
      break;
    }
    if (inBlock) {
      blockLines.push(line);
    }
  }

  if (blockLines.length === 0) {
    return '';
  }

  // Wrap in a function definition
  const indented = blockLines.map(line => '    ' + line).join('\n');
  return `function __canary_dummy() {\n${indented}\n}\n`;
}

export class CanaryRegistry {
  public registryPath: string;
  public sigma: Sigma;
  public canaries: Record<string, CanaryRecord>;

  constructor(registryPath: string, sigma: Sigma) {
    if (registryPath.includes('..') || !/^[a-zA-Z0-9_\-\.\/\\ ]+$/.test(registryPath)) {
      throw new Error('Invalid registry path: directory traversal or unsafe characters detected.');
    }
    const cwd = process.cwd();
    const tmp = os.tmpdir();
    
    let isTemp = false;
    let relPath = registryPath;
    
    if (path.isAbsolute(registryPath)) {
      if (registryPath.startsWith(tmp)) {
        isTemp = true;
        relPath = path.relative(tmp, registryPath);
      } else if (registryPath.startsWith(cwd)) {
        relPath = path.relative(cwd, registryPath);
      } else {
        throw new Error('Registry path must be located inside the current working directory or temporary directory.');
      }
    } else {
      isTemp = registryPath.includes('tmp') || registryPath.includes('temp');
    }
    
    // Split and sanitize each component to prevent traversal
    const safeParts = relPath.split(/[/\\]/).map(part => {
      const clean = part.replace(/[^a-zA-Z0-9_\-\.]/g, '');
      if (clean === '..' || clean === '.') {
        return '';
      }
      return clean;
    }).filter(Boolean);

    const baseDir = isTemp ? tmp : cwd;
    this.registryPath = path.resolve(baseDir, ...safeParts);
    this.sigma = sigma;
    this.canaries = {};
    this.load();
  }

  public load(): void {
    if (!existsSync(this.registryPath)) {
      this.canaries = {};
      return;
    }
    try {
      const content = readFileSync(this.registryPath, 'utf-8');
      const data = JSON.parse(content);
      const records = data.canaries || [];
      for (const r of records) {
        if (!timingSafeHashEqual(r.alphabet_hash ?? '', this.sigma.alphabetHash)) {
          console.warn('⚠️ Warning: A canary entry was built with a different alphabet hash. Skipping.');
          continue;
        }
        const record = CanaryRecord.fromDict(r, this.sigma);
        this.canaries[record.name] = record;
      }
    } catch (e: any) {
      throw new SigmaError(`Failed to load canary registry: ${e.message}`);
    }
  }

  public save(): void {
    const payload = {
      canaries: Object.values(this.canaries).map(c => c.toDict())
    };
    const parent = path.dirname(this.registryPath);
    mkdirSync(parent, { recursive: true });
    writeFileSync(this.registryPath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  public register(name: string, sourceCode: string, description = ''): void {
    let source = sourceCode;
    if (!source.trim().startsWith('function ')) {
      const indented = source.split('\n').map(line => '    ' + line).join('\n');
      source = `function __canary_dummy() {\n${indented}\n}\n`;
    }
    const pdg = normalizeTypescript(source, this.sigma);
    if (pdg.nodes.length === 0) {
      throw new Error('Parsed canary source yielded an empty PDG.');
    }

    const record = new CanaryRecord(
      name,
      new Date().toISOString(),
      description,
      pdg
    );
    this.canaries[name] = record;
    this.save();
  }
}
