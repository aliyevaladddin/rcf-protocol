<!-- NOTICE: This file is protected under RCF-PL v1.3 -->
# CHANGELOG

All notable changes to the RCF Protocol project will be documented in this file.

## [1.2.8] - 2026-03-18

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
- **Version Synchronization**: Synchronized version `1.2.8` across all documentation, legal assets, and SDKs (NPM & PyPI).
- **Legal Assets**: Renamed `RCF-PL-1.2.6.md` to `RCF-PL-1.2.7.md` and updated internal notices.
- **Scanner Logic**: Updated CLI scanner to recognize the `v1.3` protection header.
- **Documentation**: Polished SDK READMEs and synchronized version badges.

---

## [1.2.6] - 2026-03-10

### Added
- **RCF-Audit Feature**: Introduced the `audit` command for generating cryptographically signed compliance reports.
- **SDK Parity**: Synchronized v1.3 across NPM and PyPI ecosystems.
