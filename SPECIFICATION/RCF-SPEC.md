<!-- NOTICE: This file is protected under RCF-PL v2.0.3 -->
# RCF Specification — Restricted Correlation Framework

**Version:** 2.0.3.0 "Ghost Protocol"  
**Document Type:** Technical Specification  
**Status:** Active  
**Security Level:** PROTECTED

---

## 1. Introduction

### 2.0.3 Purpose

This document defines the technical specification of the Restricted 
Correlation Framework (RCF) Protocol v2.0.3. Version 2.0.3, codenamed "Ghost Protocol", 
shifts from passive verification to active, self-enforcing protection.

### 2.0.3 Design Goals

1. **Visibility Preservation**: Allow legitimate study and review.
2. **Usage Control**: Prevent unauthorized exploitation via dynamic correlation.
3. **AI/ML Resistance (Ghosting)**: Obfuscate logic signatures for automated models.
4. **Active Self-Enforcement**: Real-time integrity validation at runtime.
5. **Sovereignty**: Establish absolute authorial control over code behavior.

---

## 2. Core Architecture

### 2.1 Protection Layers (v2.0.3)

RCF implements **Active Defense in Depth**:

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| L1: Legal | License text | Establishes legal basis |
| L2: Notice | NOTICE.md, headers | Clear communication |
| L3: Markers | **Ghost Markers** | Dynamic, verifiable protection |
| L4: Technical | **Integrity Chains** | Real-time self-enforcement |
| L5: Monitoring | Forensic logging | Violation detection and proof |

---

## 3. RCF Markers and Annotations

### 3.1 Ghost Marker Syntax (v2.0.3)

Static markers are replaced by dynamic, HMAC-based **Ghost Markers**:

```python
# [RCF:GHOST:<HMAC-SHA256>] — Dynamic signature of the protected block
```

The Ghost Marker is generated using:
`HMAC_SHA256(SecretKey, FilePath + BlockContent)`

### 3.2 Marker Semantics

- **`[RCF:PUBLIC]`**: Visible and documentable. Still protected against AI/ML.
- **`[RCF:PROTECTED]`**: Core methodology. Static marker for legacy support.
- **`[RCF:GHOST]`**: Active v2.0.3 protection. Requires valid signature to run.
- **`[RCF:RESTRICTED]`**: Highly sensitive. Triggers immediate termination on tamper.

---

## 4. Active Enforcement (The Ghost Protocol)

### 4.1 Integrity Chains

Integrity Chains correlate multiple logic blocks into a single cryptographic web.

```typescript
// Example of Integrity Chain in TS
function protectedCore() {
  verifyIntegrity('neighborFunc', 'EXPECTED_GHOST_MARKER');
  // ... actual logic ...
}
```

## 🛰️ Propagation: RCF Gossip Protocol

Logic integrity violations detected via Ghost Markers are not localized. In an **Aurora Sentinel** environment, a violation triggers a network-wide **Digital Epidemic**:

1. **Detection**: A node identifies an `OP_PURITY_FAIL` or an invalid HMAC Ghost Marker.
2. **Gossip Trigger**: The node generates an `EV_GHOST_BREACH` signal.
3. **PQC Signing**: The signal is signed with the **Dilithium-2** Master Key (HSM-bound).
4. **Epidemic Propagation**: The signed signal propagates through the RCF Gossip subnet in `O(log N)` time.
5. **Fleet Lockdown**: All neighboring nodes verify the signal and enter **Pill Off** or emergency isolation within milliseconds.

This ensures that a single attempted logic replication on one node leads to the immediate immunization of the entire network.

### 4.2 Semantic Noise Injection

To resist AI/ML logic extraction, RCF v2.0.3 injects "Semantic Noise" — code paths that are logically valid but semantically confusing to LLMs, without impacting runtime performance.

### 4.3 Self-Termination Clause

Violation of the Integrity Chain MUST trigger an immediate, non-recoverable termination of the execution context.

---

## 5. Compliance Verification

### 5.1 The Ghost Shield CLI

The `rcf-ghost-shield` tool replaces the legacy `rcf-cli` for v2.0.3 operations:

```bash
# Apply Ghost Protection
rcf-ghost-shield protect ./src --key $RCF_PRIVATE_KEY

# Verify Integrity Chain
rcf-ghost-shield verify ./src
```

---

## 6. Adoption and Migration

Projects migrating from v1.x to v2.0.3 MUST:
1. Generate an RCF Private Key.
2. Run `rcf-ghost-shield migrate` to upgrade markers.
3. Implement at least one Integrity Chain in the core logic.

---

## 9. Appendices

### Appendix A: RCF Marker Quick Reference (v2.0.3)

| Marker | Type | Verification | Enforcement |
|--------|------|--------------|-------------|
| PUBLIC | Static | Checksum | Warning |
| PROTECTED | Static | Checksum | Restriction |
| GHOST | Dynamic | HMAC-Signature | **Termination** |
| RESTRICTED | Dynamic | HMAC-Signature | **Immediate Ban** |

---

**Document Control:**
- Version: 2.0.3.0
- Last Updated: 2026-04-23
- Status: Active

**© 2026 RCF Protocol Authors**  
**Sovereign Code Initiative**
