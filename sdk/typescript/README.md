<!-- NOTICE: This file is protected under RCF-PL -->
# RCF CLI — TypeScript Edition 🛡️⚡

The official TypeScript/Node.js Command Line Interface for the **RCF (Restricted Correlation Framework) Protocol Active Integrity & Audit Framework**.

RCF is an author-defined licensing protocol designed to protect intellectual property in the age of automated extraction and AI/ML mass replication. It creates a clear legal and technical boundary between **Visibility** and **Usage Rights using cryptographic integrity chains.

## Installation

Install globally via NPM:

```bash
npm install -g rcf-protocol
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
# Verify integrity against audit report
rcf-cli verify .

# Verify with secret key (HMAC integrity chain check)
rcf-cli verify . --key YOUR_SECRET_KEY

# Verify a single file against a specific report
rcf-cli verify src/algo.ts --against RCF-AUDIT-REPORT.json
```

### 3. Generate an RCF-Audit Report

```bash
rcf-cli audit .
```

The audit generates a `RCF-AUDIT-REPORT.json` file containing SHA-256 hashes and markers for all protected assets. This report is used by `verify` and `diff` commands.

### 4. Verify Project Integrity

Compare current files with the latest audit report:

```bash
rcf-cli verify .

# With secret key for HMAC integrity chain verification
rcf-cli verify . --key YOUR_SECRET_KEY --verbose
```

### 5. Diff for CI/CD

Compare current marker state against the audit report (exits with code 1 if violations found):

```bash
rcf-cli diff .
rcf-cli diff . --verbose
```

### 6. Auto-protect unprotected logic

```bash
# Preview what would be marked
rcf-cli protect . --dry-run

# Apply markers
rcf-cli protect .
```

### 7. Apply Audit Integrity Markers (HMAC Integrity Chains)

```bash
rcf-cli audit-protect . --key YOUR_SECRET_KEY
rcf-cli audit-protect . --key YOUR_SECRET_KEY --dry-run
```

### 8. Forensic Analysis & Code Similarity

The TypeScript SDK CLI includes commands to analyze code uniqueness, generate watch-lists (sentinels), and compute similarity proof reports.

#### Build Background Corpus
Builds a probability database of language structures (`p_nat.json`) using standard library and project files:
```bash
rcf-cli build-corpus src/ --project . --out tests/corpus.json
```

#### Rank Sentinels (Watch-List)
Surfaces the highest-surprisal-mass functions in a codebase that are the most unique and worth watching:
```bash
rcf-cli sentinel . --corpus tests/corpus.json --top 5
```

#### Build Null Distribution Model
Calibrates a Monte Carlo null distribution (`null_model.json`) of similarity scores for independent code pairs:
```bash
rcf-cli build-null src/ --project . --corpus tests/corpus.json --n-pairs 1000 --out tests/null_model.json
```

#### Compute Similarity Proof (Prove)
Compares two files and calculates statistical significance (Z-score, p-empirical, p-parametric, E-value):
```bash
rcf-cli prove src/core/wl.ts src/core/wl.ts --corpus tests/corpus.json --null tests/null_model.json --search-space 1
```

#### Register and Scan Designed Canaries
Register a functional canary to track code theft:
```bash
# Register canary
rcf-cli canary register --name "my_canary" --desc "integrity check" --source "function c(x) { return x ^ 0xAB; }" --registry tests/rcf_canaries.json

# Scan codebase for the canary
rcf-cli canary scan . --registry tests/rcf_canaries.json
```

#### AST Adversarial Noise
Inject adversarial AST structures into protected files to break AI models trying to analyze the code:
```bash
rcf-cli noise src/
```

#### Export WAF Gateway
Exports production-ready Edge/WAF configurations to protect repositories and assets from AI scrapers and automated bots:
```bash
# Export Cloudflare Worker WAF script (cloudflare_worker.ts)
rcf-cli gateway cloudflare --out ./output_dir

# Export Nginx Lua WAF script (rcf_waf.lua) and nginx.conf snippet
rcf-cli gateway nginx --out ./output_dir
```

## Markers Reference

RCF uses semantic markers to define protection levels. Place these inside code comments:
- `[RCF:PUBLIC]` — Architecture and public concepts. Safe to discuss.
- `[RCF:PROTECTED]` — Core methodology. Visible but **not replicable**.
- `[RCF:RESTRICTED]` — Highly sensitive implementation. Minimal rights.
- `[RCF:AUDIT:HASH]` — Cryptographic marker for active integrity verification.

Example header for protected files:
```typescript
// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]
// [RCF:AUDIT:6A...F3]
```

## Documentation

For full specification and legal framework details, visit the official site: **[aliyev.site/rcf](https://aliyev.site/rcf)**
