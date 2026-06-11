# NOTICE: This file is protected under RCF-PL
import os
import hashlib
import pytest
from pathlib import Path
from rcf_cli.scanner import RCFScanner

@pytest.fixture
def temp_workspace(tmp_path):
    # Create a temporary file with RCF markers
    protected_file = tmp_path / "protected_code.py"
    protected_file.write_text(
        "# NOTICE: This file is protected under RCF-PL\n"
        "# [RCF:RESTRICTED]\n"
        "def secret(): pass"
    )

    # Create a public file
    public_file = tmp_path / "public_code.py"
    public_file.write_text(
        "# [RCF:PUBLIC]\n"
        "def architecture(): pass"
    )

    # Create an unmarked file
    unmarked_file = tmp_path / "normal_code.py"
    unmarked_file.write_text("def normal(): pass")

    return tmp_path

def test_scanner_detects_markers(temp_workspace):
    scanner = RCFScanner(temp_workspace)
    results = scanner.scan_directory(include_protected=True)
    
    # Now 3 files should be detected
    assert len(results) == 3
    
    # Check RESTRICTED file
    restricted_match = next((r for r in results if "protected_code.py" in r["path"]), None)
    assert restricted_match is not None
    assert "RESTRICTED" in restricted_match["markers"]
    assert restricted_match["has_header"] is True

    # Check PUBLIC file
    public_match = next((r for r in results if "public_code.py" in r["path"]), None)
    assert public_match is not None
    assert "PUBLIC" in public_match["markers"]
    assert public_match["has_header"] is False

def test_scanner_ignores_files(temp_workspace):
    # Add an ignored folder
    node_modules = temp_workspace / "node_modules"
    node_modules.mkdir()
    ignored_file = node_modules / "ignored.py"
    ignored_file.write_text("# [RCF:RESTRICTED]")
    
    scanner = RCFScanner(temp_workspace)
    results = scanner.scan_directory(include_protected=True)

    # Should be 3, node_modules is ignored
    assert len(results) == 3


def _build_assets(root):
    """Reproduces the asset list that 'audit' records (see cli.audit_project)."""
    results = RCFScanner(root).scan_directory(include_protected=True)
    assets = []
    for res in results:
        if not res.get('is_protected'):
            continue
        with open(os.path.join(root, res['path']), 'rb') as f:
            digest = hashlib.sha256(f.read()).hexdigest()
        assets.append({'file': res['path'], 'markers': res['markers'], 'sha256': digest})
    return assets


def test_audit_excludes_unprotected_files(temp_workspace):
    # normal_code.py has neither header nor markers — it must NOT land in the
    # audit report. Recording it would (a) break parity with the TS SDK and
    # (b) put unprotected code into a snapshot-of-ownership artifact.
    assets = _build_assets(temp_workspace)
    recorded = {os.path.basename(a['file']) for a in assets}

    assert 'normal_code.py' not in recorded
    assert recorded == {'protected_code.py', 'public_code.py'}
