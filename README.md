<!-- NOTICE: This file is protected under RCF-PL -->
![Proof HTML](https://github.com/aliyevaladddin/rcf-protocol/actions/workflows/master-pipeline.yml/badge.svg)
[![docs.rs](https://img.shields.io/docsrs/rcf-protocol)](https://docs.rs/rcf-protocol)
[![](https://data.jsdelivr.com/v1/package/npm/rcf-protocol/badge)](https://www.jsdelivr.com/package/npm/rcf-protocol)
[![PyPI downloads](https://img.shields.io/badge/downloads-14k%2B-brightgreen?style=flat-square&logo=pypi&logoColor=white)](https://pypi.org/project/rcf-cli)
[![npm downloads](https://img.shields.io/badge/npm-5%2C320%2B%20downloads-4ecdc4?style=flat-square&logo=npm&logoColor=red)](https://www.npmjs.com/package/rcf-protocol)

⭐ If you find this useful, a star helps others discover it

[![GitHub stars](https://img.shields.io/github/stars/aliyevaladddin/rcf-protocol?style=social)](https://github.com/aliyevaladddin/rcf-protocol)
[![OpenCollective](https://img.shields.io/opencollective/all/rcf-protocol?style=flat-square&color=4ecdc4&logo=opencollective&logoColor=white)](https://opencollective.com/rcf-protocol)
<img src="https://img.shields.io/liberapay/goal/aladdinaliyev.svg?logo=liberapay">


# RCF: Restricted Correlation Framework Protocol

[![NPM Version](https://img.shields.io/npm/v/rcf-protocol?color=blue&style=flat-square)](https://www.npmjs.com/package/rcf-protocol)
[![PyPI - Version](https://img.shields.io/pypi/v/rcf-cli?color=blue&style=flat-square)](https://pypi.org/project/rcf-cli/)
[![License: RCF-PL](https://img.shields.io/npm/v/rcf-protocol?label=RCF-PL&color=red&style=flat-square)](https://aliyev.site/rcf)
![PyPI License](https://img.shields.io/pypi/l/rcf-cli?color=8B5CF6)
[![ORCID: Aladdin Aliyev](https://img.shields.io/badge/ORCID-Aladdin%20Aliyev-A6CE39?logo=orcid&logoColor=white)](https://orcid.org/0009-0004-5230-2278)
[![GitLab](https://img.shields.io/badge/GitLab-@aladdinaliyev-orange?logo=gitlab)](https://gitlab.com/aladdinaliyev)
<a href="https://doi.org/10.5281/zenodo.21085740"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.21085740.svg" alt="DOI"></a>


**Version:** see [`package.json`](package.json) / [`sigma.json`](SPECIFICATION/sigma.json) — single source of truth
**Status:** Active Specification  
**Category:** Author-Defined Licensing Protocol  
**Website:** [aliyev.site/rcf](https://aliyev.site/rcf)

---

## 🆕 What's New in Active?

- 🛡️ **Active Defense**: Introduced Designed Canaries and AST Adversarial Noise to protect against source code harvesting.
- 🌐 **WAF Gateways**: Native `gateway` subcommand to export Cloudflare Worker and Nginx WAF configurations.
- 📦 **SDK Parity**: A single version is synchronized across NPM (`rcf-protocol`) and PyPI (`rcf-cli`); the canonical number lives in `package.json` / `pyproject.toml`.
- 📝 **Documentation Update**: Detailed audit and active defense usage guides added to SDK READMEs and the specification.

---

## 🛡️ What is RCF?

**RCF: Restricted Correlation Framework Protocol** is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. RCF-protected works are subject to protection under the Berne Convention and national copyright laws. The RCF-PL license serves as a conditional grant of visibility rights. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights**.

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
-  **Visible Source:** Allows manual audit and study (unlike closed source).
- ⚡ **Self-Enforcing:** Rights terminate automatically upon violation.

---

## 🏷️ Marker Quick Reference

RCF use semantic markers to define protection levels at the block or file level:

- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:NOTICE]` — Triggers requirement for adjacent legal notice.

---

## 🧩 Applying RCF

RCF is a free, open protocol. Anyone may adopt it at no cost to declare the boundary between what may be read and what may be replicated — the way `robots.txt` is a free convention that each site applies to itself.

### Protected Core — Open Edge
A common way to structure a project under RCF:
- **Open SDK ([RCF:PUBLIC])**: A free, open-source SDK for developers to build extensions, plugins, or integrations (e.g., smart home plugins).
- **Protected Core ([RCF:RESTRICTED])**: The core execution engine (e.g., A-VM) remains restricted. Access and usage rights are governed by the RCF-PL license terms.

### Audit & Ownership Snapshot
Use the `rcf-cli audit` tool to generate an immutable `RCF-AUDIT-REPORT.json` containing SHA-256 hashes of all protected methodologies — a verifiable snapshot of ownership that any author can produce for their own work.

> Learn more at [aliyev.site/rcf](https://aliyev.site/rcf)

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

We provide official Command Line Interfaces to verify compliance in your projects, available in both TypeScript/Node.js and Python ecosystems. **All computations (including scans, audits, and similarity proofs) run 100% locally and privately on your machine—no source code or cryptographic hashes are ever sent to external servers.**

### 🟨 Node.js (NPM)

Install the TypeScript/JavaScript package globally to use the CLI from anywhere:
```bash
npm install -g rcf-protocol
```
Or use it instantly via npx:
```bash
npx rcf-cli .
```

### 🐍 Python (PyPI)

Install the Python SDK globally or in your virtual environment:
```bash
pip install rcf-cli
```

### 🚀 Usage

| Command | Description |
|:---|:---|
| `rcf-cli init` | Initialize RCF in your project — generates `NOTICE.md` and `.rcfignore` |
| `rcf-cli audit [path]` | Generate a cryptographic `RCF-AUDIT-REPORT.json` — fingerprint all protected assets |
| `rcf-cli verify [path]` | Verify file/directory integrity against the audit report |
| `rcf-cli diff [path]` | Compare current markers vs audit report — ideal for CI/CD pipelines |
| `rcf-cli protect [path]` | Auto-insert RCF markers into unprotected logic blocks |
| `rcf-cli sentinel [path]` | Rank protected functions by surprisal mass (forensic watch-list) |
| `rcf-cli build-corpus [path]` | Build a background language structure corpus (`p_nat.json`) |
| `rcf-cli build-null [path]` | Calibrate a Monte Carlo null distribution for statistical proofs |
| `rcf-cli prove <fileA> <fileB>` | Compute a court-grade similarity proof (Z-score, E-value) between two files |
| `rcf-cli canary register` | Register a designed canary fingerprint to your registry |
| `rcf-cli canary scan [path]` | Scan a codebase for canary matches (detects code theft via subgraph isomorphism) |
| `rcf-cli noise [path]` | Inject adversarial AST noise into protected files to confuse AI models |
| `rcf-cli gateway cloudflare` | Export a Cloudflare Workers WAF script (`cloudflare_worker.ts`) |
| `rcf-cli gateway nginx` | Export Nginx Lua WAF script (`rcf_waf.lua`) and `nginx.conf` snippet |

```bash
# Examples:
rcf-cli init --project "MyApp" --author "Your Name"
rcf-cli audit .
rcf-cli verify .
rcf-cli prove src/algo.py src/algo_copy.py --corpus corpus.json --null null_model.json
rcf-cli canary scan . --registry rcf_canaries.json
rcf-cli noise src/
rcf-cli gateway cloudflare --out ./deploy
rcf-cli gateway nginx --out ./deploy
```

---

## 📂 Repository Structure

| Directory | Description | Key Documents |
|:---|:---|:---|
| [**SPECIFICATION/**](SPECIFICATION/) | Technical protocol definition | [RCF-SPEC](SPECIFICATION/RCF-SPEC.md), [RCF-CORE](SPECIFICATION/RCF-CORE.md), [RCF-CORRELATION](SPECIFICATION/RCF-CORRELATION.md), [RCF-SIGMA](SPECIFICATION/RCF-SIGMA.md), [RCF-ACTIVE-DEFENSE](SPECIFICATION/RCF-ACTIVE-DEFENSE.md) |
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

- **Website:** [aliyev.site/rcf](https://aliyev.site/rcf)
- **Contact:** [aladdin@aliyev.site](mailto:aladdin@aliyev.site)
- **Projects:** [Aurora Access](https://auroraid.site), [Aliyev OSINT](https://aliyev.site/osint)

---

**© 2026 Aladdin Aliyev**  
**All rights reserved under RCF: Restricted Correlation Framework Protocol**
