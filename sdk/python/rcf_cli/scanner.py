# NOTICE: This file is protected under RCF-PL v2.0
import os
import re
from pathlib import Path

# [RCF:PROTECTED]
class RCFScanner:
    """Scans files and directories for RCF protocol markers."""

    MARKER_PATTERN = re.compile(r'\[RCF:(PUBLIC|PROTECTED|RESTRICTED|NOTICE)\]')
    GHOST_PATTERN  = re.compile(r'\[RCF:GHOST:([a-fA-F0-9]{16,64})\]')
    HEADER_PATTERN = re.compile(r'NOTICE: This file is protected under RCF-PL v2\.0')

    # Эвристики: паттерны, указывающие на защищаемую логику
    LOGIC_PATTERNS = [
        re.compile(r'^\s*abstract\s+class\s+\w+', re.MULTILINE | re.IGNORECASE),
        re.compile(r'^\s*(export\s+)?(class|interface|type|enum)\s+\w+', re.MULTILINE | re.IGNORECASE),
        re.compile(r'^\s*(def |async def )\w+\s*\(', re.MULTILINE),
        re.compile(r'^\s*(const|let|var)\s+\w+\s*=\s*(async\s+)?\(.*\)\s*=>', re.MULTILINE), # arrow funcs
        re.compile(r'^\s*@\w+', re.MULTILINE), # general decorators
        re.compile(r'^\s*(algorithm|correlation|model|engine)\s*=', re.MULTILINE | re.IGNORECASE),
        re.compile(r'(sha256|hashlib|hmac|encrypt|decrypt|crypto)', re.IGNORECASE),
    ]

    # [RCF:PROTECTED]
    SCANNABLE_EXTENSIONS = {
        '.py', '.js', '.ts', '.go', '.rs', '.java', '.cpp', '.c',
        '.cs', '.rb', '.php', '.swift', '.kt', '.scala', '.tsx',
        '.jsx', '.mjs', '.cjs', '.md', 'makefile', '.s', '.h'
    }

    @staticmethod
    def generate_ghost_marker(content: str, secret_key: str) -> str:
        """Generates a dynamic Ghost Marker signature (16-char HMAC)."""
        import hmac
        import hashlib
        signature = hmac.new(
            secret_key.encode(),
            content.strip().encode(),
            hashlib.sha256
        ).hexdigest()[:16]
        return f"RCF:GHOST:{signature}"

    def __init__(self, root_path, ignore_list=None, verbose=False):
        self.root_path = Path(root_path).resolve()
        self.ignore_list = ignore_list or [
            '.git', '__pycache__', '.venv', 'node_modules',
            '.mypy_cache', '.pytest_cache', 'dist', 'build'
        ]
        self.verbose = verbose
        self._load_rcfignore()
        self.results = []

    def _load_rcfignore(self):
        """Loads ignore patterns from .rcfignore if it exists."""
        ignore_file = self.root_path / '.rcfignore'
        if ignore_file.exists():
            for line in ignore_file.read_text(encoding='utf-8').splitlines():
                line = line.strip()
                if line and not line.startswith('#'):
                    self.ignore_list.append(line)
            if self.verbose:
                print(f"[rcf] Loaded .rcfignore: {len(self.ignore_list)} ignore rules")

    def should_ignore(self, path: Path) -> bool:
        """Checks if a path should be ignored."""
        try:
            path_str = str(path.relative_to(self.root_path))
        except ValueError:
            path_str = str(path)
        for item in self.ignore_list:
            if item in path.parts or item in path_str:
                return True
        return False

    def detect_unprotected_logic(self, file_path: Path) -> list[dict]:
        """
        Detects blocks of logic that lack RCF markers.
        Returns a list of findings: {line, type, snippet}.
        """
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception:
            return []

        lines = content.splitlines()
        findings = []

        for i, line in enumerate(lines, start=1):
            for pattern in self.LOGIC_PATTERNS:
                if pattern.search(line):
                    # Проверяем: есть ли маркер в ближайших 5 строках выше
                    context_start = max(0, i - 6)
                    context = '\n'.join(lines[context_start:i])
                    if not self.MARKER_PATTERN.search(context):
                        findings.append({
                            'line': i,
                            'type': _classify_line(line),
                            'snippet': line.strip()[:80]
                        })
                    break  # одна находка на строку достаточно

        return findings

    def scan_file(self, file_path: Path) -> dict:
        """Analyzes a single file for RCF compliance."""
        try:
            content = file_path.read_text(encoding='utf-8', errors='ignore')
        except Exception as e:
            return {'path': str(file_path), 'error': str(e)}

        markers = self.MARKER_PATTERN.findall(content)
        ghost_markers = self.GHOST_PATTERN.findall(content)
        has_header = bool(self.HEADER_PATTERN.search(content))
        unprotected_logic = self.detect_unprotected_logic(file_path)

        try:
            rel_path = str(file_path.relative_to(self.root_path))
        except ValueError:
            rel_path = str(file_path)

        if self.verbose:
            status = 'PROTECTED' if (markers or has_header or ghost_markers) else 'UNPROTECTED'
            print(f"[rcf] {status:12s} {rel_path}  markers={markers} ghost={len(ghost_markers)}  unprotected_blocks={len(unprotected_logic)}")

        return {
            'path': rel_path,
            'markers': list(set(markers)),
            'ghost_markers': [g.lower() for g in ghost_markers],
            'has_header': has_header,
            'is_protected': bool(markers) or has_header or bool(ghost_markers),
            'unprotected_logic': unprotected_logic,
            'has_unprotected_logic': len(unprotected_logic) > 0,
        }

    def scan_directory(self, include_protected=False) -> list[dict]:
        """
        Walks through the directory and scans relevant files.
        """
        self.results = []
        scanned = 0

        for root, dirs, files in os.walk(self.root_path):
            dirs[:] = [
                d for d in dirs
                if not self.should_ignore(Path(root) / d)
            ]

            for file in files:
                file_path = Path(root) / file

                if file_path.suffix not in self.SCANNABLE_EXTENSIONS:
                    continue

                if self.should_ignore(file_path):
                    continue

                scanned += 1
                result = self.scan_file(file_path)

                if 'error' in result:
                    self.results.append(result)
                    continue

                needs_attention = (
                    result['has_unprotected_logic'] or not result['has_header']
                )

                if include_protected or needs_attention:
                    self.results.append(result)

        if self.verbose:
            print(f"\n[rcf] Scanned {scanned} files, {len(self.results)} need attention.")

        return self.results

    def get_summary(self) -> dict:
        """Returns a summary of the last scan."""
        protected = sum(1 for r in self.results if r.get('is_protected'))
        unprotected = sum(1 for r in self.results if not r.get('is_protected'))
        files_with_gaps = sum(1 for r in self.results if r.get('has_unprotected_logic'))
        total_gaps = sum(len(r.get('unprotected_logic', [])) for r in self.results)
        return {
            'protected_files': protected,
            'unprotected_files': unprotected,
            'files_with_gaps': files_with_gaps,
            'total_unprotected_blocks': total_gaps,
        }


def _classify_line(line: str) -> str:
    """Returns a human-readable type for a logic line."""
    stripped = line.strip().lower()
    if 'abstract class' in stripped:
        return 'abstract_class'
    if 'interface' in stripped:
        return 'interface'
    if 'type ' in stripped or 'type_alias' in stripped:
        return 'type'
    if 'enum' in stripped:
        return 'enum'
    if 'class ' in stripped:
        return 'class'
    if 'async def' in stripped or '=>' in stripped:
        return 'async_logic'
    if 'def ' in stripped:
        return 'function'
    if stripped.startswith('@'):
        return 'decorator'
    if any(k in stripped for k in ('encrypt', 'decrypt', 'sha256', 'hmac', 'hashlib', 'crypto')):
        return 'crypto_logic'
    return 'logic_block'
