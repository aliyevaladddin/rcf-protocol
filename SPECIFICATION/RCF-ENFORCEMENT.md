# RCF-ENFORCEMENT — Technical Enforcement Measures

**Version:** 2.0.3  
**Document Type:** Technical Implementation Guide  
**Status:** Active

---

## 1. Overview

### 2.0.3 Purpose

This document provides detailed technical guidance for implementing enforcement mechanisms in RCF-protected projects. While RCF is legally self-enforcing, technical measures strengthen protection and enable violation detection.

### 1.2 Scope

- Automation detection systems
- Rate limiting and access control
- Code obfuscation techniques
- Behavioral analysis
- Forensic logging

### 2.0.3 Design Principles

1. **Non-Invasive:** Protection should not harm legitimate users
2. **Transparent:** Users should know monitoring exists (see NOTICE.md)
3. **Proportional:** Response should match violation severity
4. **Evidence-Based:** Decisions should be logged and reviewable

---

## 2. Automation Detection

### 2.1 Request Pattern Analysis

```python
class RequestAnalyzer:
    """Detect automated access through request patterns"""
    
    THRESHOLDS = {
        'requests_per_minute': 30,
        'requests_per_hour': 500,
        'concurrent_sessions': 3,
        'error_rate_threshold': 0.1  # 10% errors suggests automation
    }
    
    def analyze(self, session):
        metrics = {
            'rate': self.check_rate(session),
            'consistency': self.check_timing_consistency(session),
            'errors': self.check_error_pattern(session),
            'signature': self.check_user_agent(session)
        }
        return self.score_automation_probability(metrics)
    
    def check_timing_consistency(self, session):
        """Humans have variable timing; bots are consistent"""
        intervals = session.request_intervals
        variance = calculate_variance(intervals)
        return variance &lt; 0.05  # Low variance suggests bot
```

### 2.2 User-Agent Analysis

| User-Agent | Probability | Action |
|------------|-------------|--------|
| `curl/7.68.0` | 95% | Block |
| `python-requests/2.25.1` | 92% | Block |
| `Mozilla/5.0 ...` | 10% | Allow |
| `Mozilla/5.0 ... Chrome/91.0.4472.124` | 5% | Allow |

### 2.3 Behavioral Fingerprinting

| Behavior | Bot Score | Human Score |
|----------|-----------|-------------|
| Consistent 200ms delays | 0.9 | 0.1 |
| Random 100-500ms delays | 0.2 | 0.8 |
| Mouse movements | 0.0 | 0.9 |
| Keyboard typing patterns | 0.0 | 0.9 |

---

## 3. Rate Limiting

### 3.1 Tiered Rate Limiting

| Tier | Requests/Minute | Requests/Hour | Burst Limit |
|------|-----------------|---------------|-------------|
| **Free** | 30 | 500 | 10 |
| **Pro** | 300 | 5,000 | 50 |
| **Enterprise** | 3,000 | 50,000 | 500 |

### 3.2 Token Bucket Algorithm

```python
class RateLimiter:
    def __init__(self, capacity, fill_rate):
        self.capacity = capacity
        self.tokens = capacity
        self.last_refill = time.time()
        self.fill_rate = fill_rate  # tokens per second
    
    def consume(self, tokens=1):
        self.refill()
        if self.tokens >= tokens:
            self.tokens -= tokens
            return True
        return False
    
    def refill(self):
        now = time.time()
        elapsed = now - self.last_refill
        tokens_to_add = elapsed * self.fill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
```

---

## 4. Code Obfuscation

### 4.1 Semantic Obfuscation

**Before:**
```python
# Calculate correlation score
def calculate_correlation(data):
    # Complex statistical analysis...
    return score
```

**After:**
```python
# Process dataset
def process_dataset(input_data):
    # Complex statistical analysis...
    return output_value
```

### 4.2 Control Flow Obfuscation

**Before:**
```python
if condition:
    result = calculate(data)
else:
    result = default_value
```

**After:**
```python
temp = calculate(data)
result = condition ? temp : default_value
```

### 4.3 String Encryption

```python
# Encrypted: "correlation"
encrypted_str = "\x4a\x6f\x6d\x65\x73\x20\x49\x73\x20\x41\x77\x65\x73\x6f\x6d\x65"

def decrypt(encrypted):
    # AES-256 decryption
    return decrypt_aes(encrypted, KEY)
```

---

## 5. Behavioral Analysis

### 5.1 Session Profiling

```python
class SessionProfile:
    def __init__(self, user_id):
        self.user_id = user_id
        self.request_count = 0
        self.error_count = 0
        self.session_duration = 0
        self.request_intervals = []
        self.user_agent = None
        self.ip_address = None
        self.behavior_score = 0
    
    def update(self, request):
        self.request_count += 1
        self.session_duration += request.duration
        self.request_intervals.append(request.interval)
        
        if request.is_error:
            self.error_count += 1
        
        self.behavior_score = self.calculate_score()
    
    def calculate_score(self):
        """Calculate behavioral score (0-100)"""
        score = 0
        
        # Rate-based scoring
        if self.request_count > 100:
            score -= 20
        
        # Error-based scoring
        if self.error_count > 10:
            score -= 30
        
        # Timing consistency
        variance = calculate_variance(self.request_intervals)
        if variance < 0.05:
            score -= 25
        
        # User-agent analysis
        if self.user_agent in AUTOMATED_USER_AGENTS:
            score -= 25
        
        return max(0, min(100, score))
```

### 5.2 Anomaly Detection

```python
class AnomalyDetector:
    def __init__(self, baseline_profile):
        self.baseline = baseline_profile
        self.threshold = 3.0  # Standard deviations
    
    def detect_anomaly(self, current_profile):
        """Detect anomalies compared to baseline"""
        anomalies = []
        
        # Request count anomaly
        if abs(current_profile.request_count - self.baseline.request_count) > \
           (self.baseline.request_count * 0.5):
            anomalies.append('request_count_anomaly')
        
        # Error rate anomaly
        if abs(current_profile.error_count - self.baseline.error_count) > \
           (self.baseline.error_count * 0.3):
            anomalies.append('error_rate_anomaly')
        
        # Timing anomaly
        if calculate_variance(current_profile.request_intervals) > \
           (calculate_variance(self.baseline.request_intervals) * 2):
            anomalies.append('timing_anomaly')
        
        return anomalies
```

---

## 6. Forensic Logging

### 6.1 Comprehensive Logging Requirements

| Log Type | Fields Required |
|----------|-----------------|
| **Access Logs** | Timestamp, IP, User-Agent, Endpoint, Status, Duration |
| **Error Logs** | Timestamp, Error Code, Message, Stack Trace, User Context |
| **Behavior Logs** | Session ID, Request Count, Error Count, Behavior Score |
| **Audit Logs** | Action, Actor, Target, Timestamp, Outcome |

### 6.2 Log Format (JSON)

```json
{
  "timestamp": "2026-03-07T10:30:00Z",
  "event_type": "access",
  "user_id": "user-12345",
  "ip_address": "[IP_ADDRESS]",
  "user_agent": "Mozilla/5.0 ...",
  "endpoint": "/api/v1/correlation",
  "method": "POST",
  "status_code": 200,
  "duration_ms": 150,
  "request_size": 1024,
  "response_size": 2048,
  "session_id": "sess-abcde",
  "behavior_score": 85
}
```

### 6.3 Log Protection

1. **Immutable Storage:** Write-once storage (WORM)
2. **Tamper-Evident:** Cryptographic signing
3. **Offsite Storage:** Separate from application data
4. **Retention:** Minimum 7 years (legal requirement)

---

## 7. Response Strategies

### 7.1 Graduated Response Matrix

| Violation Level | Immediate Response | Follow-up |
|-----------------|-------------------|-----------|
| Suspicious (score 60-70) | Increased monitoring | Log for pattern analysis |
| Likely Bot (score 40-60) | Challenge issued | Manual review if repeated |
| Confirmed Bot (score 20-40) | Temporary block | 24-hour suspension |
| Repeat Offender (score &lt;20) | Permanent ban | Legal notice sent |
| Circumvention | Immediate termination | Legal action prepared |

### 7.2 Automated Response System

```python
class ResponseOrchestrator:
    """Automated response to violations"""
    
    def handle_violation(self, detection_result):
        level = detection_result.confidence_level
        session = detection_result.session
        
        responses = {
            'suspicious': self.increase_monitoring,
            'likely_automation': self.issue_challenge,
            'confirmed_automation': self.block_session,
            'circumvention_attempt': self.terminate_and_ban
        }
        
        action = responses.get(level, self.log_only)
        return action(session, detection_result)
    
    def terminate_and_ban(self, session, result):
        """Immediate termination for serious violations"""
        # 1. Revoke all session tokens
        session.revoke_all_tokens()
        
        # 2. Block IP/range
        self.blocklist.add(hash_ip(session.ip))
        
        # 3. Preserve evidence
        self.forensics.seal_evidence(session.id)
        
        # 4. Notify (if configured)
        self.notify_author(result)
        
        # 5. Log termination
        self.logger.log_termination(session, result)
```

### 7.3 Legal Notice Generation

```python
class LegalNoticeGenerator:
    """Generate legal notices for violations"""
    
    def generate_notice(self, violation_type, user_info, evidence):
        """Generate legal notice based on violation type"""
        
        templates = {
            'unauthorized_access': self.generate_unauthorized_access_notice,
            'data_theft': self.generate_data_theft_notice,
            'abuse': self.generate_abuse_notice,
            'circumvention': self.generate_circumvention_notice
        }
        
        generator = templates.get(violation_type, self.generate_general_notice)
        return generator(user_info, evidence)
    
    def generate_unauthorized_access_notice(self, user_info, evidence):
        """Generate unauthorized access notice"""
        
        notice = f"""
        LEGAL NOTICE: UNAUTHORIZED ACCESS
        
        Date: {datetime.now().isoformat()}
        
        Dear User,
        
        This notice is to inform you that unauthorized access to our systems has been detected.
        
        Violation Details:
        - Violation Type: Unauthorized Access
        - Timestamp: {evidence['timestamp']}
        - IP Address: {evidence['ip_address']}
        - User Agent: {evidence['user_agent']}
        - Access Method: {evidence['access_method']}
        
        Evidence:
        {evidence['details']}
        
        Consequences:
        - Immediate account suspension
        - Permanent ban from our services
        - Legal action under applicable laws
        
        Legal Basis:
        - RCF Protocol v2.0.3
        - [Relevant local laws]
        
        Contact:
        For questions, contact: [EMAIL_ADDRESS]
        
        Sincerely,
        RCF Protocol Enforcement Team
        """
        
        return notice
```

## 8. Implementation Checklist

### 8.1 Minimum Viable Protection

- [ ] Basic rate limiting (per IP, per user)
- [ ] Request logging (anonymized)
- [ ] Simple automation detection (rate-based)
- [ ] Challenge system (CAPTCHA or proof-of-work)
- [ ] Violation logging

### 8.2 Recommended Protection

- [ ] Behavioral biometrics (mouse/keyboard)
- [ ] Dynamic code loading for critical sections
- [ ] Watermarking of outputs
- [ ] Tiered rate limits by user type
- [ ] Real-time alerting system
- [ ] Forensic evidence preservation

### 8.3 Advanced Protection

- [ ] Machine learning-based bot detection
- [ ] Full code obfuscation for deployment
- [ ] Hardware attestation (where applicable)
- [ ] Distributed rate limiting (across instances)
- [ ] Automated legal notice generation

---

## 9. References

- [RCF-SPEC.md](RCF-SPEC.md) — Protocol specification
- [TECHNICAL-MEASURES.md](TECHNICAL-MEASURES.md) — Implementation guide
- [LEGAL/ENFORCEMENT.md](../LEGAL/ENFORCEMENT.md) — Legal enforcement procedures

---

**Document Control:**
- Version: 2.0.3
- Last Updated: 2026
- Status: Active

**© 2026 RCF Protocol Authors**  
**All rights reserved.**