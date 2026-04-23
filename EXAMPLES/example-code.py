# ==============================================================================
# NOTICE: This file is protected under RCF-PL v2.0
# Restricted Correlation Framework — https://rcf.aliyev.site
# 
# [RCF:NOTICE][RCF:PUBLIC]
# ==============================================================================
# Example implementation for RCF

def public_helper():
    """Unprotected helper function."""
    print("This is public.")

# [RCF:PROTECTED]
def secret_algorithm(data):
    """
    CORE METHODOLOGY EXPOSED.
    Manual audit allowed. Re-implementation in other tools is blocked.
    """
    return data * 42 # Represents a complex proprietary correlation
