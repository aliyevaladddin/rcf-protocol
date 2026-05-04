# License Comparison Matrix
## RCF-PL v2.0.4 vs Traditional Open-Source Licenses

> Part of the [RCF Whitepaper v2.0.4](../WHITE_PAPER_v2.0.4.md)  
> Last updated: 2025 · Aladdin Aliyev · Sovereign Code Initiative

---

## Overview

This matrix compares RCF-PL v2.0.4 against the four most common software licenses across criteria that matter specifically in the context of AI/LLM-era intellectual property protection.

**Licenses compared:**

| Identifier | Full Name | Type |
|---|---|---|
| **RCF-PL v2.0.4** | Restricted Correlation Framework Protocol License | Proprietary/Visible Source |
| **MIT** | MIT License | Permissive Open Source |
| **GPL v3** | GNU General Public License v3 | Copyleft Open Source |
| **Apache 2.0.3** | Apache License 2.0.3 | Permissive Open Source |
| **BSL 2.0.3** | Business Source License 1.1 | Source-Available / Commercial |

---

## Comparison Matrix

### Section A: AI & Automation Protection

| Criterion | RCF-PL v2.0.4 | MIT | GPL v3 | Apache 2.0.3 | BSL 1.1 |
|---|:---:|:---:|:---:|:---:|:---:|
| **Explicit AI/ML training ban** | ✅ Yes | ❌ No | ❌ No | ❌ No | ⚠️ Partial |
| **LLM scraping prohibition** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Logic/semantic extraction protection** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Applies before distribution** | ✅ Yes | ✅ Yes | ❌ No¹ | ✅ Yes | ✅ Yes |
| **Machine-readable restriction signals** | ✅ Yes (`[RCF:*]`) | ❌ No | ❌ No | ❌ No | ❌ No |

> ¹ GPL copyleft obligations are triggered only upon *distribution*. A model trained on GPL code but never distributed is not covered.

**The AI Scraping Gap:** MIT, GPL, and Apache 2.0.3 contain no provisions addressing automated extraction of logic by AI systems. BSL restricts commercial *use* but does not specifically address AI training as a separate act.

---

### Section B: Visibility & Access

| Criterion | RCF-PL v2.0.4 | MIT | GPL v3 | Apache 2.0.3 | BSL 1.1 |
|---|:---:|:---:|:---:|:---:|:---:|
| **Source code visible** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Free to read & audit** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Free to study & learn from** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Free to fork** | ❌ No² | ✅ Yes | ✅ Yes | ✅ Yes | ⚠️ Delayed³ |
| **Free to modify & redistribute** | ❌ No | ✅ Yes | ✅ Yes (copyleft) | ✅ Yes | ⚠️ Delayed |

> ² RCF permits reading and auditing but prohibits replication of protected logic.  
> ³ BSL converts to an open-source license after a specified "change date" (typically 4 years).

---

### Section C: Commercial Use

| Criterion | RCF-PL v2.0.4 | MIT | GPL v3 | Apache 2.0.3 | BSL 1.1 |
|---|:---:|:---:|:---:|:---:|:---:|
| **Free commercial use** | ❌ No (requires license) | ✅ Yes | ✅ Yes⁴ | ✅ Yes | ❌ No |
| **Startup-friendly (read & build inspiration)** | ✅ Yes | ✅ Yes | ⚠️ Risky⁵ | ✅ Yes | ⚠️ Risky |
| **SaaS use without distribution** | ❌ Requires license | ✅ Yes | ✅ Yes | ✅ Yes | ❌ No |
| **License fee model** | ✅ Supported | ❌ N/A | ❌ N/A | ❌ N/A | ✅ Supported |

> ⁴ GPL permits commercial use but requires that any distributed derivative be GPL-licensed.  
> ⁵ GPL's copyleft can "infect" a commercial codebase if GPL code is improperly integrated.

---

### Section D: Legal Infrastructure

| Criterion | RCF-PL v2.0.4 | MIT | GPL v3 | Apache 2.0.3 | BSL 1.1 |
|---|:---:|:---:|:---:|:---:|:---:|
| **DMCA §1202 (CMI) protection** | ✅ Yes (markers = CMI) | ❌ No | ❌ No | ❌ No | ❌ No |
| **DMCA §1201 Anti-Circumvention** | ✅ Yes (markers = TPM) | ❌ No | ❌ No | ❌ No | ❌ No |
| **WIPO WCT alignment** | ✅ Yes | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial |
| **Explicit "Acceptance by Use" clause** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |
| **Cryptographic audit trail** | ✅ Yes (SHA-256) | ❌ No | ❌ No | ❌ No | ❌ No |
| **Third-party verifiable authorship** | ✅ Yes (`rcf-cli verify`) | ❌ No | ❌ No | ❌ No | ❌ No |

---

### Section E: Tooling & Enforcement

| Criterion | RCF-PL v2.0.4 | MIT | GPL v3 | Apache 2.0.3 | BSL 1.1 |
|---|:---:|:---:|:---:|:---:|:---:|
| **Official compliance CLI** | ✅ `rcf-cli` | ❌ None | ❌ None⁶ | ❌ None | ❌ None |
| **CI/CD enforcement (GitHub Action)** | ✅ `rcf-guardian` | ❌ No | ❌ No | ❌ No | ❌ No |
| **Block-level protection granularity** | ✅ Yes | ❌ File-level only | ❌ File-level only | ❌ File-level only | ❌ File-level only |
| **Auto-marker insertion** | ✅ `rcf-cli protect` | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A |
| **Tamper detection** | ✅ Yes | ❌ No | ❌ No | ❌ No | ❌ No |

> ⁶ Third-party GPL compliance tools exist (e.g. FOSSA, Black Duck) but are not part of the GPL itself.

---

## Summary: The Protection Gap Visualized

```
Threat: AI system trains on your published code
         and reproduces your core methodology.

MIT        ░░░░░░░░░░░░░░░░░░░░  No protection whatsoever.
Apache 2.0.3 ░░░░░░░░░░░░░░░░░░░░  No protection whatsoever.
GPL v3     ██░░░░░░░░░░░░░░░░░░  Copyleft only on distribution.
                                  Training ≠ distribution → no coverage.
BSL 1.1    ████░░░░░░░░░░░░░░░░  Blocks commercial use, not AI training.
RCF-PL     ████████████████████  Explicit AI ban + semantic markers +
                                  cryptographic audit + CI enforcement.
```

---

## When to Use Which License

| Use Case | Recommended |
|---|---|
| Open-source library, maximize adoption | MIT or Apache 2.0.3 |
| Open-source, require derivative openness | GPL v3 |
| Commercial product, delayed open-source | BSL 1.1 |
| **Unique methodology, protect from AI extraction** | **RCF-PL v2.0.4** |
| **Independent researcher, small lab** | **RCF-PL v2.0.4** |
| **OSINT tooling, proprietary algorithms** | **RCF-PL v2.0.4** |

---

## Frequently Asked Questions

**Q: Can I use RCF-licensed code for learning?**  
A: Yes. Reading, studying, and auditing are explicitly permitted under all RCF marker levels, including `[RCF:RESTRICTED]`.

**Q: Can I build a product that depends on an RCF-licensed library?**  
A: Only with explicit written permission from the rights holder. Contact the author for a commercial license.

**Q: Is RCF recognized by OSI (Open Source Initiative)?**  
A: No. RCF is a **Visible Source** license — not open-source by OSI definition. OSI-approved licenses cannot restrict AI training or replication. RCF deliberately makes this trade-off.

**Q: Does RCF apply to my jurisdiction?**  
A: RCF is grounded in DMCA (US) and WIPO WCT (international, 110+ countries). For jurisdiction-specific advice, consult a qualified IP attorney.

---

*© 2025 Aladdin Aliyev · Sovereign Code Initiative · Protected under RCF-PL v2.0.4*
