<!-- NOTICE: This file is protected under RCF-PL -->
# RCF CLI — Python Edition 🛡️🐍

The official Python Command Line Interface for the **RCF (Restricted Correlation Framework) Protocol Active Integrity & Audit Framework**.

RCF is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights** using cryptographic integrity chains.

## Installation

Install via PyPI:

```bash
pip install rcf-cli
```

## Features

- **Audit Shield Protection**: Active enforcement of RCF-PL standards across your codebase.
- **Project Initialization**: Instantly generate `NOTICE.md` and `.rcfignore` files to protect your project.
- **Automated Scanning**: Quickly scan projects for RCF compliance and extract Audit Markers.
- **Header Validation**: Ensure files have the required `NOTICE: This file is protected under RCF-PL` header.
- **RCF-Audit**: Generate cryptographically signed compliance reports for enterprise auditing.
- **Integrity Chains**: Compare current file hashes and Audit Markers against an audit report to detect unauthorized modifications or tampering.


## CLI Usage

### 1. Initialize RCF in your project

Run this in your project's root directory to generate the legal notice:

```bash
rcf-cli init --project "My awesome app" --author "Aladdin Aliyev"
```

### 2. Scan your project

```bash
# Scan the current directory
rcf-cli .

# Output scan results as JSON
rcf-cli . --format json

# Print summary only
rcf-cli . --summary
```

### 3. Generate an RCF-Audit Report

```bash
# Provide license key via flag
rcf-cli audit . --license-key RCF-AUDIT-XXXX-XXXX

# Or use environment variable
export RCF_LICENSE_KEY=RCF-AUDIT-XXXX-XXXX
rcf-cli audit .
```

### 4. Verify Project Integrity

Compare current files with the latest audit report:

```bash
rcf-cli verify .

# Show summary only
rcf-cli verify . --summary
```

## Markers Reference

RCF uses semantic markers to define protection levels. Place these inside code comments:
- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:AUDIT:HASH]` — Cryptographic marker for active integrity verification.

Example header for protected files:
```python
# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
# [RCF:AUDIT:6A...F3]
```

## Documentation

For full specification and legal framework details, visit the official site: **[aliyev.site/rcf](https://aliyev.site/rcf)**
