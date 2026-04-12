<!-- NOTICE: This file is protected under RCF-PL v1.3 -->
# RCF-TECHNICAL-MEASURES — Implementation Guide

**Version:** 1.1  

---

## 1. Visibility Controls

### 1.1 Rate Limiting
- **Human Speed:** Limit access to ~3 file Reads per minute for unauthenticated users.
- **Burst Protection:** Allow small bursts but require cooldowns.

### 1.2 Access Gating
- Require simple acknowledgment of RCF terms before displaying `[RCF:PROTECTED]` content.

## 2. Anti-Automation

### 2.1 Behavioral Detection
- Monitor timing variance between requests.
- Track mouse/scroll movement in web environments.

### 2.2 Proof-of-Work (PoW)
- For high-frequency API access, require PoW to increase the cost of automated extraction.

---

**© 2026 RCF Protocol**
