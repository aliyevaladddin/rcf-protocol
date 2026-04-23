# NOTICE: This file is protected under RCF-PL v2.0.1
import os
import pytest
from pathlib import Path
from rcf_cli.scanner import RCFScanner

@pytest.fixture
def temp_workspace(tmp_path):
    # Create a temporary file with RCF markers
    protected_file = tmp_path / "protected_code.py"
    protected_file.write_text(
        "# NOTICE: This file is protected under RCF-PL v2.0.1\n"
        "# [RCF:RESTRICTED]\n"
        "def secret(): pass"
    )

    # Create a file with Ghost Marker
    ghost_file = tmp_path / "ghost_code.py"
    ghost_file.write_text(
        "# NOTICE: This file is protected under RCF-PL v2.0.1\n"
        "# [RCF:GHOST:74bc881f2c077802]\n"
        "def integrity_check(): pass"
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
    
    # Now 4 files should be detected
    assert len(results) == 4
    
    # Check RESTRICTED file
    restricted_match = next((r for r in results if "protected_code.py" in r["path"]), None)
    assert restricted_match is not None
    assert "RESTRICTED" in restricted_match["markers"]
    assert restricted_match["has_header"] is True
    
    # Check GHOST file
    ghost_match = next((r for r in results if "ghost_code.py" in r["path"]), None)
    assert ghost_match is not None
    assert len(ghost_match["ghost_markers"]) == 1
    assert ghost_match["ghost_markers"][0] == "74bc881f2c077802"
    assert ghost_match["has_header"] is True

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
    
    # Should be 4, node_modules is ignored
    assert len(results) == 4
