# RCF Protocol — Restricted Correlation Framework

**Version:** 1.1  
**Status:** Active Specification  
**Category:** Author-Defined Licensing Protocol  
**Website:** [rcf.aliyev.site](https://rcf.aliyev.site)

---

## 🛡️ What is RCF?

**RCF (Restricted Correlation Framework)** is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights**.

### Core Principle: Visibility ≠ Rights

| Action | Status | Description |
|:---|:---|:---|
| **👀 Visibility** | ✅ **ALLOWED** | Reading, studying, and auditing the code or methodology. |
| **🚀 Usage** | ❌ **RESTRICTED** | Implementing, replicating, or automating extraction. |

---

## ❓ Why RCF?

Traditional open-source licenses fail to protect against modern threats. RCF provides a modular "Defense in Depth" approach:

- 🤖 **AI/ML Resistance:** Explicitly blocks unauthorized training on proprietary methodologies.
- 🕷️ **Anti-Extraction:** Prevents automated harvesting of correlation logic.
- � **Visible Source:** Allows manual audit and study (unlike closed source).
- ⚡ **Self-Enforcing:** Rights terminate automatically upon violation.

---

## 🏷️ Marker Quick Reference

RCF use semantic markers to define protection levels at the block or file level:

- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:NOTICE]` — Triggers requirement for adjacent legal notice.

---

## 🚀 Quick Start

### For Project Authors (Adopting RCF)
1. **Setup:** Copy template files from [`IMPLEMENTATION/TEMPLATES/`](IMPLEMENTATION/TEMPLATES/).
2. **Define:** Identify core methodologies in your code.
3. **Mark:** Annotate blocks with RCF markers. See [`CODE-MARKERS.md`](IMPLEMENTATION/CODE-MARKERS.md).
4. **Deploy:** include `NOTICE.md` in your repository root.

### For Decentralized Systems (dOS)
RCF is specialized for dOS environments (like **Aurora Access**). See the [**dOS Adoption Guide**](SPECIFICATION/RCF-DOS-ADOPTION.md) for kernel-level implementation examples.

---

## 🛠️ RCF CLI Tool (Python SDK)

We provide a Python-based scanner to verify compliance in your projects.

### Installation
```bash
cd sdk/python
pip install .
```

### Usage
```bash
# Scan a directory for RCF compliance
rcf-cli .

# Generate a JSON report
rcf-cli . --format json

# Show summary only
rcf-cli . --summary
```

---

## 📂 Repository Structure

| Directory | Description | Key Documents |
|:---|:---|:---|
| [**SPECIFICATION/**](SPECIFICATION/) | Technical protocol definition | [RCF-SPEC](SPECIFICATION/RCF-SPEC.md), [RCF-CORE](SPECIFICATION/RCF-CORE.md) |
| [**LEGAL/**](LEGAL/) | Legal framework and basis | [LEGAL](LEGAL/LEGAL.md), [JURISDICTION](LEGAL/JURISDICTION.md) |
| [**IMPLEMENTATION/**](IMPLEMENTATION/) | Practical adoption tools | [MARKERS](IMPLEMENTATION/CODE-MARKERS.md), [MEASURES](IMPLEMENTATION/TECHNICAL-MEASURES.md) |
| [**ADOPTION/**](ADOPTION/) | Guides for project authors | [ADOPTION-GUIDE](ADOPTION/ADOPTION-GUIDE.md), [FAQ](ADOPTION/FAQ.md) |
| [**GOVERNANCE/**](GOVERNANCE/) | Protocol evolution | [GOVERNANCE](GOVERNANCE/GOVERNANCE.md), [VERSIONING](GOVERNANCE/VERSIONING.md) |
| [**EXAMPLES/**](EXAMPLES/) | Reference implementations | [Py-Example](EXAMPLES/example-code.py), [C-Kernel-Example](EXAMPLES/dos-kernel-example.c) |

---

## 🛠️ Specialized Solutions

### Decentralized Operating Systems (dOS)
RCF provides specialized measures for dOS to ensure kernel transparency while protecting unique scheduling and data fusion algorithms.
👉 [Read dOS Supplemental Guide](SPECIFICATION/RCF-DOS-ADOPTION.md)

---

## 👥 Community & Support

- **Website:** [rcf.aliyev.site](https://rcf.aliyev.site)
- **Contact:** [aladdin@aliyev.site](mailto:aladdin@aliyev.site)
- **Projects:** [Aurora Access](https://auroraid.site), [Aliyev OSINT](https://osint.aliyev.site)

---

**© 2026 Aladdin Aliyev**  
**All rights reserved under RCF Protocol License v1.1**