# RCF-LEGAL — Legal Framework

**Version:** Active  
**Status:** Active  
**Category:** Legal Basis  
**Supersedes:** RCF-LEGAL  

---

> **Nature of this document — read first.**
> This is the legal framework RCF-PL *asserts*. The positions below — that RCF
> markers function as a Technological Protection Measure, that accessing a marked
> file constitutes acceptance of the license, that rights terminate automatically
> on violation — are **good-faith legal theories, not adjudicated facts**. Most
> have not been tested in court, and their force varies by jurisdiction and on the
> specific facts of a case. The dollar figures cited are **statutory ranges that a
> court may award if infringement is proven**, not amounts that accrue
> automatically. RCF holds its technical claims to a strict honesty standard (it
> labels its own limits — "first ring", "model extrapolation", "a declaration, not
> a lock"); this document is held to the same standard. Treat it as a stated
> position to be argued, not a settled outcome. It is not legal advice — for any
> enforcement action, consult a licensed IP attorney (see §7).

---

## 1. Legal Basis of RCF

The Restricted Correlation Framework (RCF) is grounded in three independent bodies of law that operate simultaneously and reinforce each other.

### Copyright Law

RCF-protected works are protected under the **Berne Convention** (179 signatory states) and applicable national copyright law. The `RCF-PL` license constitutes a **conditional grant**: it grants Visibility rights unconditionally, while Usage rights require explicit written authorization.

The act of publishing source code does not constitute an implied license to exploit it. Courts have consistently construed implied licenses narrowly. RCF eliminates ambiguity by making terms explicit and machine-readable at the block level.

### Contract Law — Acceptance by Use

RCF invokes the doctrine of **Acceptance by Use** (constructive consent): RCF-PL asserts that any party — human or automated — that accesses a file containing RCF markers has received legal notice and accepted the license terms. How far constructive consent reaches, especially to automated access with no human assent, is unsettled and varies by jurisdiction; this is an asserted position, not an established rule.

Notice is established through four independent layers:

| Layer | Mechanism | Location |
|---|---|---|
| 1 | Crawler signal | `robots.txt` |
| 2 | Top-level notice | `NOTICE.md` |
| 3 | Per-file header | `# NOTICE: This file is protected under RCF-PL` |
| 4 | Block-level marker | `[RCF:PROTECTED]`, `[RCF:RESTRICTED]` |

Each layer is intended to constitute notice. RCF-PL's position is that, given four overlapping layers, a party cannot credibly claim ignorance of the license terms after accessing a file bearing these markers — though whether notice is legally effective in a given case remains for a court to decide.

### DMCA Anti-Circumvention

The **Digital Millennium Copyright Act (DMCA)** provides two protections directly applicable to RCF:

**§1201 — Anti-Circumvention:** RCF-PL takes the position that RCF markers combined with `rcf-cli` verification can function as a **Technological Protection Measure (TPM)**. This is a contested reading — §1201 was written for measures that control *access* (e.g. encryption), and a marker that declares terms without technically blocking access may not qualify; no court has ruled on RCF. On that theory, automated systems that strip, ignore, or work around RCF markers to facilitate training or extraction may constitute circumvention under §1201, for which the statute provides damages of $200–$2,500 per act *if a violation is established* (17 U.S.C. §1203).

**§1202 — Copyright Management Information (CMI):** RCF-PL asserts that RCF markers are **CMI** within §1202(c) — they identify the work, the rights holder, and the terms of use. On this reading, *intentional* removal or alteration of RCF markers — done knowing, or with reason to know, it would conceal infringement — could be a violation independent of any underlying infringement claim. §1202 requires that knowing/intentional mental state; it is not automatic. Where established, the statute provides damages of $2,500–$25,000 per violation (17 U.S.C. §1203).

### WIPO Copyright Treaty (WCT)

The **WIPO Copyright Treaty** (1996), adopted by 110+ countries, obligates signatories to provide legal protection against circumvention of effective technological measures. This extends RCF's legal basis into the EU (via the Copyright Directive 2001/29/EC, Article 6), the UK (CDPA §296ZA), and most major technology jurisdictions.

---

## 2. Visibility vs. Usage Rights

The core distinction of RCF is the separation of two rights that traditional open-source licenses conflate:

| Right Type | Definition | Status under RCF-PL |
|---|---|---|
| **Visibility** | The right to read, study, audit, and manually reference the work | ✅ Granted automatically to all parties |
| **Usage** | The right to implement, replicate, extract, or train on the logic | ❌ Restricted — requires explicit written authorization |

This distinction applies regardless of whether access is by a human or an automated system. The act of reading does not grant the right to exploit.

---

## 3. Protection Levels and Their Legal Effect

| Marker | Scope | Legal Effect |
|---|---|---|
| `[RCF:PUBLIC]` | Architecture, interfaces, public concepts | Visibility and reference permitted. Replication requires attribution. |
| `[RCF:PROTECTED]` | Core methodology and algorithmic logic | Visibility permitted. Replication, extraction, and AI/ML training prohibited. |
| `[RCF:RESTRICTED]` | Sensitive implementation details | Minimal access. No reproduction in any form without written license. |

Markers removed from a file after the generation of `RCF-AUDIT-REPORT.json` constitute evidence of intentional circumvention under DMCA §1202.

---

## 4. Prohibited Activities

The following activities are prohibited without explicit written authorization from the rights holder:

1. **Automated Extraction** — Any automated harvesting, scraping, or parsing of RCF-protected logic, including crawlers, LLM training pipelines, and data ingestion systems.

2. **AI/ML Training** — Using RCF-protected works, in whole or in part, to train, fine-tune, evaluate, or validate any artificial intelligence or machine learning model.

3. **Methodology Replication** — Implementing the core algorithms, correlation logic, or architectural patterns of an RCF-protected work in any other project, product, or system.

4. **Commercial Exploitation** — Using RCF-protected works for direct or indirect financial gain, including incorporation into commercial products or SaaS offerings.

5. **Marker Circumvention** — Removing, altering, or obscuring RCF markers, file headers, or audit records for any purpose.

6. **Derivative Training Data** — Converting, paraphrasing, or summarizing RCF-protected logic into datasets intended for AI training.

---

## 5. Enforcement

### Cryptographic Audit Trail

`RCF-AUDIT-REPORT.json` records the SHA-256 hash of each protected file at the time of audit. This creates a **timestamped, cryptographically verifiable baseline** of the protection state. Any subsequent modification — including marker removal — is independently verifiable by any party running `rcf-cli verify`.

### DMCA Takedown

Rights holders may issue DMCA §512 takedown notices to platforms hosting infringing content. The combination of `[RCF:PROTECTED]` markers and a published audit report provides the documentation required to support a takedown claim.

### Third-Party Verification

Any party may independently verify the integrity of an RCF-protected file without accessing the author's systems:

```bash
rcf-cli verify <file> --against RCF-AUDIT-REPORT.json
```

This supports enforcement actions by providing independently verifiable evidence of tampering or unauthorized modification.

---

## 6. Termination of Rights

All rights granted under RCF-PL are **automatically and immediately terminated** upon any violation of these terms. Termination requires no prior notice, no cure period, and no judicial determination.

Upon termination:

- All Visibility rights are revoked.
- The party must cease all access to and use of the protected work.
- Any copies, derivatives, or trained artifacts must be destroyed.
- Termination does not limit the rights holder's ability to pursue damages.

---

## 7. Disclaimer and Limitation of Liability

RCF-protected works are provided "as-is" for Visibility purposes. The rights holder makes no warranties regarding the work's fitness for any purpose beyond inspection and audit.

> *This document describes the legal framework of RCF-PL. It is not a substitute for qualified legal counsel. For enforcement actions or jurisdiction-specific guidance, consult a licensed intellectual property attorney.*

---

## 8. Governing Documents

| Document | Purpose |
|---|---|
| `LICENSE` | Full RCF-PL license text |
| `LEGAL/DEFINITIONS.md` | Terminology and defined terms |
| `LEGAL/JURISDICTION.md` | International applicability |
| `LEGAL/ENFORCEMENT.md` | Enforcement procedures |
| `WHITE_PAPER.md` | Technical and legal rationale |
| `SPECIFICATION/COMPARISON.md` | RCF vs other licenses |

---

*© 2026 Aladdin Aliyev · All rights reserved.*  
*Protected under RCF-PL · Sovereignty via Restricted Correlation.*