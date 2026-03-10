# 🛡️ RCF Protocol SDK (v1.2.2)

[![NPM Version](https://img.shields.io/npm/v/rcf-protocol?color=blue&style=flat-square)](https://www.npmjs.com/package/rcf-protocol)
[![PyPI - Version](https://img.shields.io/pypi/v/rcf-cli?color=blue&style=flat-square)](https://pypi.org/project/rcf-cli/)
[![License: RCF-PL](https://img.shields.io/badge/License-RCF--PL_1.1-red.svg?style=flat-square)](https://rcf.aliyev.site)

The official toolset, SDKs, and Command Line Interface (CLI) for the **Restricted Correlation Framework (RCF)** protocol.

Version `1.2.2` provides robust tools for rapid verification of source code compliance against RCF specification standards, supporting both the **TypeScript/JavaScript** and **Python** ecosystems natively.

## 📦 Installation

You can install the RCF toolkit in the language of your choice:

### 🟨 TypeScript/Node.js (NPM)
Install the TS/JS package globally (recommended for terminal usage) or as a project dependency:
```bash
# Global installation (Recommended)
npm install -g rcf-protocol

# Project dependency
npm install rcf-protocol
```

### 🐍 Python (PyPI)
Install the Python CLI and SDK via pip:
```bash
pip install rcf-cli
```

---

## 🚀 CLI Commands

Both SDKs provide the `rcf-cli` command.

### 1. Initialize RCF
Create the necessary `NOTICE.md` and `.rcfignore` files in your project:
```bash
rcf-cli init --project "MyProject" --author "Your Name"
```

### 2. Scan for Compliance
Scan your directory to ensure all files have the required RCF headers and markers:
```bash
rcf-cli .
```

### 3. Generate Audit Report (Premium)
Generate a cryptographically signed SHA-256 snapshot of your protected assets:
```bash
rcf-cli audit . --license-key RCF-AUDIT-XXXX-XXXX
```

---

## 🏷️ RCF Markers

RCF uses consistent semantic markers across all supported languages:

- `[RCF:PUBLIC]` — Architecture and public concepts. Safe for documentation.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal visibility.
- `[RCF:NOTICE]` — Triggers requirement for adjacent legal notice.

---

## 🌐 Resources
- **Official Specification:** [rcf.aliyev.site](https://rcf.aliyev.site)
- **Legal Framework:** [LEGAL.md](../LEGAL/LEGAL.md)
- **Email Support:** [aladdin@aliyev.site](mailto:aladdin@aliyev.site)

**© 2026 Aladdin Aliyev. All rights reserved.**
