# RCF Versioning Policy

## Semantic Versioning for RCF Protocol

RCF follows [Semantic Versioning 2.0.0](https://semver.org/) with RCF-specific 
interpretations.

---

## Version Format

MAJOR.MINOR.PATCH

---


Example: `1.1.0`

---

## Version Components

### MAJOR (X.0.0)

**Breaking changes to protection scope**

- New categories of prohibited activities
- Changes to visibility rights
- Modified self-enforcement mechanisms
- Significant legal term changes

**Impact:** Projects using previous major versions may need to update 
LICENSE files and notify users.

### MINOR (0.X.0)

**New features and clarifications**

- Additional technical enforcement options
- New marker types
- Expanded documentation
- Non-breaking legal clarifications

**Impact:** Backwards compatible. Projects may adopt at their discretion.

### PATCH (0.0.X)

**Errata and non-substantive updates**

- Typo corrections
- Formatting improvements
- Link updates
- Non-legal text clarifications

**Impact:** No action required from adopting projects.

---

## Version Lifecycle
[DRAFT] → [ACTIVE] → [MAINTENANCE] → [DEPRECATED] → [ARCHIVED]

| Status | Meaning | Support |
|--------|---------|---------|
| Draft | Under development | None |
| Active | Current recommended version | Full support |
| Maintenance | Security fixes only | Limited support |
| Deprecated | No longer recommended | No support |
| Archived | Historical reference | Read-only |

---

## Current Versions

| Version | Status | Release Date | Notes |
|---------|--------|--------------|-------|
| 1.1 | Active | 2026 | Current stable |
| 1.0 | Maintenance | [DATE] | Security fixes only |
---

## Adoption Policy

### New Projects

Always adopt the latest **ACTIVE** version.

### Existing Projects

- **Same MAJOR:** May adopt new MINOR/PATCH at discretion
- **New MAJOR:** Evaluate impact, plan migration
- **DEPRECATED:** Plan migration within 12 months

### Migration Path

When updating MAJOR version:

1. Review `GOVERNANCE/CHANGELOG.md` for breaking changes
2. Update LICENSE file in your project
3. Update NOTICE.md if needed
4. Communicate changes to users
5. Update version reference in documentation

---

## Pre-Release Versions

Pre-release versions may be indicated with suffixes:

- `1.2.0-alpha` — Early testing
- `1.2.0-beta` — Feature complete, testing
- `1.2.0-rc1` — Release candidate

Pre-releases are NOT recommended for production use.

---

## Version History

See `GOVERNANCE/CHANGELOG.md` for detailed version history.