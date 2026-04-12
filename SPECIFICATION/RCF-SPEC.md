<!-- NOTICE: This file is protected under RCF-PL v1.3 -->
# RCF Specification — Restricted Correlation Framework

**Version:** 1.2.2  
**Document Type:** Technical Specification  
**Status:** Active

---

## 1. Introduction

### 1.1 Purpose

This document defines the technical specification of the Restricted 
Correlation Framework (RCF) Protocol. It provides:

- Core concepts and architectural principles
- Implementation guidelines for protected works
- Compliance verification criteria
- Technical enforcement mechanisms

### 1.2 Scope

RCF applies to:
- Software source code and binaries
- Documentation and specifications
- Methodologies and algorithms
- Data correlation logic
- Training materials and know-how

### 1.3 Design Goals

1. **Visibility Preservation**: Allow legitimate study and review
2. **Usage Control**: Prevent unauthorized exploitation
3. **AI/ML Resistance**: Block automated mass replication
4. **Self-Enforcement**: Automatic termination on violation
5. **Legal Clarity**: Unambiguous terms for enforcement

---

## 2. Core Architecture

### 2.1 The Visibility-Usage Boundary
┌─────────────────────────────────────────────────────────────┐
│                    RCF PROTECTION MODEL                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────────┐         ┌──────────────┐                 │
│   │  VISIBILITY  │         │    USAGE     │                 │
│   │   ALLOWED    │  ════►  │  RESTRICTED  │                 │
│   │              │         │              │                 │
│   │ • Manual     │         │ • Automated  │                 │
│   │   reading    │         │   extraction │                 │
│   │ • Personal   │         │ • AI/ML      │                 │
│   │   study      │         │   training   │                 │
│   │ • Research   │         │ • Commercial │                 │
│   │   reference  │         │   use        │                 │
│   │ • Bug        │         │ • Methodology│                 │
│   │   reports    │         │   replication│                 │
│   └──────────────┘         └──────────────┘                 │
│                                                             │
│   Boundary enforced through:                                │
│   • Legal terms (this license)                              │
│   • Technical measures (optional)                           │
│   • Self-enforcement clause                                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘


### 2.2 Protection Layers

RCF implements **defense in depth**:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| L1: Legal | License text | Establishes legal basis |
| L2: Notice | NOTICE.md, headers | Clear communication |
| L3: Markers | Code annotations | Granular protection |
| L4: Technical | Rate limiting, obfuscation | Active prevention |
| L5: Monitoring | Access logging | Violation detection |

---

## 3. RCF Markers and Annotations

### 3.1 Marker Syntax

RCF uses standardized markers embedded in code and documentation:

```python
# [RCF:PUBLIC] — Visible and documentable
# [RCF:PROTECTED] — Visible but protected methodology
# [RCF:RESTRICTED] — Strictly limited visibility
# [RCF:NOTICE] — Legal notice required
```

## 3.2 Marker Semantics

### `[RCF:PUBLIC]`
- May be documented in public materials
- May be referenced in academic work
- May be discussed in presentations
- **Still protected against AI/ML training**

### `[RCF:PROTECTED]`
- Core methodology or algorithm
- May be viewed manually
- **May NOT be:**
  - Replicated in other implementations
  - Used as training data
  - Documented in derivative works
  - Commercially exploited

### `[RCF:RESTRICTED]`
- Highly sensitive implementation details
- Minimal visibility rights
- Strong technical protection recommended
- Violation = immediate license termination

### `[RCF:NOTICE]`
- Requires adjacent legal notice
- Usually paired with other markers
- Example: `[RCF:NOTICE][RCF:PROTECTED]`

---

## 4. Technical Enforcement (Optional but Recommended)

### 4.1 Automation Detection

Protected works SHOULD implement:

class RCFEnforcement:
    """Example enforcement layer"""
    
    HUMAN_THRESHOLD = {
        'requests_per_minute': 30,
        'session_duration_minutes': 60,
        'mouse_movement_variance': 0.1,  # Minimum human-like variance
        'typing_pattern_consistency': 0.8  # Maximum consistency
    }
    
    def evaluate_access(self, session):
        """Determine if access pattern is human or automated"""
        scores = {
            'rate': self.check_rate(session),
            'behavior': self.analyze_behavior(session),
            'signature': self.check_known_signatures(session)
        }
        
        if any(scores.values()):
            self.trigger_violation_response(session)
            return False
        return True
    
    def trigger_violation_response(self, session):
        """Immediate response to suspected violation"""
        # 1. Log violation
        self.log_violation(session)
        
        # 2. Block access
        session.terminate()
        
        # 3. Preserve evidence
        self.capture_forensics(session)
        
        # 4. (Optional) Report to author
        self.notify_author(session)

        ## 4.2 Code Protection Techniques

| Technique | Use Case | Implementation |
|-----------|----------|----------------|
| **Dynamic Loading** | `[RCF:PROTECTED]` logic | Load from encrypted blob at runtime |
| **Obfuscation** | Critical algorithms | Control flow flattening, string encryption |
| **Watermarking** | Traceability | Invisible markers in output/data |
| **Rate Limiting** | API endpoints | Token bucket, exponential backoff |
| **Behavioral Analysis** | Session validation | Mouse tracking, keystroke dynamics |

---

## 5. Compliance Verification

### 5.1 Project Checklist

To be RCF-compliant, a project MUST:

- [ ] Include `LICENSE` file with RCF-PL v1.3 text
- [ ] Include `NOTICE.md` with project-specific warnings
- [ ] Mark protected code sections with RCF markers
- [ ] Document protection scope in README
- [ ] (Recommended) Implement technical enforcement
- [ ] (Recommended) Maintain access logs

### 5.2 File-Level Checklist

Each protected file SHOULD:

- [ ] Begin with RCF header notice
- [ ] Use appropriate RCF markers for sections
- [ ] Reference full license in comments
- [ ] Include contact for authorization

Example file header:

```python
# ==============================================================================
# NOTICE: This file is protected under RCF-PL v1.3
# Restricted Correlation Framework — https://github.com/[author]/rcf-protocol
# 
# VISIBILITY ALLOWED: Manual reading and study
# USAGE RESTRICTED: See LICENSE for prohibited activities
#
# [RCF:NOTICE][RCF:PROTECTED]
# ==============================================================================

```

### 5.3 Verification Tools

```bash
# Check license compliance
rcf-cli check-license /path/to/project

# Verify marker usage
rcf-cli verify-markers /path/to/project

# Generate compliance report
rcf-cli generate-report /path/to/project --output report.md
```
## 6. Adoption and Migration

### 6.1 New Projects

1. Initialize repository with RCF template files
2. Customize `NOTICE.md` with project details
3. Apply RCF markers during development
4. Document RCF adoption in README
5. Reference this specification

### 6.2 Migrating from Other Licenses

| From | To RCF | Considerations |
|------|--------|----------------|
| MIT | RCF | Breaking change, notify users |
| GPL | RCF | Compatibility issues, legal review |
| Proprietary | RCF | May increase visibility |
| Apache | RCF | Patent grants may be affected |

**Important:** Migration requires:
- Legal review
- Contributor agreement (if multi-author)
- Clear communication to existing users
- Version bump and changelog entry

---

## 7. Governance and Evolution

### 7.1 Versioning

RCF follows semantic versioning:
- **MAJOR**: Breaking changes to protection scope
- **MINOR**: New features, clarifications
- **PATCH**: Errata, non-substantive updates

### 7.2 Specification Updates

Updates to this specification are controlled by the Author.  
Community feedback is welcomed through:
- Issues in this repository
- Pull requests for errata
- Discussion forums (if available)

### 7.3 Backwards Compatibility

RCF-PL v1.x licenses remain valid for projects that adopted them,  
even if newer specification versions are released.

---

## 8. References

### 8.1 Related Documents

- `RCF-CORE.md` — Core concepts (this repository)
- `RCF-ENFORCEMENT.md` — Technical enforcement details
- `RCF-COMPLIANCE.md` — Compliance verification procedures
- `LEGAL.md` — Legal framework
- `DEFINITIONS.md` — Complete terminology

### 8.2 External References

- WIPO Copyright Treaty
- Berne Convention for the Protection of Literary and Artistic Works
- Digital Millennium Copyright Act (DMCA) — anti-circumvention
- EU Copyright Directive — text and data mining exceptions

---

## 9. Appendices

### Appendix A: RCF Marker Quick Reference

| Marker | Visibility | Usage | Documentation |
|--------|------------|-------|---------------|
| PUBLIC | ✅ Full | ❌ AI/ML, Commercial | ✅ Allowed |
| PROTECTED | ✅ Full | ❌ All restricted | ❌ Methodology only |
| RESTRICTED | ⚠️ Limited | ❌ All restricted | ❌ Minimal |
| NOTICE | — | — | Legal req. |

### Appendix B: Enforcement Response Matrix

| Violation Type | Response | Evidence Preservation |
|----------------|----------|----------------------|
| Rate limit exceeded | Block + Log | Session data |
| Automation detected | Block + Report | Full forensics |
| Commercial use | Cease & Desist | Usage records |
| Methodology replication | Legal action | Comparison analysis |
| Circumvention | Immediate termination | Technical logs |

---

**Document Control:**
- Version: 1.1
- Last Updated: 2026
- Status: Active
- Next Review: As needed

**© 2026 RCF Protocol**  
**All rights reserved.**
