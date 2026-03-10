# RCF Protocol — TypeScript SDK

The official TypeScript/JavaScript SDK and Command Line Interface for the **RCF (Restricted Correlation Framework) Protocol**.

RCF is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights**.

## Installation

Install via NPM:

```bash
# Install globally to use the CLI anywhere
npm install -g rcf-protocol

# Or install as a dev dependency in your project
npm install -D rcf-protocol
```

## Features

- **Standardized Markers Check**: Identify `[RCF:PUBLIC]`, `[RCF:PROTECTED]`, `[RCF:RESTRICTED]`, and `[RCF:NOTICE]` markers in your codebase.
- **Header Validation**: Ensure files have the required `NOTICE: This file is protected under RCF-PL v1.1` header.
- **Automated Scanning**: Quickly scan projects for compliance.
- **RCF-Audit (Premium)**: Generate cryptographically signed compliance reports for enterprise auditing.


## CLI Usage

The `rcf-cli` binary allows for quick compliance verification of your project.

```bash
# Scan the current directory
rcf-cli .

# Scan with custom ignore list (in addition to .rcfignore)
rcf-cli . --ignore node_modules,dist,.git

# Generate an RCF-Audit Report (Requires License)
rcf-cli audit . --license-key YOUR_RCF_AUDIT_KEY
```

## Markers Reference

RCF uses semantic markers to define protection levels at the block or file level. Place these inside code comments:
- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:NOTICE]` — Triggers requirement for adjacent legal notice.

Example header for protected files:
```javascript
// NOTICE: This file is protected under RCF-PL v1.1
// [RCF:PROTECTED]
```

## Documentation

For full specification and legal framework details, visit the official site: **[rcf.aliyev.site](https://rcf.aliyev.site)**
