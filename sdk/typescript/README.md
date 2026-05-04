<!-- NOTICE: This file is protected under RCF-PL v2.0.3 -->
# RCF Ghost Shield — TypeScript Edition 🛡️⚡

The official TypeScript/Node.js Command Line Interface for the **RCF (Restricted Correlation Framework) Protocol v2.0.3 "Ghost Protocol"**.

RCF is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights** using cryptographic integrity chains.

## Installation

Install via NPM:

```bash
npm install -g rcf-protocol
```

## Features

- **Ghost Shield Protection**: Active enforcement of RCF-PL v2.0.3 standards across your codebase.
- **Project Initialization**: Instantly generate `NOTICE.md` and `.rcfignore` files to protect your project.
- **Automated Scanning**: Quickly scan projects for RCF compliance and extract Ghost Markers.
- **Header Validation**: Ensure files have the required `NOTICE: This file is protected under RCF-PL v2.0.3` header.
- **RCF-Audit v2.0.3**: Generate cryptographically signed compliance reports for enterprise auditing.
- **Integrity Chains**: Compare current file hashes and Ghost Markers against an audit report to detect unauthorized modifications, tampering, or "Void Shell" imitations.


## CLI Usage

### 1. Initialize RCF Ghost Shield in your project

Run this in your project's root directory to generate the legal notice:

```bash
rcf-ghost-shield init --project "My awesome app" --author "Aladdin Aliyev"
```

### 2. Scan your project

```bash
# Verify integrity against audit report
rcf-ghost-shield verify .

# Verify with Ghost Protocol key (HMAC chain check)
rcf-ghost-shield verify . --key YOUR_SECRET_KEY

# Verify a single file against a specific report
rcf-ghost-shield verify src/algo.ts --against RCF-AUDIT-REPORT.json
```

### 3. Generate an RCF-Audit Report (v2.0.3)

```bash
# Provide license key via flag
rcf-ghost-shield audit . --license-key RCF-AUDIT-XXXX-XXXX

# Or use environment variable
export RCF_LICENSE_KEY=RCF-AUDIT-XXXX-XXXX
rcf-ghost-shield audit .
```

The audit generates a `RCF-AUDIT-REPORT.json` file containing SHA-256 hashes and markers for all protected assets. This report is used by `verify` and `diff` commands.

### 4. Verify Project Integrity

Compare current files with the latest audit report:

```bash
rcf-ghost-shield verify .

# With Ghost Protocol key for HMAC chain verification
rcf-ghost-shield verify . --key YOUR_SECRET_KEY --verbose
```

### 5. Diff for CI/CD

Compare current marker state against the audit report (exits with code 1 if violations found):

```bash
rcf-ghost-shield diff .
rcf-ghost-shield diff . --verbose
```

### 6. Auto-protect unprotected logic

```bash
# Preview what would be marked
rcf-ghost-shield protect . --dry-run

# Apply markers
rcf-ghost-shield protect .
```

### 7. Apply Ghost Markers (HMAC Integrity Chains)

```bash
rcf-ghost-shield ghost-protect . --key YOUR_SECRET_KEY
rcf-ghost-shield ghost-protect . --key YOUR_SECRET_KEY --dry-run
```

## Markers Reference

RCF uses semantic markers to define protection levels. Place these inside code comments:
- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:GHOST:HASH]` — **New in v2.0.3**: Cryptographic marker for active integrity verification.

Example header for protected files:
```typescript
// NOTICE: This file is protected under RCF-PL v2.0.3
// [RCF:PROTECTED]
// [RCF:GHOST:6A...F3]
```

## Documentation

For full specification and legal framework details, visit the official site: **[aliyev.site/rcf](https://aliyev.site/rcf)**
