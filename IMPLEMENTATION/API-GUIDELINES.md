# RCF-API-GUIDELINES — Protocol Standards

**Version:** 2.0.1  

---

## 1. Meta-Headers

RCF-compliant APIs SHOULD include custom HTTP headers:
- `X-RCF-Notice: PROTECTED_METHODOLOGY`
- `X-RCF-License: RCF-PL-2.0.1`

## 2. Response Constraints

### 2.1 Data Minimization
Do not expose internal correlation keys in public API responses.

### 2.2 Visibility Flags
Include marker information in JSON responses:
```json
{
  "api_status": "PUBLIC",
  "methodology": "RCF:PROTECTED",
  "data": { ... }
}
```

---

**© 2026 RCF Protocol**
