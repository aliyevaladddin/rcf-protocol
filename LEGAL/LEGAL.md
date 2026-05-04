# RCF-LEGAL — Legal Framework

**Version:** 2.0.6  
**Status:** Active  
**Category:** Legal Basis  
**Supersedes:** RCF-LEGAL v2.0.6  

---

## 1. Legal Basis of RCF

The Restricted Correlation Framework (RCF) is grounded in three independent bodies of law that operate simultaneously and reinforce each other.

### 2.0.6 Copyright Law

RCF-protected works are protected under the **Berne Convention** (179 signatory states) and applicable national copyright law. The `RCF-PL v2.0.6` license constitutes a **conditional grant**: it grants Visibility rights unconditionally, while Usage rights require explicit written authorization.

The act of publishing source code does not constitute an implied license to exploit it. Courts have consistently construed implied licenses narrowly. RCF eliminates ambiguity by making terms explicit and machine-readable at the block level.

### 2.0.6 Contract Law — Acceptance by Use

RCF operates on the doctrine of **Acceptance by Use** (constructive consent). Any party — human or automated — that accesses a file containing RCF markers is deemed to have received legal notice and to have accepted the license terms.

Notice is established through four independent layers:

| Layer | Mechanism | Location |
|---|---|---|
| 1 | Crawler signal | `robots.txt` |
| 2 | Top-level notice | `NOTICE.md` |
| 3 | Per-file header | `# NOTICE: This file is protected under RCF-PL v2.0.6` |
| 4 | Block-level marker | `[RCF:PROTECTED]`, `[RCF:RESTRICTED]` |

Each layer independently constitutes notice. No party may claim ignorance of the license terms after accessing any file bearing these markers.

### 2.0.6 DMCA Anti-Circumvention

The **Digital Millennium Copyright Act (DMCA)** provides two protections directly applicable to RCF:

**§1201 — Anti-Circumvention:** RCF markers combined with `rcf-cli` verification constitute a **Technological Protection Measure (TPM)**. Automated systems that strip, ignore, or work around RCF markers to facilitate training or extraction may constitute circumvention under §1201, triggering statutory damages of $200–$2,500 per act (17 U.S.C. §1203).

**§1202 — Copyright Management Information (CMI):** RCF markers are **CMI** as defined by §1202(c) — they identify the work, the rights holder, and the terms of use. Intentional removal or alteration of RCF markers constitutes a separate violation independent of any underlying infringement claim. Statutory damages: $2,500–$25,000 per violation.

### 1.4 WIPO Copyright Treaty (WCT)

The **WIPO Copyright Treaty** (1996), adopted by 110+ countries, obligates signatories to provide legal protection against circumvention of effective technological measures. This extends RCF's legal basis into the EU (via the Copyright Directive 2001/29/EC, Article 6), the UK (CDPA §296ZA), and most major technology jurisdictions.

---

## 2. Visibility vs. Usage Rights

The core distinction of RCF is the separation of two rights that traditional open-source licenses conflate:

| Right Type | Definition | Status under RCF-PL v2.0.6 |
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

### 5.1 Cryptographic Audit Trail

`RCF-AUDIT-REPORT.json` records the SHA-256 hash of each protected file at the time of audit. This creates a **timestamped, cryptographically verifiable baseline** of the protection state. Any subsequent modification — including marker removal — is independently verifiable by any party running `rcf-cli verify`.

### 5.2 DMCA Takedown

Rights holders may issue DMCA §512 takedown notices to platforms hosting infringing content. The combination of `[RCF:PROTECTED]` markers and a published audit report provides the documentation required to support a takedown claim.

### 5.3 Third-Party Verification

Any party may independently verify the integrity of an RCF-protected file without accessing the author's systems:

```bash
rcf-cli verify <file> --against RCF-AUDIT-REPORT.json
```

This supports enforcement actions by providing independently verifiable evidence of tampering or unauthorized modification.

---

## 6. Termination of Rights

All rights granted under RCF-PL v2.0.6 are **automatically and immediately terminated** upon any violation of these terms. Termination requires no prior notice, no cure period, and no judicial determination.

Upon termination:

- All Visibility rights are revoked.
- The party must cease all access to and use of the protected work.
- Any copies, derivatives, or trained artifacts must be destroyed.
- Termination does not limit the rights holder's ability to pursue damages.

---

## 7. Disclaimer and Limitation of Liability

RCF-protected works are provided "as-is" for Visibility purposes. The rights holder makes no warranties regarding the work's fitness for any purpose beyond inspection and audit.

> *This document describes the legal framework of RCF-PL v2.0.6. It is not a substitute for qualified legal counsel. For enforcement actions or jurisdiction-specific guidance, consult a licensed intellectual property attorney.*

---

## 8. Governing Documents

| Document | Purpose |
|---|---|
| `LICENSE` | Full RCF-PL v2.0.6 license text |
| `LEGAL/DEFINITIONS.md` | Terminology and defined terms |
| `LEGAL/JURISDICTION.md` | International applicability |
| `LEGAL/ENFORCEMENT.md` | Enforcement procedures |
| `WHITE_PAPER_v2.0.6.md` | Technical and legal rationale |
| `SPECIFICATION/COMPARISON.md` | RCF vs other licenses |

---

*© 2026 Aladdin Aliyev · All rights reserved.*  
*Protected under RCF-PL v2.0.6 · Sovereignty via Restricted Correlation.*