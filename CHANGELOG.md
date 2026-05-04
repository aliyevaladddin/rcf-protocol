<!-- NOTICE: This file is protected under RCF-PL v2.0.4 -->
# CHANGELOG

All notable changes to the RCF Protocol project will be documented in this file.

## [2.0.3.0] - 2026-04-12

### Added
- **TypeScript SDK Parity**: Achieve 100% feature parity with Python v2.0.4.
- **Modern ESM Architecture**: Migrated Node.js implementation to pure ESM (NodeNext).
- **Core Engine v2.0.4**:
    - High-fidelity heuristic scanner with 14+ language support.
    - Standardized `audit`, `diff`, and `verify` commands for both ecosystems.
- **CI/CD Integration**: Official support for `rcf-guardian` with automated compliance enforcement.

### Changed
- **Protocol Standardization**: Unified markers, headers, and audit schemas across all implementations.
- **Improved Heuristics**: Added support for abstract classes, interfaces, and decorators across languages.

---

## [2.0.3] - 2026-03-18

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
- **Version Synchronization**: Synchronized version `2.0.3` across all documentation, legal assets, and SDKs (NPM & PyPI).
- **Legal Assets**: Renamed `RCF-PL-2.0.3.md` to `RCF-PL-2.0.3.md` and updated internal notices.
- **Scanner Logic**: Updated CLI scanner to recognize the `v2.0.4` protection header.
- **Documentation**: Polished SDK READMEs and synchronized version badges.

---

## [2.0.3] - 2026-03-10

### Added
- **RCF-Audit Feature**: Introduced the `audit` command for generating cryptographically signed compliance reports.
- **SDK Parity**: Synchronized v2.0.4 across NPM and PyPI ecosystems.
