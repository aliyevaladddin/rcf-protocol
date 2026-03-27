<!-- NOTICE: This file is protected under RCF-PL v1.2.8 -->
# RCF Protocol — Python CLI & SDK

The official Python Command Line Interface for the **RCF (Restricted Correlation Framework) Protocol**.

RCF is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights**.

## Installation

Install via PyPI:

```bash
pip install rcf-cli
```

## Features

- **Project Initialization**: Instantly generate `NOTICE.md` and `.rcfignore` files to protect your project.
- **Automated Scanning**: Quickly scan projects for RCF compliance and extract markers.
- **Header Validation**: Ensure files have the required `NOTICE: This file is protected under RCF-PL v1.1` header.
- **RCF-Audit (Premium)**: Generate cryptographically signed compliance reports for enterprise auditing.
- **Integrity Verification**: Compare current file hashes against an audit report to detect unauthorized modifications or tampering.


## CLI Usage

### 1. Initialize RCF in your project

Run this in your project's root directory to generate the legal notice:

```bash
rcf-cli init --project "My awesome app" --author "John Doe"
```

### 2. Scan your project

```bash
# Scan the current directory
rcf-cli .

# Output scan results as JSON
rcf-cli . --format json

# Print summary only
rcf-cli . --summary

### 3. Generate an RCF-Audit Report (Premium)

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
```

## Markers Reference

RCF uses semantic markers to define protection levels at the block or file level. Place these inside code comments:
- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:NOTICE]` — Triggers requirement for adjacent legal notice.

Example header for protected files:
```python
# NOTICE: This file is protected under RCF-PL v1.1
# [RCF:PROTECTED]
```

## Documentation

For full specification and legal framework details, visit the official site: **[rcf.aliyev.site](https://rcf.aliyev.site)**
