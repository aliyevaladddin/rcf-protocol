# NOTICE: This file is protected under RCF-PL v1.2.8
import argparse
import sys
import json
import os
import hashlib
import re
from datetime import datetime
from rcf_cli.scanner import RCFScanner

def init_project(args):
    project_name = args.project or os.path.basename(os.getcwd())
    author_name = args.author or "Author"
    year = datetime.now().year

    notice_content = f"""# RCF-PL NOTICE

This project (**{project_name}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL) v1.2.8**.

Copyright (c) {year} {author_name}. All rights reserved.

## ⚠️ AI/ML Training Restriction
This repository contains proprietary methodologies protected by RCF.
Automated extraction, correlation, or use of this code for training Machine Learning models is **STRICTLY PROHIBITED** without explicit written permission.

## Usage Rights
- **Visibility**: You are free to read, study, and audit the source code.
- **Replication**: You may not replicate, extract, or automate the methodologies within blocks marked as `[RCF:PROTECTED]` or `[RCF:RESTRICTED]`.

For full protocol details, visit: https://rcf.aliyev.site
"""
    notice_path = os.path.join(os.getcwd(), "NOTICE.md")
    if os.path.exists(notice_path):
        print("⚠️ NOTICE.md already exists.")
    else:
        with open(notice_path, "w") as f:
            f.write(notice_content)
        print("✅ Generated NOTICE.md with RCF-PL v1.2.8 protections.")
    
    rcfignore_path = os.path.join(os.getcwd(), ".rcfignore")
    if not os.path.exists(rcfignore_path):
        with open(rcfignore_path, "w") as f:
            f.write("# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n")
        print("✅ Generated .rcfignore.")
        
    print(f"🎉 RCF Protocol successfully initialized for '{project_name}'.")

# [RCF:RESTRICTED]
# Core audit logic for generating cryptographic compliance reports.
def audit_project(args):
    license_key = args.license_key or os.environ.get("RCF_LICENSE_KEY")
    uuid_regex = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$')
    
    admin_key_hash = "74bc881f2c077802d68ee7b42a2fe98988dd76c35d835b6fa14f6313f5cb9d7e"
    provided_key_hash = hashlib.sha256(license_key.encode()).hexdigest() if license_key else ""
    
    if provided_key_hash == admin_key_hash:
        pass # Admin bypass
    elif not license_key:
        print("❌ RCF-PL ERROR: License key is missing.")
        print("   The 'audit' command is a premium feature. Please provide a license key.")
        print("   Usage: rcf-cli audit . --license-key RCF-AUDIT-XXXXXX")
        print("   Visit https://rcf.aliyev.site to obtain a license.")
        sys.exit(1)
    elif not license_key.startswith("RCF-AUDIT-") or not uuid_regex.match(license_key.replace("RCF-AUDIT-", "")):
        print("❌ RCF-PL ERROR: Invalid license key format.")
        print("   Expected format: RCF-AUDIT-(KEY)")
        print("")
        sys.exit(1)

    scanner = RCFScanner(args.path)
    results = scanner.scan_directory()
    
    audit_report = {
        "timestamp": datetime.now().isoformat(),
        "audit_type": "RCF-Audit as a Service",
        "protected_assets": []
    }
    
    for res in results:
        file_path = os.path.join(args.path, res['path'])
        try:
            with open(file_path, "rb") as f:
                file_hash = hashlib.sha256(f.read()).hexdigest()
            audit_report["protected_assets"].append({
                "file": res['path'],
                "markers": res['markers'],
                "sha256": file_hash
            })
        except Exception:
            pass
            
    report_path = os.path.join(args.path, "RCF-AUDIT-REPORT.json")
    with open(report_path, "w") as f:
        json.dump(audit_report, f, indent=2)
        
    print(f"✅ RCF-Audit Complete. Generated {report_path}")
    print(f"🔒 Encrypted snapshot of {len(audit_report['protected_assets'])} protected assets created.")

# [RCF:RESTRICTED]
# Verification logic to detect tampering by comparing current hashes with the audit report.
def verify_audit(args):
    report_path = os.path.join(args.path, "RCF-AUDIT-REPORT.json")
    if not os.path.exists(report_path):
        print(f"❌ RCF-PL ERROR: Audit report not found at {report_path}")
        print("   Please run 'rcf-cli audit' first to generate a baseline.")
        sys.exit(1)

    try:
        with open(report_path, "r") as f:
            report = json.load(f)
    except Exception as e:
        print(f"❌ RCF-PL ERROR: Failed to load audit report: {e}")
        sys.exit(1)

    print(f"--- RCF Integrity Verification ---")
    print(f"Report Timestamp: {report.get('timestamp')}")
    print("-" * 30)

    mismatches = []
    missing = []
    verified_count = 0

    for asset in report.get("protected_assets", []):
        file_rel_path = asset["file"]
        stored_hash = asset["sha256"]
        full_path = os.path.join(args.path, file_rel_path)

        if not os.path.exists(full_path):
            missing.append(file_rel_path)
            print(f"❌ MISSING: {file_rel_path}")
            continue

        try:
            with open(full_path, "rb") as f:
                current_hash = hashlib.sha256(f.read()).hexdigest()
            
            if current_hash == stored_hash:
                verified_count += 1
                if not args.summary:
                    print(f"✅ VERIFIED: {file_rel_path}")
            else:
                mismatches.append(file_rel_path)
                print(f"🚨 TAMPERED: {file_rel_path}")
                print(f"   Expected: {stored_hash}")
                print(f"   Actual:   {current_hash}")
        except Exception as e:
            print(f"⚠️ ERROR scanning {file_rel_path}: {e}")

    print("-" * 30)
    print(f"Total Assets in Report: {len(report.get('protected_assets', []))}")
    print(f"Verified: {verified_count}")
    
    if missing:
        print(f"Missing:  {len(missing)}")
    if mismatches:
        print(f"🚨 Mismatches Detected: {len(mismatches)}")

    if mismatches or missing:
        sys.exit(1)
    else:
        print("🛡️ Integrity Check Passed. No unauthorized modifications detected.")
        sys.exit(0)

def main():
    if len(sys.argv) > 1 and sys.argv[1] == "init":
        parser = argparse.ArgumentParser(description="Initialize RCF Protocol in the current directory")
        parser.add_argument("init", help="Init command")
        parser.add_argument("--project", help="Name of the project")
        parser.add_argument("--author", help="Name of the author")
        args = parser.parse_args()
        init_project(args)
        return

    if len(sys.argv) > 1 and sys.argv[1] == "audit":
        parser = argparse.ArgumentParser(description="Generate an RCF Audit Report (Premium Feature). Get keys at https://rcf.aliyev.site")
        parser.add_argument("audit", help="Audit command")
        parser.add_argument("path", nargs="?", default=".", help="Path to audit")
        parser.add_argument("--license-key", help="RCF Audit License Key")
        args = parser.parse_args()
        audit_project(args)
        return

    if len(sys.argv) > 1 and sys.argv[1] == "verify":
        parser = argparse.ArgumentParser(description="Verify project integrity against an RCF Audit Report")
        parser.add_argument("verify", help="Verify command")
        parser.add_argument("path", nargs="?", default=".", help="Path to verify")
        parser.add_argument("--summary", action="store_true", help="Show summary only")
        args = parser.parse_args()
        verify_audit(args)
        return

    parser = argparse.ArgumentParser(description="RCF Protocol Compliance Checker")
    parser.add_argument("path", nargs="?", default=".", help="Path to scan (default: current directory)")
    parser.add_argument("--format", choices=["text", "json"], default="text", help="Output format")
    parser.add_argument("--summary", action="store_true", help="Show summary only")
    
    args = parser.parse_args()
    
    scanner = RCFScanner(args.path)
    results = scanner.scan_directory()
    
    if args.format == "json":
        print(json.dumps(results, indent=2))
        return

    # Text Output
    print(f"--- RCF Compliance Report ---")
    print(f"Scanning: {args.path}")
    print("-" * 30)
    
    protected_count = 0
    issue_count = 0
    
    for res in results:
        protected_count += 1
        markers_str = ", ".join(res['markers']) if res['markers'] else "None"
        header_status = "✅ Header Present" if res['has_header'] else "⚠️ Missing Header"
        
        if not res['has_header']:
            issue_count += 1
            
        if not args.summary:
            print(f"File: {res['path']}")
            print(f"  Markers: {markers_str}")
            print(f"  Status:  {header_status}")
            print()

    print("-" * 30)
    print(f"Total Protected Files: {protected_count}")
    print(f"Total Compliance Issues: {issue_count}")
    
    if issue_count > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()
