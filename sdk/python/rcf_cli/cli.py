# NOTICE: This file is protected under RCF-PL
from __future__ import annotations

import argparse
import sys
import json
import os
import hashlib
import re
from datetime import datetime
from pathlib import Path
import urllib.request
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
# robots.txt — the RCF law on the project's threshold
# ---------------------------------------------------------------------------
#
# RCF declares itself in the entry ritual every crawler/agent performs
# (robots.txt is read first, before any code). This is the *announcing* half:
# only aligned bots honor robots.txt — it is a declaration, not a lock. A
# thief who strips it is caught by the other half (audit correlation).
#
# These lists and the block text are a shared contract: they MUST stay
# byte-identical to the TypeScript SDK so a project is described the same way
# whichever SDK generated its robots.txt.

SEARCH_BOTS = ["Googlebot", "Bingbot", "DuckDuckBot"]

AI_TRAINING_BOTS = [
    "GPTBot",
    "ClaudeBot",
    "anthropic-ai",
    "Google-Extended",
    "CCBot",
    "PerplexityBot",
    "Bytespider",
    "Amazonbot",
]

ROBOTS_BEGIN = "# >>> RCF-managed (Restricted Correlation Framework) >>>"
ROBOTS_END = "# <<< RCF-managed <<<"


def _render_rcf_robots_block() -> str:
    """The RCF-managed robots.txt block. Byte-identical to the TS SDK."""
    lines = [
        ROBOTS_BEGIN,
        "# This project is protected under RCF-PL. See NOTICE.md.",
        "# Human reading and search indexing are welcome.",
        "# AI/ML training and automated method extraction are restricted.",
        "# robots.txt is honored only by aligned bots — a declaration, not a lock.",
        "# Protocol: https://aliyev.site/rcf",
        "",
        "# Search engines — welcome (discovery / indexing)",
    ]
    lines += [f"User-agent: {bot}" for bot in SEARCH_BOTS]
    lines += [
        "Allow: /",
        "",
        "# AI/ML training crawlers — restricted (RCF-PL AI Training Restriction)",
    ]
    lines += [f"User-agent: {bot}" for bot in AI_TRAINING_BOTS]
    lines += [
        "Disallow: /",
        ROBOTS_END,
    ]
    return "\n".join(lines) + "\n"


def _merge_robots_block(existing: str | None, block: str) -> str:
    """
    Idempotently merge the RCF block into an existing robots.txt.

    - If a previous RCF-managed block exists (between the delimiters), replace
      it in place — never duplicate, never touch surrounding lines.
    - Otherwise append the block (preserving any existing content).
    - If there is no existing file, the block is the whole file.
    """
    block = block.rstrip("\n") + "\n"
    if not existing or not existing.strip():
        return block

    start = existing.find(ROBOTS_BEGIN)
    end = existing.find(ROBOTS_END)
    if start != -1 and end != -1 and end > start:
        end_full = end + len(ROBOTS_END)
        before = existing[:start]
        after = existing[end_full:]
        # Drop a single trailing newline left over from the old block so the
        # spacing around the replacement stays stable across repeated runs.
        if after.startswith("\n"):
            after = after[1:]
        merged = before + block.rstrip("\n") + ("\n" + after if after.strip() else "\n")
        return merged

    sep = "" if existing.endswith("\n") else "\n"
    return existing + sep + "\n" + block


def _write_rcf_robots(target: str, dry_run: bool) -> None:
    """Generate / idempotently update robots.txt at the project root."""
    robots_path = os.path.join(target, "robots.txt")
    existing = None
    if os.path.exists(robots_path):
        try:
            existing = Path(robots_path).read_text(encoding="utf-8")
        except Exception as e:
            print(f"⚠️  Cannot read robots.txt: {e}")
            return

    merged = _merge_robots_block(existing, _render_rcf_robots_block())
    if merged == existing:
        return  # already up to date — no churn

    if dry_run:
        verb = "update" if existing else "create"
        print(f"🔍 DRY RUN : robots.txt would {verb} the RCF-managed block")
        return

    Path(robots_path).write_text(merged, encoding="utf-8")
    print(f"✅ ROBOTS   : RCF law written to robots.txt (search allowed, AI training restricted)")


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

def init_project(args):
    project_name = args.project or os.path.basename(os.getcwd())
    author_name = args.author or "Author"
    year = datetime.now().year

    notice_content = f"""# RCF-PL NOTICE

This project (**{project_name}**) is protected under the **Restricted Correlation Framework Protocol License (RCF-PL)**.

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
        print("✅ Generated NOTICE.md with RCF-PL protections.")

    rcfignore_path = os.path.join(os.getcwd(), ".rcfignore")
    if not os.path.exists(rcfignore_path):
        Path(rcfignore_path).write_text(
            "# RCF Ignore File\nnode_modules\n.git\n__pycache__\n.venv\ndist\nbuild\n",
            encoding='utf-8'
        )
        print("✅ Generated .rcfignore.")

    print(f"🎉 RCF initialized for '{project_name}'.")


def detect_project_name(root: str) -> str:
    notice_path = os.path.join(root, "NOTICE.md")
    if os.path.exists(notice_path):
        try:
            with open(notice_path, "r", encoding="utf-8") as f:
                content = f.read()
                match = re.search(r"This project \(\*\*(.*?)\*\*\)", content)
                if match:
                    return match.group(1).strip()
        except Exception:
            pass

    pkg_path = os.path.join(root, "package.json")
    if os.path.exists(pkg_path):
        try:
            with open(pkg_path, "r", encoding="utf-8") as f:
                data = json.loads(f.read())
                if "name" in data:
                    return data["name"]
        except Exception:
            pass

    return os.path.basename(root)


def audit_project(args):
    target = os.path.abspath(args.path)
    scanner = RCFScanner(target, verbose=args.verbose)
    results = scanner.scan_directory(include_protected=True)

    audit_report = {

        "timestamp": datetime.now().isoformat(),
        "audit_type": "RCF-Audit",
        "protected_assets": []
    }

    for res in results:
        # Only record genuinely protected assets — keeps the report a snapshot
        # of ownership, and keeps it byte-identical to the TS SDK report.
        if not res.get('is_protected'):
            continue

        file_path = os.path.join(target, res['path'])

        try:
            audit_report["protected_assets"].append({
                "file": res['path'],
                "markers": res['markers'],
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
        print(f"✅ VERIFIED — file matches audit record")
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

    write_robots = not getattr(args, "no_robots", False)

    if not results:
        print("✅ No unprotected logic found.")
        if write_robots:
            _write_rcf_robots(target, args.dry_run)
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
                header = '<!-- NOTICE: This file is protected under RCF-PL -->\n'
            else:
                header = '# NOTICE: This file is protected under RCF-PL\n'
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

    if write_robots:
        _write_rcf_robots(target, args.dry_run)

    if args.dry_run:
        print("   Run without --dry-run to apply changes.")

CLOUDFLARE_WAF_CODE = """/**
 * RCF Gateway — Cloudflare Worker WAF
 * Protects repositories and source assets from AI scraper bots on the Edge.
 */

const AI_USER_AGENTS = [
  'gptbot',
  'chatgpt-user',
  'cohere-ai',
  'anthropic-ai',
  'claude-web',
  'claude-user',
  'google-extended',
  'apis-google',
  'perplexitybot',
  'applebot-extended',
  'omgilibot',
  'bytespider',
  'diffbot',
  'imagesiftbot',
  'petalbot',
  'ccbot',
  'yandexbot',
  'facebookexternalhit'
];

const SOURCE_EXTENSIONS = new Set([
  '.py', '.ts', '.js', '.tsx', '.jsx', '.go', '.rs', 
  '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.swift', 
  '.rb', '.php', '.pyc', '.class'
]);

const ipRequestHistory = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 10000;
const MAX_SOURCE_REQUESTS = 10;

function isAiAgent(userAgent: string): boolean {
  const ua = userAgent.toLowerCase();
  return AI_USER_AGENTS.some(agent => ua.includes(agent));
}

function isSourceFile(urlPath: string): boolean {
  const extIndex = urlPath.lastIndexOf('.');
  if (extIndex === -1) return false;
  const ext = urlPath.substring(extIndex).toLowerCase();
  return SOURCE_EXTENSIONS.has(ext);
}

function getRcfBlockedHtml(ip: string, reason: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>403 Forbidden — RCF Active Protection</title>
    <style>
        body {
            background-color: #0d0e12;
            color: #e2e8f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 50px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ff3333;
            background-color: #161822;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(255, 51, 51, 0.15);
        }
        pre {
            color: #ff3333;
            font-size: 14px;
            text-align: left;
            display: inline-block;
            margin-bottom: 30px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .meta {
            font-size: 12px;
            color: #718096;
            margin-top: 30px;
            border-top: 1px solid #2d3748;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <pre>
  ██████╗  ██████╗███████╗              ██╗        ██╗
  ██╔══██╗██╔════╝██╔════╝      ██╗    ██╔╝       ██╔╝
  ██████╔╝██║     █████╗        ╚═╝   ██╔╝       ██╔╝ 
  ██╔══██╗██║     ██╔══╝        ██╗  ██╔╝       ██╔╝  
  ██║  ██║╚██████╗██║           ╚═╝ ██╔╝       ██╔╝   
  ╚═╝  ╚═╝ ╚═════╝╚═╝              ╚═╝        ╚═╝     
        </pre>
        <h1>403 Forbidden — RCF Active Protection</h1>
        <p>Access denied under the <strong>Restricted Correlation Framework PL</strong> (RCF-PL).</p>
        <p>Reason: ${reason}</p>
        <div class="meta">
            Client IP: ${ip} | System Status: Active Enforcement | RCF Gate v1.0.0
        </div>
    </div>
</body>
</html>`;
}

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent') || '';
    const ip = request.headers.get('cf-connecting-ip') || 'unknown';

    if (isAiAgent(userAgent)) {
      return new Response(
        getRcfBlockedHtml(ip, 'Automated AI harvester signature detected.'),
        {
          status: 403,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    if (isSourceFile(url.pathname)) {
      const now = Date.now();
      let history = ipRequestHistory.get(ip) || [];
      history = history.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
      history.push(now);
      ipRequestHistory.set(ip, history);

      if (history.length > MAX_SOURCE_REQUESTS) {
        return new Response(
          getRcfBlockedHtml(ip, 'Excessive code crawling pattern detected (Rate Limit Exceeded).'),
          {
            status: 429,
            headers: { 'Content-Type': 'text/html' }
          }
        );
      }
    }

    return fetch(request);
  }
};
"""

NGINX_WAF_LUA = """-- RCF Gateway — Nginx Lua WAF
-- Protects repositories and source assets from AI scraper bots.
-- Requires OpenResty or Nginx with lua-nginx-module.

local AI_USER_AGENTS = {
    "gptbot",
    "chatgpt-user",
    "cohere-ai",
    "anthropic-ai",
    "claude-web",
    "claude-user",
    "google-extended",
    "apis-google",
    "perplexitybot",
    "applebot-extended",
    "omgilibot",
    "bytespider",
    "diffbot",
    "imagesiftbot",
    "petalbot",
    "ccbot",
    "yandexbot",
    "facebookexternalhit"
}

local SOURCE_EXTENSIONS = {
    [".py"] = true, [".ts"] = true, [".js"] = true, [".tsx"] = true, [".jsx"] = true,
    [".go"] = true, [".rs"] = true, [".java"] = true, [".c"] = true, [".cpp"] = true,
    [".h"] = true, [".hpp"] = true, [".cs"] = true, [".swift"] = true, [".rb"] = true,
    [".php"] = true, [".pyc"] = true, [".class"] = true
}

local function is_ai_agent(ua)
    if not ua then return false end
    ua = string.lower(ua)
    for _, agent in ipairs(AI_USER_AGENTS) do
        if string.find(ua, agent, 1, true) then
            return true
        end
    end
    return false
end

local function is_source_file(uri)
    local ext = string.match(uri, "%.[^%.]+$")
    if not ext then return false end
    ext = string.lower(ext)
    return SOURCE_EXTENSIONS[ext] ~= nil
end

local function render_blocked_html(ip, reason)
    return string.format([[<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>403 Forbidden — RCF Active Protection</title>
    <style>
        body {
            background-color: #0d0e12;
            color: #e2e8f0;
            font-family: 'Courier New', Courier, monospace;
            padding: 50px;
            text-align: center;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            border: 1px solid #ff3333;
            background-color: #161822;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(255, 51, 51, 0.15);
        }
        pre {
            color: #ff3333;
            font-size: 14px;
            text-align: left;
            display: inline-block;
            margin-bottom: 30px;
        }
        h1 {
            color: #ffffff;
            font-size: 24px;
            margin-bottom: 20px;
        }
        p {
            font-size: 16px;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .meta {
            font-size: 12px;
            color: #718096;
            margin-top: 30px;
            border-top: 1px solid #2d3748;
            padding-top: 20px;
        }
    </style>
</head>
<body>
    <div class="container">
        <pre>
  ██████╗  ██████╗███████╗              ██╗        ██╗
  ██╔══██╗██╔════╝██╔════╝      ██╗    ██╔╝       ██╔╝
  ██████╔╝██║     █████╗        ╚═╝   ██╔╝       ██╔╝ 
  ██╔══██╗██║     ██╔══╝        ██╗  ██╔╝       ██╔╝  
  ██║  ██║╚██████╗██║           ╚═╝ ██╔╝       ██╔╝   
  ╚═╝  ╚═╝ ╚═════╝╚═╝              ╚═╝        ╚═╝     
        </pre>
        <h1>403 Forbidden — RCF Active Protection</h1>
        <p>Access denied under the <strong>Restricted Correlation Framework PL</strong> (RCF-PL).</p>
        <p>Reason: %s</p>
        <div class="meta">
            Client IP: %s | System Status: Active Enforcement | RCF Gate v1.0.0
        </div>
    </div>
</body>
</html>]], reason, ip)
end

local headers = ngx.req.get_headers()
local ua = headers["user-agent"]
local ip = ngx.var.remote_addr or "unknown"

if is_ai_agent(ua) then
    ngx.status = ngx.HTTP_FORBIDDEN
    ngx.header.content_type = "text/html; charset=UTF-8"
    ngx.say(render_blocked_html(ip, "Automated AI harvester signature detected."))
    ngx.exit(ngx.HTTP_FORBIDDEN)
end

local uri = ngx.var.uri
if is_source_file(uri) then
    local rcf_limit = ngx.shared.rcf_limit
    if rcf_limit then
        local key = "rcf:ip:" .. ip
        local count, err = rcf_limit:get(key)
        if not count then
            rcf_limit:set(key, 1, 10)
        else
            if count > 10 then
                ngx.status = ngx.HTTP_TOO_MANY_REQUESTS
                ngx.header.content_type = "text/html; charset=UTF-8"
                ngx.say(render_blocked_html(ip, "Excessive code crawling pattern detected (Rate Limit Exceeded)."))
                ngx.exit(ngx.HTTP_TOO_MANY_REQUESTS)
            else
                rcf_limit:incr(key, 1)
            end
        end
    end
end
"""

NGINX_CONF_SNIPPET = """# RCF Gateway Nginx WAF Configuration Snippet
# Add this to your nginx.conf to protect your codebase routes.

lua_shared_dict rcf_limit 10m;

server {
    listen 80;
    server_name yourdomain.com;

    location / {
        access_by_lua_file /etc/nginx/rcf_waf.lua;
        # proxy_pass http://localhost:8080;
    }
}
"""


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main():
    # Smart Command Injection: if the first arg is a path and not a command, default to 'verify'
    commands = ['init', 'audit', 'verify', 'diff', 'protect', 'sentinel', 'build-corpus', 'build-null', 'prove', 'canary', 'noise', 'gateway', '--help', '-h', '--version']
    if len(sys.argv) > 1 and sys.argv[1] not in commands:
        if os.path.exists(sys.argv[1]) or sys.argv[1].startswith(('.', '/')):
            sys.argv.insert(1, 'verify')

    audit_banner = (
        "\033[1;97m  ██████╗  ██████╗███████╗   \033[0m\033[1;91m           ██╗        ██╗\033[0m\n"
        "\033[1;97m  ██╔══██╗██╔════╝██╔════╝   \033[0m\033[1;91m   ██╗    ██╔╝       ██╔╝\033[0m\n"
        "\033[1;97m  ██████╔╝██║     █████╗     \033[0m\033[1;91m   ╚═╝   ██╔╝       ██╔╝ \033[0m\n"
        "\033[1;97m  ██╔══██╗██║     ██╔══╝     \033[0m\033[1;91m   ██╗  ██╔╝       ██╔╝  \033[0m\n"
        "\033[1;97m  ██║  ██║╚██████╗██║        \033[0m\033[1;91m   ╚═╝ ██╔╝       ██╔╝   \033[0m\n"
        "\033[1;97m  ╚═╝  ╚═╝ ╚═════╝╚═╝        \033[0m\033[1;91m      ╚═╝        ╚═╝     \033[0m\n\n"
        "\033[96m  🛡️  RCF Protocol — Restricted Correlation Framework\033[0m\n"
        "\033[90m  Sovereign Code Protection | Aladdin Aliyev\033[0m"
    )

    parser = argparse.ArgumentParser(
        prog='rcf-cli',
        description=audit_banner + "\n\n" + 'RCF CLI — Active Protection Framework',
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument('--version', action='version', version='rcf-cli 2.1.8')
    subparsers = parser.add_subparsers(dest="command", metavar="<command>")

    # init
    p_init = subparsers.add_parser("init", help="Initialize RCF in the current project")
    p_init.add_argument("--project", metavar="NAME", help="Project name")
    p_init.add_argument("--author", metavar="NAME", help="Author name")

    # audit
    p_audit = subparsers.add_parser("audit", help="Generate RCF-AUDIT-REPORT.json")
    p_audit.add_argument("path", nargs="?", default=".", metavar="PATH")
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
    p_protect.add_argument("--no-robots", action="store_true", help="Skip generating/updating robots.txt")
    p_protect.add_argument("--verbose", "-v", action="store_true")

    # sentinel
    p_sentinel = subparsers.add_parser("sentinel", help="Rank protected units by surprisal mass (watch-list)")
    p_sentinel.add_argument("path", nargs="?", default=".", help="project root to scan")
    p_sentinel.add_argument("--corpus", metavar="JSON", help="frozen corpus path")
    p_sentinel.add_argument("--top", type=int, default=5, help="how many sentinels to surface")

    # build-corpus
    p_build_corpus = subparsers.add_parser("build-corpus", help="Build and freeze a background corpus of language structures")
    p_build_corpus.add_argument("--project", metavar="ROOT", help="fold project's non-protected files into corpus")
    p_build_corpus.add_argument("--limit", type=int, default=None, help="cap stdlib units")
    p_build_corpus.add_argument("--out", metavar="JSON", help="output path")

    # build-null
    p_build_null = subparsers.add_parser("build-null", help="Calibrate a Monte Carlo null distribution model")
    p_build_null.add_argument("--project", metavar="ROOT", help="fold project's non-protected files into pool")
    p_build_null.add_argument("--limit", type=int, default=None, help="cap stdlib units")
    p_build_null.add_argument("--corpus", metavar="JSON", help="frozen corpus path")
    p_build_null.add_argument("--n-pairs", type=int, default=5000, dest="n_pairs", help="number of null pairs")
    p_build_null.add_argument("--seed", type=int, default=1337, help="RNG seed")
    p_build_null.add_argument("--iterations", type=int, default=2, help="WL depth")
    p_build_null.add_argument("--out", metavar="JSON", help="output path")

    # prove
    p_prove = subparsers.add_parser("prove", help="Compute similarity proof between two files")
    p_prove.add_argument("file_a")
    p_prove.add_argument("file_b")
    p_prove.add_argument("--null", metavar="JSON", help="frozen null path")
    p_prove.add_argument("--corpus", metavar="JSON", help="frozen corpus path")
    p_prove.add_argument("--iterations", type=int, default=2, help="WL depth")
    p_prove.add_argument("--search-space", type=int, default=1, dest="search_space", help="multiple-testing size")

    # canary
    p_canary = subparsers.add_parser("canary", help="Designed canary management")
    p_canary_sub = p_canary.add_subparsers(dest="canary_cmd", metavar="<subcommand>")

    p_canary_reg = p_canary_sub.add_parser("register", help="Register a designed canary")
    p_canary_reg.add_argument("--name", required=True, help="Canary name")
    p_canary_reg.add_argument("--desc", default="", help="Description")
    p_canary_reg.add_argument("--registry", default="rcf_canaries.json", help="Registry path")
    p_canary_group = p_canary_reg.add_mutually_exclusive_group(required=True)
    p_canary_group.add_argument("--file", help="Python file with canary block")
    p_canary_group.add_argument("--source", help="Inline Python snippet")

    p_canary_scan = p_canary_sub.add_parser("scan", help="Scan code for designed canaries")
    p_canary_scan.add_argument("path", help="Path to scan")
    p_canary_scan.add_argument("--registry", default="rcf_canaries.json", help="Registry path")

    # noise
    p_noise = subparsers.add_parser("noise", help="Inject adversarial AST noise into protected files to confuse AI models")
    p_noise.add_argument("path", nargs="?", default=".", metavar="PATH")
    p_noise.add_argument("--verbose", "-v", action="store_true")

    # gateway
    p_gateway = subparsers.add_parser("gateway", help="Export WAF configuration files for Cloudflare or Nginx")
    p_gateway_sub = p_gateway.add_subparsers(dest="gateway_cmd", metavar="<subcommand>")

    p_gateway_cf = p_gateway_sub.add_parser("cloudflare", help="Export Cloudflare Worker WAF script")
    p_gateway_cf.add_argument("--out", "-o", default=".", help="Output directory")

    p_gateway_nginx = p_gateway_sub.add_parser("nginx", help="Export Nginx Lua WAF script and configuration snippet")
    p_gateway_nginx.add_argument("--out", "-o", default=".", help="Output directory")

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
    elif args.command == "sentinel":
        from rcf_core.sigma import load_sigma
        from rcf_core.corpus import load_corpus
        from rcf_core.sentinel import rank_sentinels
        sigma = load_sigma()
        try:
            corpus = load_corpus(args.corpus, sigma=sigma)
        except Exception as e:
            print(f"❌ {e}", file=sys.stderr)
            print("   Build/freeze a corpus first (rcf-cli build-corpus).", file=sys.stderr)
            sys.exit(1)
        sentinels = rank_sentinels(args.path, corpus, sigma, top_n=args.top)
        if not sentinels:
            print("\nNo protected Python function units found.")
            sys.exit(0)
        print(f"\nTop {len(sentinels)} natural sentinels (by surprisal mass):")
        for i, s in enumerate(sentinels, 1):
            pct = round(s.uniqueness_ratio * 100)
            print(f"  {i}. mass={s.total_mass:7.1f}  uniqueness={pct:3d}%   {s.label}")
        sys.exit(0)
    elif args.command == "build-corpus":
        import time
        from rcf_core.sigma import load_sigma
        from rcf_core.corpus import collect_stdlib_sources, collect_project_background_sources, build_corpus, freeze as freeze_corpus
        sigma = load_sigma()
        t0 = time.time()
        print("collecting stdlib sources...")
        stdlib = collect_stdlib_sources(limit=args.limit)
        print(f"  stdlib units: {len(stdlib)}  ({time.time() - t0:.1f}s)")
        proj = []
        if args.project:
            proj = collect_project_background_sources(args.project)
            print(f"  project background units (non-protected): {len(proj)}")
        corpus = build_corpus(stdlib + proj, sigma)
        print(f"  corpus: {corpus.total_units} units, {len(corpus.doc_freq)} features, Σ {corpus.sigma_version}")
        path = freeze_corpus(corpus, args.out)
        print(f"frozen to: {path}  ({os.path.getsize(path)} bytes)")
        sys.exit(0)
    elif args.command == "build-null":
        from rcf_core.sigma import load_sigma
        from rcf_core.corpus import load_corpus, collect_stdlib_sources, collect_project_background_sources
        from rcf_core.proof import build_null, freeze as freeze_null
        sigma = load_sigma()
        try:
            corpus = load_corpus(args.corpus, sigma=sigma)
        except Exception as e:
            print(f"❌ {e}", file=sys.stderr)
            sys.exit(1)
        print("collecting pool sources...")
        stdlib = collect_stdlib_sources(limit=args.limit)
        proj = []
        if args.project:
            proj = collect_project_background_sources(args.project)
        pool = stdlib + proj
        print(f"  pool size: {len(pool)} units")
        null_dist = build_null(pool, corpus, sigma, n_pairs=args.n_pairs, seed=args.seed, iterations=args.iterations)
        path = freeze_null(null_dist, args.out)
        print(f"✅ Null model built successfully with {args.n_pairs} pairs.")
        print(f"   Saved to: {path}")
        sys.exit(0)
    elif args.command == "prove":
        from rcf_core.sigma import load_sigma
        from rcf_core.corpus import load_corpus
        from rcf_core.proof import load_null, prove_sources_from_files
        sigma = load_sigma()
        try:
            corpus = load_corpus(args.corpus, sigma=sigma)
            null_model = load_null(args.null, sigma=sigma)
        except Exception as e:
            print(f"❌ {e}", file=sys.stderr)
            sys.exit(1)
        try:
            rep = prove_sources_from_files(
                args.file_a, args.file_b,
                null_model, corpus, sigma,
                iterations=args.iterations,
                search_space=args.search_space,
            )
        except (ValueError, ImportError) as e:
            print(f"❌ {e}", file=sys.stderr)
            sys.exit(1)
        except Exception as e:
            print(f"❌ Error proving: {e}", file=sys.stderr)
            sys.exit(1)
        print("\n--- RCF Court-Grade Similarity Proof ---")
        print(f"Score        : {rep.score:.4f}")
        print(f"Z-Score      : {rep.z_score:.2f}")
        print(f"p-empirical  : {rep.p_empirical:.2e}  (floor: {rep.p_empirical_floor:.2e})")
        print(f"p-parametric : {rep.p_parametric:.2e}")
        print(f"E-value      : {rep.e_value:.2e}")
        if rep.significant:
            print("✅ Statistical significance established (tail floor reached).")
        else:
            print("❌ Not statistically significant.")
        sys.exit(0)
    elif args.command == "canary":
        if not args.canary_cmd:
            p_canary.print_help()
            sys.exit(1)
        from rcf_core.sigma import load_sigma
        from rcf_core.canary import CanaryRegistry, extract_canary_block
        sigma = load_sigma()
        registry_path = Path(args.registry).resolve()

        if args.canary_cmd == "register":
            registry = CanaryRegistry(registry_path, sigma)
            if args.source:
                source = args.source
                if not source.strip().startswith("def "):
                    indented = "\n".join("    " + line for line in source.splitlines())
                    source = f"def __canary_dummy():\n{indented}\n"
            else:
                p = Path(args.file).resolve()
                if not p.is_file():
                    print(f"❌ Error: File not found: {p}", file=sys.stderr)
                    sys.exit(1)
                content = p.read_text(encoding="utf-8", errors="ignore")
                source = extract_canary_block(content)
                if not source:
                    print(f"❌ Error: No [RCF:CANARY_START] and [RCF:CANARY_END] markers found in {p.name}.", file=sys.stderr)
                    sys.exit(1)
            try:
                registry.register(args.name, source, args.desc)
                print(f"✅ Successfully registered canary '{args.name}' in registry '{args.registry}'.")
                sys.exit(0)
            except Exception as e:
                print(f"❌ Error registering canary: {e}", file=sys.stderr)
                sys.exit(1)

        elif args.canary_cmd == "scan":
            if not registry_path.exists():
                print(f"❌ Error: Registry file not found at: {registry_path}", file=sys.stderr)
                sys.exit(1)
            registry = CanaryRegistry(registry_path, sigma)
            if not registry.canaries:
                print("No valid canaries loaded from registry. Nothing to scan.")
                sys.exit(0)
            target_path = Path(args.path).resolve()
            py_files = []
            if target_path.is_file():
                py_files.append(target_path)
            else:
                for root, _, files in os.walk(target_path):
                    for file in files:
                        if file.endswith(".py"):
                            py_files.append(Path(root) / file)
            hits = []
            for pf in py_files:
                try:
                    content = pf.read_text(encoding="utf-8", errors="ignore")
                except Exception:
                    continue
                matches = registry.scan(content)
                for name, score in matches.items():
                    hits.append((pf, name, score))
            if hits:
                print(f"🚨 Designed Canaries Detected ({len(hits)} hit(s)):")
                for path, name, score in hits:
                    print(f"   [{name}] match_score={score:.4f}  in  {path.relative_to(target_path.parent)}")
                sys.exit(1)
            else:
                print("🛡️  No designed canaries detected. Scan clean.")
                sys.exit(0)
    elif args.command == "noise":
        from rcf_core import inject_adversarial_noise_python
        target_path = Path(args.path).resolve()
        py_files = []
        if target_path.is_file():
            if target_path.suffix == ".py":
                py_files.append(target_path)
        else:
            for root, _, files in os.walk(target_path):
                for file in files:
                    if file.endswith(".py"):
                        py_files.append(Path(root) / file)

        if not py_files:
            print("No Python files found to inject noise.")
            sys.exit(0)

        modified_count = 0
        for fpath in py_files:
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue

            # Only target protected files
            if "[RCF:PROTECTED]" not in content and "[RCF:RESTRICTED]" not in content and "protected under RCF-PL" not in content:
                continue

            new_content = inject_adversarial_noise_python(content)
            if new_content != content:
                try:
                    fpath.write_text(new_content, encoding="utf-8")
                    modified_count += 1
                    if args.verbose:
                        print(f"✅ Injected noise: {fpath.relative_to(target_path.parent if target_path.is_dir() else target_path.parent.parent)}")
                except OSError as e:
                    print(f"❌ Error writing {fpath}: {e}")

        print(f"🛡️  AST Adversarial Noise process complete. Modified {modified_count} file(s).")
        sys.exit(0)
    elif args.command == "gateway":
        if not args.gateway_cmd:
            p_gateway.print_help()
            sys.exit(1)

        out_dir = Path(args.out).resolve()
        if not out_dir.is_dir():
            print(f"❌ Error: Output directory does not exist: {out_dir}", file=sys.stderr)
            sys.exit(1)

        if args.gateway_cmd == "cloudflare":
            target_file = out_dir / "cloudflare_worker.ts"
            try:
                target_file.write_text(CLOUDFLARE_WAF_CODE, encoding="utf-8")
                print(f"✅ Cloudflare Worker WAF script exported to: {target_file}")
                sys.exit(0)
            except OSError as e:
                print(f"❌ Error: {e}", file=sys.stderr)
                sys.exit(1)
        elif args.gateway_cmd == "nginx":
            lua_file = out_dir / "rcf_waf.lua"
            conf_file = out_dir / "nginx.conf"
            try:
                lua_file.write_text(NGINX_WAF_LUA, encoding="utf-8")
                conf_file.write_text(NGINX_CONF_SNIPPET, encoding="utf-8")
                print(f"✅ Nginx WAF Lua script exported to: {lua_file}")
                print(f"✅ Nginx configuration snippet exported to: {conf_file}")
                sys.exit(0)
            except OSError as e:
                print(f"❌ Error: {e}", file=sys.stderr)
                sys.exit(1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
