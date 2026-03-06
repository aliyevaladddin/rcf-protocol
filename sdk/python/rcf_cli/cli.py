import argparse
import sys
import json
from rcf_cli.scanner import RCFScanner

def main():
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
