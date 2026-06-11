<!-- NOTICE: This file is protected under RCF-PL -->
<!-- [RCF:PROTECTED] -->
# RCF-SIGMA — The Semantic Alphabet Σ

**Status:** Research / Draft — contract fixed, normalizers in progress
**Document Type:** Normative Specification
**Version of Σ:** see `sigma_version` in [`sigma.json`](sigma.json) — the single source of truth
**Machine-readable source of truth:** [`sigma.json`](sigma.json)
**Author:** Aladdin Aliyev

---

## 0. Role of This Document

[`RCF-CORRELATION.md`](RCF-CORRELATION.md) defines the PDG node label as
`ℓ : V → Σ` over a *language-independent alphabet* `Σ`. This document **fixes Σ**.

Σ is the contract every language normalizer must speak. If two normalizers label the
same operation differently, their PDGs diverge, every fingerprint diverges, and the
surprisal corpus becomes meaningless — the exact failure we already observed when the
Python and TypeScript SDK heuristics drifted apart. Σ exists to make that drift
**impossible by construction**.

The machine-readable [`sigma.json`](sigma.json) is the **source of truth**. This file
is its human-readable rationale. If the two ever disagree, `sigma.json` wins.

---

## 1. Design — Two-Level Labels

Each PDG node carries a two-part label:

```
ℓ(v) = (class, op)
```

- **`class`** — a coarse category (~14 of them): `ARITH`, `CMP`, `CALL`, `BRANCH`, …
  This is the **robust** signal. It survives refactoring.
- **`op`** — a refinement: `ARITH.MUL`, `CMP.LT`, … This is the **sensitive** signal.
  It carries idiosyncrasy.

The Weisfeiler–Lehman kernel (`RCF-CORRELATION.md` §3.1) runs at either level:

| WL granularity | Behavior |
|----------------|----------|
| `class` only | robust, refactoring-tolerant, near-sighted |
| `class.op` | sensitive, idiosyncrasy-bearing |

This makes the robustness ↔ sensitivity tension (`RCF-CORRELATION.md` §8.3) a **tuning
knob over the same Σ**, not a reason to ever redefine Σ.

---

## 2. The Three Hard Principles

1. **Identifiers are NOT in Σ.** Names are discarded — consistent with the PDG object
   in `RCF-CORRELATION.md` §1.2. `total`, `sum`, `acc` collapse to `REF.LOCAL`.

2. **Concrete types are NOT in Σ.** `int` vs `float` vs `i64` is a language /
   implementation detail, not methodology. Encoding types would make Σ
   language-dependent and defeat translation-invariance.

3. **Σ is closed and versioned, and its version tracks the protocol.** Adding a label
   is a **breaking change**: it shifts every WL feature and invalidates the surprisal
   corpus `P_nat(f)`. `sigma_version` mirrors the RCF protocol version,
   so a fingerprint is bound to a protocol release. Therefore `sigma_version` is part
   of every fingerprint and every audit record, and normalizers MUST refuse to compare
   graphs built under different `sigma_version` values. A consequence to accept openly:
   a protocol release that bumps `sigma_version` requires the surprisal corpus to be
   re-built and prior fingerprints to be re-audited under the new version (see §7).

---

## 3. The Node Alphabet

Normative set; see [`sigma.json`](sigma.json) for the canonical machine form.

| class | ops | role |
|-------|-----|------|
| `CONST` | NUM, STR, BOOL, NULL, COLL | literal constants |
| `REF` | PARAM, LOCAL, GLOBAL, FIELD, INDEX | references to values |
| `ASSIGN` | BIND, UPDATE | binding a value to a slot |
| `ARITH` | ADD, SUB, MUL, DIV, FLOORDIV, MOD, POW, NEG | arithmetic |
| `BIT` | AND, OR, XOR, NOT, SHL, SHR | bitwise |
| `CMP` | EQ, NE, LT, LE, GT, GE, IS, IN | comparisons |
| `LOGIC` | AND, OR, NOT | boolean (short-circuit) |
| `BRANCH` | IF, SWITCH, TERNARY, GUARD | control-flow branching |
| `LOOP` | FOR, WHILE, ITER, COMPREH | iteration |
| `CALL` | FUNC, METHOD, CONSTRUCT, BUILTIN | invocations |
| `RET` | RETURN, YIELD, RAISE, BREAK, CONTINUE | exit / interruption |
| `AGG` | LIST, MAP, SET, TUPLE, RECORD | collection construction |
| `CAST` | CONVERT | type conversion |
| `EFFECT` | EXTERN | external effect (I/O) — coarse by design |

**Note on `EFFECT.EXTERN`:** I/O is deliberately left coarse. The *fact* that a unit
touches the outside world is methodology-relevant; *which* syscall is an
implementation detail and stays out of Σ.

---

## 4. The Edge Alphabet

The PDG is a **typed** graph. Edges carry one of:

| type | meaning | normative |
|------|---------|:---------:|
| `DATA` | data dependence (def-use): a value flows into an operation | ✅ |
| `CTRL` | control dependence: the node's execution is guarded by the source | ✅ |
| `ORDER` | weak sequential ordering | ⚠️ optional, off by default |

`DATA` and `CTRL` are the load-bearing edges and are required. `ORDER` is
refactoring-fragile (reordering independent statements changes it) and is **off by
default**; it may be enabled for stricter, higher-false-positive comparison only.

---

## 5. Normalizer Contract

Every language normalizer (Python, TypeScript, C, Rust, …) MUST:

1. Emit node labels drawn **only** from the Σ in `sigma.json` at the declared
   `sigma_version`.
2. Discard all identifiers and concrete types before labeling.
3. Map each construct to the **most specific** matching `op`; if no `op` fits, use the
   `class` alone (never invent an `op`).
4. Emit only `DATA` / `CTRL` edges by default; `ORDER` only when explicitly enabled.
5. Stamp output with `sigma_version`. Comparison across versions is forbidden (§2.3).

A construct that genuinely has no home in Σ is a signal that Σ may need a **versioned**
extension — it is never a license to extend Σ ad hoc inside a single normalizer.

---

## 6. Worked Example

Consider, conceptually, `result = a * 2` inside a loop over `data`:

```
LOOP.FOR ──CTRL──► ASSIGN.BIND
                       │
                       ├──DATA── REF.LOCAL   (a)
                       └──DATA── ARITH.MUL ──DATA── CONST.NUM  (2)
```

Translate this to Rust, Go, or TypeScript: names change, syntax changes, the literal
`2` may render differently — but the labeled topology
`LOOP.FOR → ASSIGN → {REF, ARITH.MUL → CONST.NUM}` is **identical**. That invariance
is precisely what Σ is engineered to preserve, and what `corr` (`RCF-CORRELATION.md`
§4.3) measures over.

---

## 7. Versioning Policy

`sigma_version` **mirrors the RCF protocol version** — Σ ships and versions with the
protocol, not on an independent track. The table below classifies the *nature* of an Σ
change so the release that carries it can pick the right protocol bump and the right
downstream action:

| Σ change | Protocol bump it should ride | Effect on fingerprints |
|----------|:---:|--------|
| Fix wording / docs only | PATCH | none — alphabet unchanged, fingerprints stay comparable* |
| Add `op` to existing class | MINOR | corpus re-build; old fingerprints incomparable |
| Add/remove a `class`, change edge semantics | MAJOR | full re-audit required |

\* Because `sigma_version` equals the protocol version, even a docs-only PATCH release
changes the stamped `sigma_version`. Normalizers SHOULD treat fingerprints as
comparable when the **node/edge alphabet is byte-identical** across two `sigma_version`
values, even if the version string differs — i.e. the *alphabet hash*, not the version
string, is the true comparability key. The version string remains the audit-record
identifier. This keeps PATCH releases from needlessly invalidating a corpus while
preserving the rule in §2.3 for any release that actually alters Σ.

---

## 8. References

- [`RCF-CORRELATION.md`](RCF-CORRELATION.md) — the mathematical core that consumes Σ
- [`sigma.json`](sigma.json) — machine-readable source of truth
- `RCF-SPEC.md` — protocol specification

---

**Document Control:**
- Status: Research / Draft — contract fixed; language normalizers in progress
- Σ version: tracked in `sigma.json` (`sigma_version`) — never duplicated here
- Source of truth: `sigma.json` (this document is its rationale)

**© 2026 Aladdin Aliyev**
**All rights reserved under RCF Protocol License**
