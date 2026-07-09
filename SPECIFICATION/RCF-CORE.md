<!-- NOTICE: This file is protected under RCF-PL -->
# RCF-CORE — Core Concepts

**Version:** Active  
**Document Type:** Conceptual Overview  
**Status:** Active

---

## 1. Fundamental Principles

### The Visibility Paradox

Traditional intellectual property faces a dilemma:

| Approach | Problem |
|----------|---------|
| **Closed Source** | Cannot be studied, audited, or trusted |
| **Open Source** | Can be freely exploited, replicated, commercialized |

**RCF solves this** by creating a third path: **Visible but Protected**.

### Core Axioms

1. **Visibility ≠ Permission**
   - Seeing code does not grant rights to use it
   - Reading methodology does not allow replication

2. **Automation ≠ Human**
   - Manual study is permitted
   - Automated extraction is prohibited

3. **Methodology is IP**
   - Implementation details are protectable
   - Correlation logic is valuable intellectual property

---

## 2. The RCF Model

### Dual Rights System
┌─────────────────────────────────────────┐
│           RCF DUAL RIGHTS               │
├─────────────────────────────────────────┤
│                                         │
│  VISIBILITY RIGHTS   │   USAGE RIGHTS   │
│  ─────────────────   │   ────────────   │
│                      │                  │
│  • Read manually     │   • Implement    │
│  • Study personally  │   • Replicate    │
│  • Reference         │   • Train AI/ML  │
│  • Report bugs       │   • Commercialize│
│                      │                  │
│  ✅ AUTOMATICALLY    │   ❌ REQUIRES     |
│     GRANTED          │     AUTHORIZATION|
│                      │                  |
└─────────────────────────────────────────┘

### Protection Layers (Defense in Depth)

| Layer | Purpose | Mechanism |
|-------|---------|-----------|
| **Legal** | Establish rights | RCF-PL license text |
| **Notice** | Communicate terms | NOTICE.md, file headers |
| **Markers** | Granular control | `[RCF:PUBLIC]`, `[RCF:PROTECTED]` |
| **Technical** | Active prevention | Rate limiting, obfuscation |
| **Monitoring** | Detect violations | Access logging, behavioral analysis |

---

## 3. Key Concepts

### Correlation Methodology

**Definition:** The specific techniques, algorithms, patterns, or logic used to analyze, correlate, or derive insights from data.

**Why it matters:** This is the core intellectual property that RCF protects. It represents research investment and competitive advantage.

**Examples:**
- OSINT correlation algorithms
- Data fusion techniques
- Pattern recognition logic
- Analytical frameworks

### Automated Extraction

**Definition:** Any use of software, scripts, AI/ML systems, or automated means to analyze, process, extract, or replicate elements of Protected Work.

**Includes:**
- Web scraping and crawling
- API harvesting
- Static code analysis tools
- Dynamic analysis and debugging
- Machine learning training data generation

**Excludes:**
- Manual reading and examination
- Human-powered research and note-taking
- Responsible security auditing

### Self-Enforcement

**Definition:** The automatic termination of all granted rights upon license violation, without requirement for prior notice or warning.

**Mechanism:**
1. Violation occurs
2. Rights terminate immediately (automatic)
3. Legal remedies become available

**Purpose:** Removes ambiguity and ensures immediate consequence for violations.

---

## 4. RCF Markers Explained

### Marker Philosophy

RCF markers are **semantic annotations** that communicate protection level. They are not technical barriers but **legal signals**.

### Marker Hierarchy
PERMISSIVENESS SCALE

[RCF:PUBLIC]        ← Most permissive
      │
      ▼
[RCF:PROTECTED]     ← Standard protection
      │
      ▼
[RCF:RESTRICTED]    ← Most restrictive

### Marker Combinations

Markers can be combined for nuanced protection:

| Combination | Meaning |
|-------------|---------|
| `[RCF:NOTICE][RCF:PUBLIC]` | Public but requires legal notice |
| `[RCF:NOTICE][RCF:PROTECTED]` | Standard protected content |
| `[RCF:NOTICE][RCF:RESTRICTED]` | Highly sensitive, minimal rights |

---

## 5. Comparison with Other Models

### vs. Open Source (MIT, GPL, Apache)

| Aspect | Open Source | RCF |
|--------|-------------|-----|
| Visibility | ✅ Allowed | ✅ Allowed |
| Modification | ✅ Allowed | ❌ Restricted |
| Distribution | ✅ Allowed | ❌ Restricted |
| Commercial Use | ✅ Allowed | ❌ Restricted |
| AI/ML Training | ✅ Allowed | ❌ Prohibited |

### vs. Proprietary/Closed Source

| Aspect | Proprietary | RCF |
|--------|-------------|-----|
| Visibility | ❌ Denied | ✅ Allowed |
| Auditability | ❌ Impossible | ✅ Possible |
| Trust | Low (black box) | High (visible) |
| Protection | Strong | Strong |

### vs. Creative Commons

| Aspect | CC BY-NC | RCF |
|--------|----------|-----|
| Non-Commercial | ✅ Required | ✅ Required |
| AI/ML Training | ⚠️ Unclear | ❌ Explicitly prohibited |
| Methodology Protection | ❌ Weak | ✅ Strong |
| Self-Enforcement | ❌ No | ✅ Yes |

---

## 6. Use Cases

### Ideal for RCF

- Research projects with unique methodologies
- OSINT tools with proprietary correlation logic
- AI/ML systems with valuable training approaches
- Security tools with novel detection algorithms
- Data analysis platforms with unique insights

### Not Suitable for RCF

- Standards and reference implementations
- Educational examples for learning
- Projects seeking wide community contribution
- Infrastructure libraries (use permissive licenses)
- Projects requiring GPL compatibility

---

## 7. Ethical Framework

### Intent of RCF

RCF is designed to:

1. **Protect research investment** — Enable sustainable innovation
2. **Enable transparency** — Allow audit and study without unrestricted exploitation
3. **Prevent mass replication** — Stop automated dilution of value
4. **Maintain control** — Keep authors in charge of their work's destiny

### Responsible Use

Authors adopting RCF should:

- Clearly communicate restrictions
- Respond promptly to authorization requests
- Consider reasonable research exemptions
- Not use RCF to hide security vulnerabilities

Users encountering RCF should:

- Respect the license terms
- Seek authorization for desired uses
- Contribute feedback to authors
- Not attempt circumvention

---

## 8. Future Directions

### Potential Enhancements

- **Time-Decay Protection:** Automatic transition to permissive license after N years
- **Research License:** Streamlined authorization for academic use
- **Technical Standards:** Reference implementations of enforcement tools

### Community Governance

Future versions may explore:

- Multi-author governance models
- Community-driven specification updates
- Arbitration mechanisms for disputes
- International legal harmonization

---

## 9. References

- [RCF-SPEC.md](RCF-SPEC.md) — Technical specification
- [LEGAL.md](../LEGAL/LEGAL.md) — Legal framework
- [ADOPTION-GUIDE.md](../ADOPTION/ADOPTION-GUIDE.md) — Adoption guidance

---

**Document Control:**
- Version: Active
- Last Updated: 2026
- Status: Active

**© 2026 RCF Protocol**  
**All rights reserved.**
