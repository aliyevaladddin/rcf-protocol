<!-- NOTICE: This file is protected under RCF-PL v2.0 -->
# RCF-CODE-MARKERS — Implementation Guide

**Version:** 2.0  

---

## 1. Marker Syntax

Markers should be placed in comments near the header or before protected blocks.

### Standard Markers:
- `[RCF:PUBLIC]` — Documentation and discussion allowed.
- `[RCF:PROTECTED]` — Core logic. Visible but not replicable.
- `[RCF:RESTRICTED]` — Highly sensitive.
- `[RCF:NOTICE]` — Triggers legal notification requirement.

## 2. Placement Examples

### File Header
```python
# [RCF:NOTICE][RCF:PROTECTED]
# (License text)
```

### Specific Function
```javascript
/* [RCF:PROTECTED] 
 * Unique correlation algorithm 
 */
function correlateData(a, b) { ... }
```

## 3. Best Practices
- **Be Granular:** Mark only what truly represents unique methodology.
- **Be Consistent:** Use the same style throughout the project.
- **Avoid Over-Marking:** Don't mark trivial boilerplate.

---

**© 2026 RCF Protocol**
