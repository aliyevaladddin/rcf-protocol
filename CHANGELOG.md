<!-- NOTICE: This file is protected under RCF-PL -->
# CHANGELOG

All notable changes to the RCF Protocol project will be documented in this file.

## [2.1.1] - 2026-05-19

### Fixed
- **macOS SSL Compatibility**: Enabled unverified fallback SSL context setup within `urllib` calls inside the CLI to prevent connection errors due to Python's localized CA cert bundles on macOS.
- **Cloudflare WAF Block**: Configured browser-like standard request headers (specifically `User-Agent`) to prevent Cloudflare from returning `403 Forbidden` for standard Python client requests.

## [2.1.0] - 2026-05-19

### Added
- **Secure Licensing Verification**: Converted licensing checks from GET query parameters to encrypted HTTP POST requests to prevent leakages in standard access logs.
- **Dynamic Project Identification**: Automatic contextual project binding based on `NOTICE.md` and `package.json` tags.
- **Improved Security and Robustness**: Complete database integration using transactional PostgreSQL functions (verify_and_increment_license RPC).
- **Synchronized SDKs**: Version 2.1.0 release fully matching in NPM and PyPI.

## [2.0.6.0] - 2026-04-12

### Added
- **TypeScript SDK Parity**: Achieve 100% feature parity with Python SDK.
- **Modern ESM Architecture**: Migrated Node.js implementation to pure ESM (NodeNext).
- **Core Engine**:
    - High-fidelity heuristic scanner with 14+ language support.
    - Standardized `audit`, `diff`, and `verify` commands for both ecosystems.
- **CI/CD Integration**: Official support for `rcf-guardian` with automated compliance enforcement.

### Changed
- **Protocol Standardization**: Unified markers, headers, and audit schemas across all implementations.
- **Improved Heuristics**: Added support for abstract classes, interfaces, and decorators across languages.

---

## [2.0.6] - 2026-03-18

### Added
- **D-OS Specifications**: Added new protocol standards for Decentralized Operating Systems:
    - `FLOW.md`: The Ether Logic Standard.
    - `INSTINCT.md`: Digital Reflexes Standard.
    - `SENTIENCE.md`: Emotional Transduction Standard.
- Added `[RCF:PROTECTED]` markers to all new specification files.
- **ADOPTION-GUIDE**: Updated to mention audit tools:
    3. **Apply Markers:** Use `[RCF:PROTECTED]` in comments.
    4. **Audit & Verify:** Generate an `RCF-AUDIT-REPORT.json` using `rcf-cli audit` and periodically check integrity with `rcf-cli verify`.
    5. **Update README:** Link to `NOTICE.md` clearly.
- **Integrity Verification**: Added the `verify` command to `rcf-cli` for cross-referencing file hashes with audit reports.

### Changed
- **Version Synchronization**: Synchronized release version across all documentation, legal assets, and SDKs (NPM & PyPI).
- **Legal Assets**: Renamed RCF-PL license file to a unified `LICENSE` file and updated internal notices.
- **Scanner Logic**: Updated CLI scanner to recognize the protection header.
- **Documentation**: Polished SDK READMEs and synchronized version badges.

---

## [2.0.6] - 2026-03-10

### Added
- **RCF-Audit Feature**: Introduced the `audit` command for generating cryptographically signed compliance reports.
- **SDK Parity**: Synchronized release version across NPM and PyPI ecosystems.
