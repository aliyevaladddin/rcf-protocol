# NOTICE: This file is protected under RCF-PL v2.0.3
import argparse
import sys
import json
import os
import hashlib
import re
from datetime import datetime
from pathlib import Path
from rcf_cli.scanner import RCFScanner

# [RCF:PROTECTED]

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _sha256(path: str) -> str:
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def _comment_prefix(file_path: str) -> str:
    """Returns the correct single-line comment prefix for a file type."""
    if file_path.endswith(('.js', '.ts', '.c', '.cpp', '.java', '.go', '.swift', '.kt')):
        return '//'
    if file_path.endswith(('.md', '.html')):
        return None  # handled separately
    return '#'


def _make_marker_line(file_path: str, marker: str = 'RCF:PROTECTED') -> str:
    if file_path.endswith(('.md', '.html')):
        return f'<!-- [{marker}] -->\n'
    prefix = _comment_prefix(file_path)
    return f'{prefix} [{marker}]\n'


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def init_project(args):
    project_name = args.project or os.path.basename(os.getcwd())
    author_name = args.author or "Author"
    year = datetime.now().year

    notice_content = f"""# RCF-PL NOTICE

This project (**{project_name}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL) v2.0.3 "Ghost Protocol"**.

Copyright (c) {year} {author_name}. All rights reserved.

## ⚠️ AI/ML Training Restriction
This repository contains proprietary methodologies protected by RCF.
Automated extraction, correlation, or use of this code for training Machine Learning
models is **STRICTLY PROHIBITED** without explicit written permission.

## Usage Rights
- **Visibility**: You are free to read, study, and audit the source code.
- **Replication**: You may not replicate, extract, or automate the methodologies
  within blocks marked as `[RCF:PROTECTED]` or `[RCF:RESTRICTED]`.

For full protocol details, visit: https://aliyev.site/rcf
"""
    notice_path = os.path.join(os.getcwd(), "NOTICE.md")
    if os.path.exists(notice_path):
        print("⚠️  NOTICE.md already exists. Skipping.")
    else:
        Path(notice_path).write_text(notice_content, encoding='utf-8')
        print("✅ Generated NOTICE.md with RCF-PL v2.0.3 protections.")

    rcfignore_path = os.path.join(os.getcwd(), ".rcfignore")
    if not os.path.exists(rcfignore_path):
        Path(rcfignore_path).write_text(
            "# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n",
            encoding='utf-8'
        )
        print("✅ Generated .rcfignore.")

    print(f"🎉 RCF Protocol initialized for '{project_name}'.")


def audit_project(args):
    license_key = args.license_key or os.environ.get("RCF_LICENSE_KEY", "")
    admin_key_hash = "74bc881f2c077802" # RCF Ghost Admin Slice (v2.0.3)
    provided_key_hash = hashlib.sha256(license_key.encode()).hexdigest()[:16] if license_key else ""

    if provided_key_hash == admin_key_hash:
        pass  # admin bypass
    elif not license_key:
        print("❌ RCF-PL ERROR: License key missing. 'audit' is a premium feature.")
        print("   Set --license-key or RCF_LICENSE_KEY env variable.")
        sys.exit(1)
    elif not license_key.startswith("RCF-AUDIT-"):
        print("❌ RCF-PL ERROR: Invalid license key format. Must start with 'RCF-AUDIT-'.")
        sys.exit(1)

    target = os.path.abspath(args.path)
    scanner = RCFScanner(target, verbose=args.verbose)
    results = scanner.scan_directory(include_protected=True)

    audit_report = {
        "rcf_version": "2.0.3",
        "timestamp": datetime.now().isoformat(),
        "audit_type": "RCF-Audit v2.0.3 (Ghost Shield)",
        "root": target,
        "protected_assets": []
    }

    for res in results:
        file_path = os.path.join(target, res['path'])
        
        # Mask ghost markers for the report (only keep prefix/suffix)
        masked_ghost = [f"{g[:8]}...{g[-8:]}" for g in res.get('ghost_markers', [])]
        
        try:
            audit_report["protected_assets"].append({
                "file": res['path'],
                "markers": res['markers'],
                "ghost_markers": masked_ghost,
                "sha256": _sha256(file_path)
            })
        except Exception as e:
            print(f"⚠️  Could not hash {res['path']}: {e}")

    report_path = os.path.join(target, "RCF-AUDIT-REPORT.json")
    Path(report_path).write_text(
        json.dumps(audit_report, indent=2), encoding='utf-8'
    )
    print(f"✅ Audit complete. {len(audit_report['protected_assets'])} assets recorded.")
    print(f"   Report: {report_path}")


def verify_audit(args):
    """Verify ALL files in a directory against the audit report."""
    target = os.path.abspath(args.path)
    report_path = os.path.join(target, "RCF-AUDIT-REPORT.json")

    if not os.path.exists(report_path):
        print(f"❌ Audit report not found at: {report_path}")
        sys.exit(1)

    report = json.loads(Path(report_path).read_text(encoding='utf-8'))
    assets = report.get("protected_assets", [])

    print(f"--- RCF Integrity Verification ({len(assets)} assets) ---")
    mismatches, missing, verified = [], [], 0

    for asset in assets:
        rel_path = asset["file"]
        full_path = os.path.join(target, rel_path)

        if not os.path.exists(full_path):
            missing.append(rel_path)
            print(f"❌ MISSING  : {rel_path}")
            continue

        current_hash = _sha256(full_path)
        if current_hash == asset["sha256"]:
            verified += 1
            if args.verbose:
                print(f"✅ VERIFIED : {rel_path}")
        else:
            mismatches.append(rel_path)
            print(f"🚨 TAMPERED : {rel_path}")
            if args.verbose:
                print(f"   stored : {asset['sha256']}")
                print(f"   current: {current_hash}")

    print()
    if mismatches or missing:
        print(f"❌ FAILED. Tampered: {len(mismatches)}, Missing: {len(missing)}, Verified: {verified}")
        sys.exit(1)
    else:
        print(f"🛡️  All {verified} assets verified. Integrity OK.")
        sys.exit(0)


def verify_file_standalone(args):
    """Verify a SINGLE file against an audit report (3rd-party use)."""
    file_path = os.path.abspath(args.file)
    report_path = os.path.abspath(args.against)

    if not os.path.exists(file_path):
        print(f"❌ File not found: {file_path}")
        sys.exit(1)
    if not os.path.exists(report_path):
        print(f"❌ Audit report not found: {report_path}")
        sys.exit(1)

    report = json.loads(Path(report_path).read_text(encoding='utf-8'))
    report_root = report.get("root", os.path.dirname(report_path))

    # Try to resolve the file's path relative to the report's root
    try:
        rel_path = str(Path(file_path).relative_to(report_root))
    except ValueError:
        rel_path = os.path.basename(file_path)

    # Match by relative path first, then fall back to filename only
    asset = next(
        (a for a in report.get("protected_assets", [])
         if a["file"] == rel_path or
         os.path.normpath(a["file"]) == os.path.normpath(rel_path) or
         os.path.basename(a["file"]) == os.path.basename(file_path)),
        None
    )

    if not asset:
        print(f"❓ '{os.path.basename(file_path)}' not found in audit report.")
        print(f"   Available assets: {[a['file'] for a in report.get('protected_assets', [])]}")
        sys.exit(1)

    current_hash = _sha256(file_path)
    stored_hash = asset["sha256"]

    print(f"--- RCF File Verification ---")
    print(f"File    : {file_path}")
    print(f"Report  : {report_path}")
    print(f"Recorded: {report.get('timestamp', 'unknown')}")
    print()

    if current_hash == stored_hash:
        print(f"✅ VERIFIED — file matches audit record (RCF v2.0.3)")
        print(f"   SHA-256: {current_hash}")
        sys.exit(0)
    else:
        print(f"🚨 TAMPERED — file has been modified since audit!")
        print(f"   stored : {stored_hash}")
        print(f"   current: {current_hash}")
        sys.exit(1)


def diff_compliance(args):
    """
    Compare current marker state against the audit report.
    Exits 1 if any markers were removed (CI/CD fail trigger).
    """
    target = os.path.abspath(args.path)
    report_path = os.path.join(target, "RCF-AUDIT-REPORT.json")

    if not os.path.exists(report_path):
        print(f"❌ Audit report missing at: {report_path}")
        print("   Run 'rcf-cli audit' first.")
        sys.exit(1)

    report = json.loads(Path(report_path).read_text(encoding='utf-8'))

    scanner = RCFScanner(target, verbose=args.verbose)
    current = {r['path']: r for r in scanner.scan_directory(include_protected=True)}

    violations = []
    new_files_with_logic = []

    # Check recorded assets for removed markers / deleted files
    for asset in report.get("protected_assets", []):
        rel_path = asset["file"]
        stored_markers = set(asset.get("markers", []))

        if rel_path not in current:
            violations.append({
                "type": "file_missing",
                "file": rel_path,
                "detail": "Previously protected file is missing"
            })
            print(f"🚨 MISSING  : {rel_path}")
            continue

        current_markers = set(current[rel_path].get("markers", []))
        removed = stored_markers - current_markers
        added = current_markers - stored_markers

        if removed:
            violations.append({
                "type": "markers_removed",
                "file": rel_path,
                "removed": list(removed)
            })
            print(f"🚨 MARKERS REMOVED in {rel_path}: {removed}")
        elif args.verbose:
            print(f"✅ OK       : {rel_path}  markers={current_markers}")

        if added and args.verbose:
            print(f"ℹ️  NEW MARKERS in {rel_path}: {added}")

    # Detect newly added unprotected logic (not in audit report)
    audited_paths = {a["file"] for a in report.get("protected_assets", [])}
    for path, res in current.items():
        if path not in audited_paths and res.get("has_unprotected_logic"):
            new_files_with_logic.append(path)
            if args.verbose:
                print(f"⚠️  NEW UNPROTECTED LOGIC: {path}")

    # Summary
    print()
    if violations:
        print(f"❌ {len(violations)} compliance violation(s) found.")
        if new_files_with_logic:
            print(f"⚠️  {len(new_files_with_logic)} new file(s) with unprotected logic detected.")
        sys.exit(1)
    else:
        print(f"✅ No marker violations. All {len(audited_paths)} recorded assets compliant.")
        if new_files_with_logic:
            print(f"⚠️  {len(new_files_with_logic)} new file(s) with unprotected logic (run 'protect').")
        sys.exit(0)


def protect_project(args):
    """Auto-insert RCF markers into files with unprotected logic."""
    target = os.path.abspath(args.path)
    scanner = RCFScanner(target, verbose=args.verbose)
    results = scanner.scan_directory()  # only files needing attention

    if not results:
        print("✅ No unprotected logic found. Nothing to do.")
        return

    modified = 0
    skipped = 0

    for res in results:
        file_path = os.path.join(target, res['path'])

        try:
            lines = Path(file_path).read_text(encoding='utf-8').splitlines(keepends=True)
        except Exception as e:
            print(f"⚠️  Cannot read {res['path']}: {e}")
            skipped += 1
            continue

        new_lines = []

        # Add file header if missing
        if not res['has_header']:
            if file_path.endswith(('.md', '.html')):
                header = '<!-- NOTICE: This file is protected under RCF-PL v2.0.3 -->\n'
            else:
                header = '# NOTICE: This file is protected under RCF-PL v2.0.3\n'
            new_lines.append(header)

        # Insert markers before unprotected logic lines
        gap_lines = {g['line'] for g in res.get('unprotected_logic', [])}
        marker_line = _make_marker_line(file_path)

        for i, line in enumerate(lines, start=1):
            if i in gap_lines:
                # Don't insert duplicate markers
                prev = new_lines[-1] if new_lines else ''
                if '[RCF:' not in prev:
                    new_lines.append(marker_line)
            new_lines.append(line)

        changed = (len(new_lines) != len(lines)) or (not res['has_header'])

        if changed:
            if args.dry_run:
                gaps = len(res.get('unprotected_logic', []))
                print(f"🔍 DRY RUN : {res['path']}  ({gaps} block(s) would be marked)")
            else:
                Path(file_path).write_text(''.join(new_lines), encoding='utf-8')
                gaps = len(res.get('unprotected_logic', []))
                print(f"✅ PROTECTED: {res['path']}  ({gaps} block(s) marked)")
            modified += 1
        else:
            skipped += 1

    print()
    action = "Would modify" if args.dry_run else "Modified"
    print(f"🛡️  {action} {modified} file(s). Skipped: {skipped}.")
    if args.dry_run:
        print("   Run without --dry-run to apply changes.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    # Smart Command Injection: if the first arg is a path and not a command, default to 'verify'
    commands = ['init', 'audit', 'verify', 'diff', 'protect', '--help', '-h', '--version']
    if len(sys.argv) > 1 and sys.argv[1] not in commands:
        if os.path.exists(sys.argv[1]) or sys.argv[1].startswith(('.', '/')):
            sys.argv.insert(1, 'verify')

    parser = argparse.ArgumentParser(
        prog='rcf-ghost-shield',
        description='RCF Ghost Shield v2.0.3 — Active Protection Framework'
    )
    parser.add_argument('--version', action='version', version='rcf-ghost-shield 2.0.3')
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")

    # init
    p_init = subparsers.add_parser("init", help="Initialize RCF in the current project")
    p_init.add_argument("--project", metavar="NAME", help="Project name")
    p_init.add_argument("--author", metavar="NAME", help="Author name")

    # audit
    p_audit = subparsers.add_parser("audit", help="Generate RCF-AUDIT-REPORT.json (premium)")
    p_audit.add_argument("path", nargs="?", default=".", metavar="PATH")
    p_audit.add_argument("--license-key", metavar="KEY", help="RCF audit license key")
    p_audit.add_argument("--verbose", "-v", action="store_true")

    # verify
    p_verify = subparsers.add_parser(
        "verify",
        help="Verify file integrity against audit report",
        description=(
            "Usage:\n"
            "  rcf-cli verify [PATH]                   — verify all files in PATH\n"
            "  rcf-cli verify <FILE> --against <REPORT> — verify a single file (3rd-party)"
        ),
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    p_verify.add_argument("file_or_path", nargs="?", default=".", metavar="FILE|PATH")
    p_verify.add_argument("--against", metavar="REPORT", help="Path to audit report JSON")
    p_verify.add_argument("--verbose", "-v", action="store_true")

    # diff
    p_diff = subparsers.add_parser(
        "diff",
        help="Diff current markers vs audit report (use in CI/CD)"
    )
    p_diff.add_argument("path", nargs="?", default=".", metavar="PATH")
    p_diff.add_argument("--verbose", "-v", action="store_true")

    # protect
    p_protect = subparsers.add_parser(
        "protect",
        help="Auto-insert RCF markers into unprotected logic blocks"
    )
    p_protect.add_argument("path", nargs="?", default=".", metavar="PATH")
    p_protect.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    p_protect.add_argument("--verbose", "-v", action="store_true")

    args = parser.parse_args()

    if args.command == "init":
        init_project(args)
    elif args.command == "audit":
        audit_project(args)
    elif args.command == "verify":
        if args.against:
            args.file = args.file_or_path
            verify_file_standalone(args)
        else:
            args.path = args.file_or_path
            verify_audit(args)
    elif args.command == "diff":
        diff_compliance(args)
    elif args.command == "protect":
        protect_project(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
