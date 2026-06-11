# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
rcf_core — RCF v3 correlation engine (Research / Draft).

Implements the mathematical core specified in SPECIFICATION/RCF-CORRELATION.md:
source -> PDG (language-independent dependence graph) labeled over the Σ alphabet
(SPECIFICATION/RCF-SIGMA.md, sigma.json).

This package is deliberately separate from rcf_cli: rcf_cli is the stable,
shipped CLI; rcf_core is the research engine. They share nothing but intent.
"""

from .sigma import Sigma, SigmaError, load_sigma
from .pdg import PDG
from .normalize_python import normalize_python
from .wl import wl_features
from .correlate import correlate, unit_weight, surprisal_weight_from_corpus

__all__ = [
    "Sigma", "SigmaError", "load_sigma",
    "PDG", "normalize_python",
    "wl_features", "correlate", "unit_weight", "surprisal_weight_from_corpus",
]
