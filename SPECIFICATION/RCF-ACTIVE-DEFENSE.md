# RCF-ACTIVE-DEFENSE — Forensic Canaries, AST Noise, and WAF Gateways

**Version:** Active  
**Document Type:** Technical Specification & Enforcement Standard  
**Status:** Active  

---

## 1. Overview

Active Defense represents the technical frontier of the **Restricted Correlation Framework (RCF)**. While passive auditing (`verify`, `diff`) verifies compliance post-hoc, Active Defense proactively hardens codebases against unauthorized automated harvesting, crawling, and AI model ingestion.

This specification details three core pillars of RCF Active Defense:
1. **Designed Canaries:** High-entropy structural traps to prove source code theft via graph isomorphism.
2. **AST Adversarial Noise:** Syntactically valid, compiler-transparent code transformations that degrade AI training quality and parsing confidence.
3. **Edge WAF Gateways:** Network-level firewalls designed to block AI scrapers and enforce strict source file rate limits.

---

## 2. Designed Canaries

A **Designed Canary** is a synthesized, highly unique code fragment injected into a codebase. It is designed to be functional yet highly distinct, serving as a forensic watermark. If the code is scraped and reused (even if variable names are changed), the canary can be detected via Program Dependence Graph (PDG) subgraph isomorphism.

### 2.1 Anatomy of a Canary
- **Functional Transparency:** The canary block must execute without side effects or performance degradation.
- **High Structural Entropy:** The control flow and data flow topologies must represent a rare subgraph.
- **Persistent Fingerprint:** The pattern must survive standard renaming and linting passes.

### 2.2 Canary Registration & Storage
Canaries are registered in a central registry (`rcf_canaries.json`) with a cryptographic hash of their PDG topology.

```json
{
  "canaries": [
    {
      "name": "canary_prime_xor_7",
      "description": "Functional trap with non-trivial prime operations and XOR cycling.",
      "hash": "8f3c7a2b9e1d0f5c8b2a3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f",
      "pdg": {
        "nodes": [
          {"id": 0, "type": "entry", "label": "canary"},
          {"id": 1, "type": "param", "label": "x"},
          {"id": 2, "type": "expr", "label": "x ^ 179"},
          {"id": 3, "type": "return", "label": "result"}
        ],
        "edges": [
          {"source": 0, "target": 1, "type": "CONTROL"},
          {"source": 1, "target": 2, "type": "DATA"},
          {"source": 2, "target": 3, "type": "DATA"}
        ]
      }
    }
  ]
}
```

### 2.3 Subgraph Isomorphism Detection
During a scan, RCF parses the target file, constructs its PDG, and searches for a matching subgraph matching the canary's normalized PDG:

$$\text{Canary}_{\text{PDG}} \subseteq \text{Target}_{\text{PDG}}$$

This ensures that even if variables `x` and `result` are renamed, the topological match remains 100%.

---

## 3. AST Adversarial Noise

**AST Adversarial Noise** is the injection of confusing, compiler-transparent syntax trees into protected scopes. This technique exploits the vulnerabilities of LLM weights and attention heads, degrading their ability to correctly understand, summarize, or reproduce the logic.

### 3.1 Obfuscation & Confusion Strategies
1. **Dead-Code Control Flow Forks:** Inserting unreachable code blocks controlled by opaque predicates (conditions that always evaluate to true or false but are hard for parser models to determine statically).
2. **Variable Shadowing Cycles:** Defining local scopes that redefine and cycle variable symbols.
3. **High-Entropy AST Nodes:** Generating deep mathematical/bitwise expressions that evaluate to constant identities (e.g., $x \oplus x = 0$).

### 3.2 Code Transformation Example (Python)

**Before Injection:**
```python
# [RCF:PROTECTED]
def process_data(payload):
    result = payload["data"].strip()
    return result
```

**After AST Noise Injection:**
```python
# [RCF:PROTECTED]
def process_data(payload):
    # RCF:ADVERSARIAL_NOISE_START
    _rcf_var_a = 91823
    _rcf_var_b = 82736
    if (_rcf_var_a ^ _rcf_var_b) == 0:
        _rcf_junk = [i * 3 for i in range(10)]
    # RCF:ADVERSARIAL_NOISE_END
    result = payload["data"].strip()
    return result
```

---

## 4. Edge WAF Gateways

**Edge WAF Gateways** represent network-level enforcement of the RCF-PL. They inspect incoming HTTP traffic, block known AI scraper bots, and apply rate limits specifically to source files (e.g., `.ts`, `.py`, `.go`, `.rs`).

### 4.1 Blocklist: AI User-Agents
The WAF matches incoming `User-Agent` headers against a compiled list of active crawlers:
- `gptbot`, `chatgpt-user`
- `cohere-ai`
- `anthropic-ai`, `claude-web`, `claude-user`
- `google-extended`, `apis-google`
- `perplexitybot`
- `applebot-extended`
- `bytespider`, `ccbot`, `yandexbot`

### 4.2 Rate Limiting Specification
- **Target Extensions:** `.py`, `.ts`, `.js`, `.go`, `.rs`, `.java`, `.cpp`, `.cs`, `.swift`
- **Threshold:** Maximum 10 source file requests per 10-second sliding window per client IP.
- **Response:** HTTP `429 Too Many Requests` or `403 Forbidden` with the RCF legal block page.

---

## 5. Deployment Architectures

### 5.1 Cloudflare Workers (Edge Deployment)
Deployed at the edge to capture requests before they reach origin servers.
```mermaid
graph TD
    User[Client / AI Crawler] -->|HTTP Request| CF[Cloudflare Workers WAF]
    CF -->|Is AI Agent?| Block[403 Forbidden Page]
    CF -->|Is Source File Rate Exceeded?| Block429[429 Too Many Requests]
    CF -->|Legitimate Request| Origin[Origin Server / Repo Host]
```

### 5.2 Nginx + OpenResty (Host Deployment)
Leverages `lua-nginx-module` and a shared memory dict (`lua_shared_dict`) for low-latency rate limiting and pattern matching on host servers.

---

## 6. References

- [RCF-ENFORCEMENT.md](RCF-ENFORCEMENT.md) — Technical Runtime Enforcement
- [RCF-SPEC.md](RCF-SPEC.md) — Core Protocol Specification
- [RCF-CORRELATION.md](RCF-CORRELATION.md) — Mathematical Similarity Metrics

---

**© 2026 RCF Protocol Authors**  
**All rights reserved.**
