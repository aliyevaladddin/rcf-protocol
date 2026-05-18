<!-- NOTICE: This file is protected under RCF-PL -->
# RCF-TECHNICAL-MEASURES — Implementation Guide

**Version:** Active  

---

## 1. Visibility Controls

### Rate Limiting
- **Human Speed:** Limit access to ~3 file Reads per minute for unauthenticated users.
- **Burst Protection:** Allow small bursts but require cooldowns.

### Access Gating
- Require simple acknowledgment of RCF terms before displaying `[RCF:PROTECTED]` content.

## 2. Anti-Automation

### Behavioral Detection
- Monitor timing variance between requests.
- Track mouse/scroll movement in web environments.

### Proof-of-Work (PoW)
- For high-frequency API access, require PoW to increase the cost of automated extraction.

---

**© 2026 RCF Protocol**
