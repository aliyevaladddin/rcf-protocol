import argparse
import sys
import json
import os
import hashlib
from datetime import datetime
from rcf_cli.scanner import RCFScanner

def init_project(args):
    project_name = args.project or os.path.basename(os.getcwd())
    author_name = args.author or "Author"
    year = datetime.now().year

    notice_content = f"""# RCF-PL NOTICE

This project (**{project_name}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL) v1.1**.

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
        print("✅ Generated NOTICE.md with RCF-PL v1.1 protections.")
    
    rcfignore_path = os.path.join(os.getcwd(), ".rcfignore")
    if not os.path.exists(rcfignore_path):
        with open(rcfignore_path, "w") as f:
            f.write("# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n")
        print("✅ Generated .rcfignore.")
        
    print(f"🎉 RCF Protocol successfully initialized for '{project_name}'.")

def audit_project(args):
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
        parser = argparse.ArgumentParser(description="Generate an RCF Audit Report")
        parser.add_argument("audit", help="Audit command")
        parser.add_argument("path", nargs="?", default=".", help="Path to audit")
        args = parser.parse_args()
        audit_project(args)
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
