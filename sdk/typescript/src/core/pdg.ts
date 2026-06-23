// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

import { Sigma, SigmaError } from './sigma.js';

export class PdgNode {
  constructor(
    public readonly nid: number,
    public readonly cls: string,
    public readonly op: string | null = null
  ) {}

  public get label(): string {
    return this.op === null ? this.cls : `${this.cls}.${this.op}`;
  }
}

export class PdgEdge {
  constructor(
    public readonly src: number,
    public readonly dst: number,
    public readonly etype: string // DATA | CTRL | ORDER
  ) {}
}

export class PDG {
  private readonly _nodes = new Map<number, PdgNode>();
  private readonly _edges: PdgEdge[] = [];
  private _nextId = 0;

  constructor(public readonly sigma: Sigma) {}

  public addNode(cls: string, op: string | null = null): number {
    this.sigma.requireLabel(cls, op || undefined);
    const nid = this._nextId++;
    this._nodes.set(nid, new PdgNode(nid, cls, op));
    return nid;
  }

  public addEdge(src: number, dst: number, etype = 'DATA'): void {
    if (!this.sigma.isEdge(etype)) {
      throw new SigmaError(`edge type not in Σ ${this.sigma.version}: ${etype}`);
    }
    if (!this._nodes.has(src) || !this._nodes.has(dst)) {
      throw new Error(`edge endpoint missing: ${src}->${dst}`);
    }
    this._edges.push(new PdgEdge(src, dst, etype));
  }

  public get nodes(): PdgNode[] {
    return Array.from(this._nodes.values());
  }

  public get edges(): PdgEdge[] {
    return [...this._edges];
  }

  public node(nid: number): PdgNode {
    const n = this._nodes.get(nid);
    if (!n) {
      throw new Error(`Node not found: ${nid}`);
    }
    return n;
  }

  public get length(): number {
    return this._nodes.size;
  }

  /**
   * Typed, directed neighborhood of `nid` for WL aggregation.
   * Returns tuple list of [direction, edge_type, other_id].
   */
  public neighbors(nid: number): [string, string, number][] {
    const out: [string, string, number][] = [];
    for (const e of this._edges) {
      if (e.src === nid) {
        out.push(['OUT', e.etype, e.dst]);
      } else if (e.dst === nid) {
        out.push(['IN', e.etype, e.src]);
      }
    }
    return out;
  }

  public toDict(): Record<string, any> {
    return {
      sigma_version: this.sigma.version,
      alphabet_hash: this.sigma.alphabetHash,
      nodes: this.nodes.map((n) => ({ id: n.nid, label: n.label })),
      edges: this._edges.map((e) => ({ src: e.src, dst: e.dst, type: e.etype }))
    };
  }

  public labelMultiset(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const n of this._nodes.values()) {
      counts[n.label] = (counts[n.label] || 0) + 1;
    }
    return counts;
  }
}
