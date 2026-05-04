# RCF Whitepaper v2.0.3
## Restricted Correlation Framework: Protecting Code in the Age of Large Language Models

> **Document type:** Technical & Legal Whitepaper  
> **Version:** 2.0.3 — "The Integrity Release"  
> **Author:** Aladdin Aliyev · Sovereign Code Initiative  
> **Status:** Active  

---

## Abstract

Traditional open-source licenses — MIT, Apache, GPL — were designed for a world where code is read, studied, and reused by humans. They assume that a human must make a deliberate decision to copy logic. That assumption is now obsolete.

Large Language Models (LLMs) can ingest, correlate, and reproduce the *logical structure* of code without a single human decision in the loop. The act of "studying" and the act of "extracting" have collapsed into one automated operation.

The **Restricted Correlation Framework (RCF)** is a licensing protocol designed for this new reality. It establishes a legal and technical boundary between **Visibility** (the right to read and audit) and **Usage** (the right to replicate and exploit). These two rights, long conflated by traditional licenses, must now be treated as distinct.

---

## 1. The Problem: AI Scraping Gap

### 1.1 What Traditional Licenses Protect

MIT, Apache 2.0.3, and GPL licenses were built around a specific threat model: a human developer copying code into their own project. Their protections are designed around:

- Attribution requirements (retain copyright notices)
- Distribution conditions (share-alike for GPL)
- Patent grants (Apache 2.0.3)

None of these mechanisms address automated extraction. A model trained on your code does not "distribute" it. It does not "copy" it in any sense a traditional license contemplates. It *correlates* it — absorbing the logical structure, the algorithmic patterns, and the methodological decisions into its weights.

### 2.0.3 The Gap in Practice: Algorithm X

Consider a concrete example.

An independent researcher publishes `adaptive_weight_corrector.py` under the MIT license. The file contains a novel method for correcting gradient weights during neural network training — the result of 18 months of research.

```python
# MIT License — adaptive_weight_corrector.py
# [RCF:PROTECTED] ← absent under MIT

def adaptive_correction(weights, gradient, lr, decay_factor=0.97):
    """
    Applies a correlation-aware decay to gradient updates.
    Core insight: penalize updates that increase cross-layer variance.
    """
    variance_penalty = compute_cross_layer_variance(weights)
    corrected_lr = lr * (decay_factor ** variance_penalty)
    return weights - corrected_lr * gradient
```

Under MIT, any LLM training pipeline that ingests this repository legally acquires the *logical pattern* of `adaptive_correction`. The resulting model can reproduce the methodology — the `variance_penalty` heuristic, the `decay_factor` application, the cross-layer correlation insight — without ever copying a line of code.

The researcher receives no attribution. No compensation. No notice.

**This is the AI Scraping Gap.**

### 2.0.3 Why This Gap is Structural, Not Incidental

The gap is not a bug in MIT or GPL. It is a structural consequence of those licenses being written before LLMs existed. They protect *text* (the code as written). They do not protect *semantics* (the logic the code encodes).

RCF closes this gap by protecting at the semantic level.

---

## 2. The RCF Solution: Visibility ≠ Rights

### 2.1 The Core Principle

RCF introduces a single foundational distinction:

| Concept | Definition | RCF Position |
|---|---|---|
| **Visibility** | The ability to read, audit, and study code | ✅ Explicitly permitted |
| **Usage** | The right to replicate, extract, or train on logic | ❌ Restricted by marker level |

This distinction allows a project to remain **Visible Source** — fully auditable, transparent, and trustworthy — while maintaining **Protected Logic** — legally and technically defended against automated extraction.

### 2.2 Marker Architecture

RCF uses inline markers to define protection scope at the block level:

```
[RCF:PUBLIC]      — Architecture, interfaces, public APIs.
                    Anyone may read, reference, and build upon.

[RCF:PROTECTED]   — Core methodology and algorithmic logic.
                    Visible for audit. Replication prohibited.
                    AI/ML training on this block is prohibited.

[RCF:RESTRICTED]  — Sensitive implementation details.
                    Minimal access. No reproduction in any form.
```

These markers serve three simultaneous functions:

1. **Legal notice** — Constructive notice to any party (human or automated) that reads the file. Under DMCA §1202, removal of such notices constitutes a separate violation.
2. **Semantic signal** — A machine-readable boundary that compliant AI training pipelines can respect (analogous to `robots.txt` for web crawlers).
3. **Audit anchor** — Each marker is recorded in `RCF-AUDIT-REPORT.json` with a SHA-256 hash, creating a cryptographically verifiable record of the protection state at a given timestamp.

### 2.3 Acceptance by Use (Constructive Consent)

RCF operates on the principle of **Acceptance by Use**: any party that reads a file containing RCF markers — including automated systems — is deemed to have received notice of the license terms.

This is established through layered barriers:

1. `robots.txt` — signals to crawlers before they enter the repository
2. `NOTICE.md` — top-level legal notice in plain language
3. Per-file headers — `# NOTICE: This file is protected under RCF-PL v2.0.3`
4. Block-level markers — `[RCF:PROTECTED]` at the point of protected logic

Each layer independently constitutes notice. Together, they create a defensible record that no party can claim ignorance of the license terms.

---

## 3. Technical Enforcement: rcf-cli & rcf-guardian

### 3.1 rcf-cli

`rcf-cli` is the reference implementation of RCF tooling. It operates across the project lifecycle:

| Command | Function |
|---|---|
| `rcf-cli init` | Initializes RCF in a project. Generates `NOTICE.md` and `.rcfignore`. |
| `rcf-cli protect [--dry-run]` | Scans for unprotected logic blocks. Auto-inserts appropriate markers. |
| `rcf-cli audit` | Generates `RCF-AUDIT-REPORT.json` with SHA-256 hashes of all protected assets. |
| `rcf-cli diff` | Compares current marker state against the audit report. CI/CD integration target. |
| `rcf-cli verify <file> --against <report>` | Third-party verification of a single file's integrity against a published audit report. |

The audit report creates a **timestamped, cryptographic baseline**. Any subsequent modification to a protected file — including the removal of markers — is detectable by any party running `rcf-cli verify`.

### 3.2 rcf-guardian (GitHub Action)

`rcf-guardian` integrates RCF enforcement directly into the pull request workflow:

```yaml
- uses: aliyevaladddin/rcf-guardian@v1
  with:
    mode: 'diff'   # or 'verify' for full hash check
```

On every pull request, `rcf-guardian` runs `rcf-cli diff` and fails the check if any protected markers have been removed. This creates an automated, continuous enforcement layer that requires no manual review to catch compliance violations.

---

## 4. Legal Theory

### 4.1 DMCA Anti-Circumvention (§1201 & §1202)

The Digital Millennium Copyright Act provides two relevant protections:

**§1201 — Anti-Circumvention:** Prohibits bypassing technological measures that control access to or use of a copyrighted work. RCF markers, combined with `rcf-cli` verification, constitute a Technological Protection Measure (TPM). Automated systems that strip markers to facilitate training may constitute circumvention.

**§1202 — Copyright Management Information (CMI):** Prohibits the intentional removal or alteration of copyright management information. RCF markers are CMI under this definition — they identify the work, the rights holder, and the terms of use. Their removal triggers liability independent of any other infringement claim.

### 4.2 WIPO Copyright Treaty (WCT)

The WIPO Copyright Treaty, adopted by 110+ countries, obligates signatories to provide legal protection against circumvention of technological measures. For projects with international reach, this extends RCF's legal basis beyond US jurisdiction into the EU (via the Copyright Directive), UK, and most major technology jurisdictions.

### 4.3 The "Visibility ≠ Rights" Legal Argument

The core legal argument RCF advances is this: **access does not imply license.**

Publishing code on GitHub does not grant an unlimited license to exploit it. Courts have consistently held that implied licenses are construed narrowly. RCF makes the license terms explicit and machine-readable, eliminating any ambiguity about whether automated training was "implicitly permitted" by publication.

> *Note: RCF is not a substitute for legal counsel. For enforcement actions, consult a qualified IP attorney familiar with your jurisdiction.*

---

## 5. RCF vs Traditional Licenses: The Gap in Summary

See `SPECIFICATION/COMPARISON.md` for the full comparison matrix.

In brief: MIT and Apache 2.0.3 offer no protection against AI training. GPL offers copyleft but only at distribution — a model trained on GPL code and never distributed is not covered. BSL (Business Source License) restricts commercial use but does not specifically address AI extraction.

RCF is the only protocol in this set that:

1. Explicitly prohibits AI/ML training on protected logic
2. Provides block-level granularity (not file-level)
3. Includes cryptographic audit infrastructure
4. Supports third-party verification without requiring access to the author's systems

---

## 6. Conclusion

The age of LLMs has created a structural gap in software licensing. Code that is published under traditional open-source terms is now effectively available for automated extraction at scale, with no legal mechanism for the author to contest it.

RCF is not a retreat from openness. It is an evolution of it — a framework that preserves the values of transparency and auditability while recognizing that **visibility and exploitation rights are not the same thing**.

For independent developers, researchers, and small labs, RCF provides the first licensing protocol designed specifically for the threat model of 2025: not the human copier, but the automated correlator.

---

## References

- DMCA §1201: Anti-Circumvention Provisions
- DMCA §1202: Copyright Management Information
- WIPO Copyright Treaty (1996), Articles 11–12
- `RCF-PL v2.0.3` — Full license text: `LICENSE.md`
- `rcf-cli` — Reference implementation: `sdk/python/rcf_cli`
- `rcf-guardian` — GitHub Action: `aliyevaladddin/rcf-guardian`

---

<div align="right">

*Aladdin Aliyev · Sovereign Code Initiative · 2025*  
*Protected under RCF-PL v2.0.3*

</div>
