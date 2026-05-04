# Security Policy

## Supported Versions

RCF Protocol and associated tools receive security updates for the following versions:

| Version | Status | Support Until |
|---------|--------|---------------|
| 1.1.x   | ✅ Active | 2027-03-01 |
| 1.0.x   | ⚠️ Maintenance | 2026-06-01 |
| &lt; 1.0   | ❌ End of Life | - |

## Reporting a Vulnerability

### Where to Report

**Email:** aladdin@aliyev.site  
**PGP Key:** [Download](https://aliyev.site/rcf/pgp-key.txt)  
**Fingerprint:** `A1B2 C3D4 E5F6 7890 1234 5678 90AB CDEF 1234 5678`

### What to Include

1. **Description** — What is the vulnerability?
2. **Impact** — Who could exploit this and what could they access?
3. **Reproduction** — Steps to reproduce the issue
4. **Environment** — Version, OS, Python version
5. **Proof of Concept** — Code or demonstration (if possible)

### Response Timeline

| Stage | Timeframe |
|-------|-----------|
| Acknowledgment | Within 48 hours |
| Initial Assessment | Within 7 days |
| Fix Development | Depends on severity |
| Public Disclosure | After fix released |

### Severity Classification

| Level | Description | Example | Response |
|-------|-------------|---------|----------|
| **Critical** | Remote code execution, data breach | RCE in CLI tool | 24-48 hours |
| **High** | Privilege escalation, authentication bypass | Bypass license check | 7 days |
| **Medium** | Information disclosure, DoS | Marker bypass | 14 days |
| **Low** | Best practice violations, minor issues | Typo in error message | Next release |

## What to Expect

### If Accepted
- Regular updates on fix progress
- Credit in security advisory (unless anonymous requested)
- Coordinated disclosure timeline

### If Declined
- Clear explanation of why
- Alternative recommendations if applicable
- No legal action for good-faith reports

## Security Measures in RCF

### Technical Protections
- Rate limiting on validation endpoints
- Input sanitization in CLI parsers
- No network calls without explicit opt-in
- Audit logging for compliance checks

### Code Integrity
- Signed releases on PyPI
- SHA-256 checksums for all distributions
- GPG-signed git tags

## Past Advisories

| Date | CVE | Description | Affected | Fixed |
|------|-----|-------------|----------|-------|
| None yet | - | - | - | - |

---

**Thank you for helping keep RCF Protocol secure!**

*This policy is adapted from [GitHub's Security Policy template](https://github.com/github/securitylab/blob/main/docs/security-policy.md).*
