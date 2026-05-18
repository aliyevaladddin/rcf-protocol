# RCF-API-GUIDELINES — Protocol Standards

**Version:** Active  

---

## 1. Meta-Headers

RCF-compliant APIs SHOULD include custom HTTP headers:
- `X-RCF-Notice: PROTECTED_METHODOLOGY`
- `X-RCF-License: RCF-PL`

## 2. Response Constraints

### Data Minimization
Do not expose internal correlation keys in public API responses.

### Visibility Flags
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
