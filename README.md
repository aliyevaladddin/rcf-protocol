# RCF Protocol — Restricted Correlation Framework

[![NPM Version](https://img.shields.io/npm/v/rcf-protocol?color=blue&style=flat-square)](https://www.npmjs.com/package/rcf-protocol)
[![PyPI - Version](https://img.shields.io/pypi/v/rcf-cli?color=blue&style=flat-square)](https://pypi.org/project/rcf-cli/)
[![License: RCF-PL](https://img.shields.io/badge/License-RCF--PL_1.2.7-red.svg?style=flat-square)](https://rcf.aliyev.site)
[![ORCID: Aladdin Aliyev](https://img.shields.io/badge/ORCID-Aladdin%20Aliyev-A6CE39?logo=orcid&logoColor=white)](https://orcid.org/0009-0004-5230-2278)
**Version:** 1.2.7 (The Audit Release)
**Status:** Active Specification  
**Category:** Author-Defined Licensing Protocol  
**Website:** [rcf.aliyev.site](https://rcf.aliyev.site)

---

## 🆕 What's New in v1.2.7?

- 🛡️ **RCF-Audit Feature**: The `rcf-cli` now supports the `audit` command for generating cryptographically signed compliance reports.
- 📦 **SDK Parity**: Version 1.2.7 synchronized across NPM (`rcf-protocol`) and PyPI (`rcf-cli`).
- 📝 **Documentation Update**: Detailed audit usage guides added to SDK READMEs.

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

## 💎 RCF Business Models

RCF enables new paradigms for monetization and asset protection while maintaining ecosystem openness.

### 1. Protected Core — Open Edge
The "**Protected Core — Open Edge**" model allows you to distribute open, accessible tools while monetizing the execution engine:
- **Open SDK ([RCF:PUBLIC])**: Provide a free, open-source SDK for developers to build extensions, plugins, or integrations (e.g., smart home plugins).
- **Protected Core ([RCF:RESTRICTED])**: The core execution engine (e.g., A-VM) remains restricted. To run the extensions quickly and securely, users or enterprise clients must purchase **License Keys** for the restricted core.

### 2. RCF-Audit as a Service
Independent developers and small studios are vulnerable to IP theft and unauthorized AI extraction. **RCF-Audit as a Service** lets you act as a protection consultant:
- **Offer**: "AI is extracting your code. We will implement the RCF-protocol, mark your proprietary assets, and provide cryptographic audit capabilities."
- **Action**: Use the `rcf-cli audit` tool to generate an immutable `RCF-AUDIT-REPORT.json` containing SHA-256 hashes of all protected methodologies, creating a verifiable snapshot of ownership.

> **Pricing:** 
> - **RCF-Audit Personal:** $19 (one-time per project)
> - **RCF-Audit Professional:** $99/year (unlimited)
> 
> Visit [rcf.aliyev.site](https://rcf.aliyev.site) to obtain a license.

> **Note:** The `audit` command is a **Premium Feature** that requires an `RCF-AUDIT` License Key.

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

## 🛠️ RCF CLI Tools (NPM & PyPI)

We provide official Command Line Interfaces to verify compliance in your projects, available in both TypeScript/Node.js and Python ecosystems.

### 🟨 Node.js (NPM)

Install the TypeScript/JavaScript package globally to use the CLI from anywhere:
```bash
npm install -g rcf-protocol
```
Or use it instantly via npx:
```bash
npx rcf-protocol .
```

### 🐍 Python (PyPI)

Install the Python SDK globally or in your virtual environment:
```bash
pip install rcf-cli
```

### 🚀 Usage

```bash
# Initialize RCF protections in your project (generates NOTICE.md & .rcfignore)
rcf-cli init --project "MyApp" --author "Your Name"

# Scan a directory for RCF compliance
rcf-cli .

# Generate a premium RCF-Audit cryptographic report (Requires License Key)
rcf-cli audit . --license-key RCF-AUDIT-XXXXXX
# Or via environment variable:
# RCF_LICENSE_KEY=RCF-AUDIT-XXXXXX rcf-cli audit .

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
**All rights reserved under RCF Protocol License v1.2.7**
