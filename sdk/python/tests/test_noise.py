import tempfile
from pathlib import Path
from rcf_core import inject_adversarial_noise_python

def test_inject_adversarial_noise():
    source = """# [RCF:PROTECTED]
def compute(x):
    return x + 1
"""
    result = inject_adversarial_noise_python(source)
    assert "_rcf_" in result
    assert "def compute(x):" in result
    assert "return x + 1" in result

    # Check idempotency
    result2 = inject_adversarial_noise_python(result)
    assert result2 == result
