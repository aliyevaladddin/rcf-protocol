<!-- NOTICE: This file is protected under RCF-PL -->
<!-- [RCF:PROTECTED] -->
# RCF-CORRELATION — The Mathematical Core of Restricted Correlation

**Status:** Active Specification — theoretical core defined; §4–§6 implemented in `rcf_core` (Python engine) and cross-language lowering (TypeScript, Rust, Go via tree-sitter) implemented in `sdk/typescript`
**Document Type:** Mathematical Specification
**Generation:** RCF v3 (the correlation core; not a release number)
**Author:** Aladdin Aliyev

---

## 0. Why This Document Exists

Through RCF v1–v2 the protocol protected *bytes*: file markers (`[RCF:PROTECTED]`)
and SHA-256 audit manifests. Both defenses share one blind spot, and it is the
blind spot that matters most in the age of large language models:

> **The real threat is not that an AI copies the code. It is that an AI trains on
> a unique codebase, learns the *method*, and re-emits the same method in another
> language — with not a single original token surviving.**

A SHA-256 hash sees nothing. A marker comment is stripped on the first translation.
Token-level similarity is zero. Yet the intellectual property — the *methodology* —
has been replicated completely.

RCF v3 makes the protocol's middle name literal. It defines **correlation** as a
measurable, language-invariant quantity, and turns "this looks similar" into
**"independent origin is statistically excluded."** This document fixes that
mathematics. It is normative for the *definitions* and the *invariants*; the
reference implementation lives in `rcf_core/` (Python) and `sdk/typescript/src/core/`. §4 (surprisal corpus +
measure), §5 (p-value / E-value), §6 (canary engine), and cross-language lowering for TypeScript,
Rust, and Go (via tree-sitter) are fully implemented.

---

## 1. The Object of Protection — What Survives Translation

### 1.1 The translation-invariance question

Any defense must answer one question: **what survives when code is translated from
one language to another?**

| Representation | Survives translation? | Why |
|----------------|:---:|-----|
| Source tokens / SHA-256 | ❌ | Entirely rewritten |
| Comments / markers | ❌ | Stripped or rewritten first |
| AST (syntax tree) | ❌ | Syntax is language-specific |
| CFG (control flow) | ⚠️ partial | Survives, but refactoring-fragile |
| **PDG (dependence graph)** | ✅ | **Semantic, not syntactic** |
| Behavior (I/O mapping) | ✅ | Invariant by definition |

The winner is the **Program Dependence Graph (PDG)**. An edge "value `X` flows into
operation `Y`" is *semantic*: when an AI translates Python → Rust, it **must**
preserve which value feeds which operation, or the program is wrong. Names, syntax,
and tokens change freely; the topology of data and control dependence does not,
because the *task itself* dictates it.

### 1.2 Formal object

A code unit is reduced to a labeled directed graph:

```
G = (V, E, ℓ)
```

- `V` — operations and values (nodes).
- `E ⊆ V × V` — data- and control-dependence edges.
- `ℓ : V → Σ` — a **semantic label** from a language-independent alphabet `Σ`
  (e.g. `ARITH`, `COMPARE`, `MEMORY`, `CALL`, `BRANCH`, `CONST`).

**Identifiers are discarded.** What remains is structure + semantics. This `G` is
the canonical object on which all of RCF v3 operates. The pipeline that produces it:

```
source ──parse──► language-specific AST ──lower──► semantic IR ──build──► PDG (G)
   (tree-sitter)                         (Σ-labeled)
```

The `lower` stage — one normalizer per supported language into a shared `Σ`-labeled
IR — is the principal engineering cost of RCF v3 (see §8).

---

## 2. The Correlation Problem, Stated

Given two code units `A`, `B` reduced to `G_A`, `G_B`, define a function

```
corr(G_A, G_B) ∈ [0, 1]
```

required to be:

1. **Invariant** to identifier renaming, target language, and minor refactoring.
2. **Sensitive** to *idiosyncrasy* — the author's arbitrary, non-functional choices.

Exact graph isomorphism is NP-hard, but we do not need it. We need a fast,
rename-invariant *kernel* over graphs, re-weighted by a measure of origin. The next
sections build it from three bricks, then the v3 contribution that fuses them.

---

## 3. Three Bricks (with honest limits)

### 3.1 Weisfeiler–Lehman graph kernel — the workhorse

Iteratively relabel each node by a hash of `(its label, sorted multiset of neighbor
labels)`, repeated `k` times; then compare label-frequency histograms:

```
k_WL(G_A, G_B) = Σ_{i=0..k}  ⟨ φ_i(G_A), φ_i(G_B) ⟩
```

where `φ_i` is the WL-label frequency vector at iteration `i`.

- ✅ Rename-invariant (operates on labels, not IDs); captures local structure of
  radius `k`; computable in `O(k · |E|)`.
- ⚠️ Large `k` → global → refactoring-fragile; small `k` → local → robust but
  near-sighted. `k` is a calibration knob, not a constant.

### 3.2 Laplacian spectrum — permutation-invariant baseline

With `L = D − A` (degree minus adjacency), the eigenvalues
`λ₁ ≤ … ≤ λ_n` are **permutation-invariant by construction**:

```
d_spec(G_A, G_B) = ‖ λ(G_A) − λ(G_B) ‖₂
```

Use the *normalized* Laplacian `ℒ = I − D^{−1/2} A D^{−1/2}` so the spectrum lies in
`[0, 2]` and is comparable across graph sizes.

- ✅ Fully language-invariant; cheap.
- ⚠️ *Cospectral* graphs (different, same spectrum) cause false matches; size-sensitive.
  **Use only as a pre-filter, never as sole evidence.**

### 3.3 Behavioral signature — an orthogonal axis

For a function `f`, fix a canonical probe set `X`; the signature is a hash of the
mapping `{ x ↦ f(x) }`.

- ✅ Language-invariant *by definition*.
- ⚠️ Proves "same function", not "same origin" — two honest authors converge here.

Bricks §3.1–§3.3 are essentially the known field of cross-language clone detection.
They measure **similarity**. The v3 contribution turns similarity into **origin**.

---

## 4. The RCF Contribution — Surprisal-Weighted Correlation

### 4.1 The core idea

Separate any methodology into two layers:

- **Functional core** — what *anyone* solving the task converges to. Protecting it is
  meaningless; an independent implementation reproduces it.
- **Idiosyncratic layer** — the author's arbitrary choices, which exist *for no reason
  other than that the author chose them*: an unusual constant, a specific ordering of
  steps, a peculiar edge-case handling, a non-obvious module split.

The decisive principle:

> **An independent, honest implementation will NOT reproduce your arbitrary choices.**
> Two people solving a task from scratch converge in the core and diverge in the
> idiosyncrasy. So if your *functionally-unnecessary* choice appears in someone else's
> Rust — it is not coincidence, it is **evidence the source is you.**

Idiosyncrasy passes through language translation because it is **semantic, not
syntactic**: the AI learned the *solution*, and your fingerprints are baked into it.

### 4.2 The weight — surprisal

For each substructure (WL feature) `f`, let `P_nat(f)` be the probability that an
*independent* implementation produces `f`, estimated over a large reference corpus.
The idiosyncrasy weight is the **self-information (surprisal)**:

```
w(f) = − log P_nat(f)
```

- A banal pattern (sum-a-list loop) → `P_nat` high → `w ≈ 0`.
- A strange specific choice → `P_nat` tiny → `w` large.

This is **TF-IDF for code graphs**, where "IDF" is the *improbability of independent
re-invention*.

### 4.3 The correlation formula

```
                Σ_f  w(f) · [f ∈ A] · [f ∈ B]
corr(A, B) = ───────────────────────────────────────────────
              √(Σ_f w(f)[f∈A]²) · √(Σ_f w(f)[f∈B]²)
```

A surprisal-weighted cosine over WL features of the PDG. Match on the banal → ~0.
Match on the rare → evidence. **This is literally the "Restricted *Correlation*
Framework" — mathematics, not marketing.**

---

## 5. From a Score to Court-Grade Proof — p-value / E-value

A single score `s` means nothing without a null of comparison. Build the
**null distribution** of `corr` over provably independent pairs drawn from the corpus,
then report:

```
p-value = Pr[ corr ≥ s | independent ]
```

If `p < 10⁻⁹`, this is not coincidence — the source is shared.

This is exactly what **BLAST** does in bioinformatics: it reports an *E-value* for a
DNA match — "this sequence did not arise by chance." RCF v3 does the same for code.
This — not "87% similar" — is what the RCF audit delivers:

> **"E-value = 10⁻⁹. Independent origin is statistically excluded."**

That is the legally durable claim.

**Implemented (`rcf_core/proof.py`).** `build_null` draws the null distribution
of `corr` over distinct corpus-unit pairs (seeded, reproducible); `prove` /
`evaluate` report the score against it. Honesty is built in: the *empirical*
p-value has a hard resolution floor of `1/(K+1)` and cannot reach `10⁻⁹` at any
realistic `K`, so the headline rides a *parametric* normal-tail model that is
always labeled `MODEL EXTRAPOLATION`, with the empirical p and its floor reported
beside it — never collapsed into one unlabeled number. The null is built from
Python units, so it judges independence *within Python* (first ring); a
cross-language null is a later ring over the same interface.

---

## 6. Methodology Canary — Designed Evidence

> **Implementation status:** the designed canary mechanism of this section is
> implemented in `rcf_core` (`canary.py`), using subgraph isomorphism detection
> over query PDGs. The **natural sentinel** (`sentinel.py`) is also implemented
> as described in §6.4. See §7 status table.

Surprisal (§4) exploits idiosyncrasy that *already exists* in the protected work.
A **canary** *injects* it deliberately: a functionally-neutral, arbitrary choice
planted in the codebase before publication — a specific constant, a redundant
intermediate step, a unique edge-case branch. If that exact idiosyncrasy surfaces
in a third party's implementation in any language, its presence is a
**near-zero-false-positive signal**, because an honest independent author has no
reason to reproduce it.

Among all signals in the RCF v3 stack, the canary is the **cleanest for legal
use**: its false-positive rate approaches zero by construction, whereas behavioral
equivalence (§3.3) false-positives on convergent solutions and surprisal (§4)
still leaves a residual coincidence probability.

### 6.1 Design Constraints

A valid canary must satisfy three constraints simultaneously:

1. **Functionally neutral** — no observable behavior changes on any input.
   Removing the canary must not break, slow, or alter any test.
2. **Semantic, not textual** — the canary must survive translation into another
   language. As §1.1 establishes, only PDG topology and semantic labels survive
   translation; token-level choices (variable names, comments, whitespace) are
   rewritten immediately. A canary embedded only in naming is useless.
3. **Low `P_nat(f)`, high plausibility** — arbitrary enough that independent
   reimplementation is implausible (`w(f)` large), but natural-looking enough that
   it is not removed during code review as dead code or refactored away by
   an optimizer.

### 6.2 Implementation Techniques

The following techniques produce canaries that satisfy all three constraints and
are detectable via the PDG / WL-kernel pipeline of §3–§4.

**Technique 1 — Redundant intermediate step**

Instead of a direct operation, introduce a semantically equivalent but
structurally distinct path:

```python
# Direct (no canary):
x ^= mask

# Canary variant — identical result, extra PDG node + edge:
tmp = x ^ CANARY_A
x   = tmp ^ (CANARY_A ^ mask)   # CANARY_A cancels; result is x ^ mask
```

The constant `CANARY_A` appears in two nodes; the intermediate `tmp` creates a
data-dependence edge that is absent in any direct implementation. WL iteration
*k=1* captures this extra local structure.

**Technique 2 — Non-trivial commutative ordering**

When steps `a`, `b`, `c` are mutually independent and any order yields the same
result, choose a statistically rare permutation:

```python
# Natural order (high P_nat): a → b → c
# Canary order (low P_nat):   c → a → b
```

This changes the topological sort of the PDG without altering the data-dependence
graph or observable output. WL captures the ordering through the relative
iterations of neighbor labels.

**Technique 3 — Redundant edge-case branch**

Add a branch for an input that is structurally reachable but provably never
occurs in this function's call context — and whose handler is the identity:

```python
if value == CANARY_SENTINEL:   # unreachable in practice
    return value               # identity — no effect
# ... normal logic ...
```

This inserts a `BRANCH` node and a `CONST` node into the PDG. Both survive
translation because they are semantic. The specific sentinel value is recorded
in the private registry (§6.3) as part of the canary specification.

**Technique 4 — Structurally redundant decomposition**

Split one computation into two in a non-obvious, non-standard way:

```python
# Standard bit-fold (high P_nat):
result = x & 0xFFFF

# Canary decomposition (low P_nat):
high  = (x >> 8) & 0xFF
low   = x & 0xFF
result = (high << 8) | low     # identical; unusual grouping
```

The extra nodes and edges in the PDG are not produced by any straightforward
implementation of the same operation.

### 6.3 Operational Requirements

A canary is legally useful only if the following conditions hold:

1. **Private canary registry (pre-publication)**
   Before publishing the protected code, record each canary in a private,
   timestamped document (not in the public repository): date, file, location,
   technique used, specific constants/values, and a hash of the surrounding
   context. Without this record, the canary is an anomaly, not evidence of
   priority.

2. **Survive optimization and refactoring**
   Verify that no linter, compiler, or formatter removes the canary as dead
   code. If a CI pass eliminates it, it provides no protection. Techniques 1
   and 4 are more vulnerable here than Techniques 2 and 3.

3. **Multiple independent canaries**
   A single matching canary can be attributed to coincidence. Three or more
   independent canaries (different files, different techniques) matching
   simultaneously constitute evidence that is statistically irrefutable under
   the E-value framework of §5. Plant canaries at the module level, not only
   at the function level.

### 6.4 Natural Sentinels — Implemented, and Why They Are Weaker

A **designed canary** (§6.1–§6.3) must be *authored*: an arbitrary,
functionally-neutral choice planted on purpose. A cheaper relative is available
for free from the §4 machinery, and is implemented in `rcf_core/sentinel.py`:
rank a project's existing protected functions by surprisal mass
(`measure_project`) and watch the heaviest. No new code is written — you simply
select the functions that *already* stand out (e.g. a hand-rolled bit-mixer).

This is **not** a designed canary, and the tool says so. The distinction is
load-bearing:

| | Designed canary (§6.1–§6.3) | Natural sentinel (§6.4) |
|---|---|---|
| Origin | authored, functionally **neutral** | a real, load-bearing function |
| Convergence | immune — no reason to reproduce | **vulnerable** — an independent author can converge on a similar shape |
| Proof strength | near-zero false-positive ("impossible by chance") | a lead, not a verdict ("unlikely by chance") |
| Cost | must be planted | free — pick from what exists |
| Over-time stability | stable — useless code never appears naturally | **decays silently** — surprisal is corpus-relative; if the pattern spreads (a future stdlib, a popular library), the sentinel ages out without warning |

Because of the decay risk, `sentinel.py` never freezes its list: it re-measures
live on every run, and its banner instructs re-running before each audit. A
sentinel hit is a reason to run §5 (`proof.py`) against the suspect, not a
finding on its own. The designed canary of §6.1–§6.3 (`canary.py`) is the instrument for
the legally decisive, convergence-proof claim.

---

## 7. The v3 Core, Synthesized

```
RCF v3  =   surprisal-weighted WL-kernel        (origin)
            ───────over───────
            PDG                                  (language-invariant)
            + p-value / E-value                  (proof)
            + methodology canary                 (designed evidence)
```

| Component | Role | Status of art | In `rcf_core` |
|-----------|------|---------------|---------------|
| **PDG** | survives language translation | known | ✅ Python (`normalize_python`), TS, Rust, Go (`sdk/typescript` via tree-sitter) |
| **WL-kernel** | computable, rename-invariant similarity | known | ✅ `wl.py` |
| **surprisal weight** | turns similarity into *origin* | **RCF contribution** | ✅ `corpus.py` + `measure.py` |
| **p-value / E-value** | turns score into court-grade proof | known (BLAST analogy) | ✅ `proof.py` |
| **methodology canary** | near-zero-false-positive designed evidence | **RCF contribution** | ✅ `canary.py` (designed canary via subgraph isomorphism) + `sentinel.py` (natural signatures) |

---

## 8. Honest Limits — What Is Hard

This section is normative: RCF must not overclaim.

1. **Cross-language PDG needs a normalizer per language.** `parse (tree-sitter) →
   shared semantic IR → PDG`. This is the core engineering effort. Without it,
   language-invariance does not hold.
2. **`P_nat(f)` needs a corpus.** Proof quality equals corpus quality. A small or
   biased corpus yields weak surprisal weights.
3. **Robustness vs. sensitivity is a genuine tension.** It lives in the choice of `k`
   and feature granularity. This is real research, not a weekend's work.
4. **RCF cannot prevent an AI from learning.** This is physically impossible at the
   license layer. RCF v3 is a layer of **detection, proof, and deterrence** — not DRM.
   The proof *is* the market value.
5. **Behavioral equivalence false-positives on convergent solutions.** Prefer the
   canary mechanism (§6, implemented in `canary.py`) for legal claims — its false-positive
   rate approaches zero by construction. Treat §3.3 as corroborating evidence only, not as standalone proof.

---

## 9. Glossary

| Term | Meaning |
|------|---------|
| **PDG** | Program Dependence Graph — nodes are operations/values, edges are data/control dependence |
| **Σ (semantic alphabet)** | language-independent node labels (`ARITH`, `CALL`, `BRANCH`, …) |
| **WL feature `f`** | a Weisfeiler–Lehman subtree label; a local structural fingerprint |
| **`P_nat(f)`** | probability an independent implementation produces `f` |
| **surprisal `w(f)`** | `−log P_nat(f)`; weight of idiosyncrasy |
| **`corr(A,B)`** | surprisal-weighted cosine over PDG WL features |
| **E-value / p-value** | probability the observed `corr` arises under independent origin |
| **canary** | injected, functionally-neutral idiosyncratic choice used as designed evidence |

---

## 10. References

- `RCF-SPEC.md` — protocol specification (markers, compliance)
- `RCF-CORE.md` — conceptual overview
- `RCF-ENFORCEMENT.md` — enforcement mechanisms
- `../WHITE_PAPER.md` — research framing
- External: Weisfeiler–Lehman graph kernels; spectral graph theory (normalized
  Laplacian); program dependence graphs (Ferrante, Ottenstein, Warren); BLAST
  E-value statistics (Altschul et al.) as the proof-of-origin analogue.

---

**Document Control:**
- Status: Active Specification — theoretical core fixed; §4–§6 implemented in `rcf_core` (Python) and `sdk/typescript` (TS, Rust, Go)
- Generation: RCF v3 (correlation core)
- Scope: Normative for definitions and invariants; non-normative for implementation

**© 2026 Aladdin Aliyev**
**All rights reserved under RCF Protocol License**
