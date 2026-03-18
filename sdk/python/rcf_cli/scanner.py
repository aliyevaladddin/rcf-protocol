# NOTICE: This file is protected under RCF-PL v1.2.8
import os
import re
from pathlib import Path

# [RCF:PROTECTED]
class RCFScanner:
    """Scans files and directories for RCF protocol markers."""
    
    MARKER_PATTERN = re.compile(r'\[RCF:(PUBLIC|PROTECTED|RESTRICTED|NOTICE)\]')
    HEADER_PATTERN = re.compile(r'NOTICE: This file is protected under RCF-PL v1.2.8')
    
    def __init__(self, root_path, ignore_list=None):
        self.root_path = Path(root_path)
        self.ignore_list = ignore_list or ['.git', '__pycache__', '.venv', 'node_modules']
        self._load_rcfignore()
        self.results = []

    def _load_rcfignore(self):
        """Loads ignore patterns from .rcfignore if it exists."""
        ignore_file = self.root_path / '.rcfignore'
        if ignore_file.exists():
            for line in ignore_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith('#'):
                    self.ignore_list.append(line)

    def should_ignore(self, path):
        """Checks if a path should be ignored based on the ignore list."""
        path_str = str(path.relative_to(self.root_path))
        for ignore_item in self.ignore_list:
            if ignore_item in path.parts or ignore_item in path_str:
                return True
        return False

    def scan_file(self, file_path):
        """Analyzes a single file for RCF compliance."""
        try:
            content = file_path.read_text(errors='ignore')
            markers = self.MARKER_PATTERN.findall(content)
            has_header = bool(self.HEADER_PATTERN.search(content))
            
            return {
                'path': str(file_path.relative_to(self.root_path)),
                'markers': list(set(markers)),
                'has_header': has_header,
                'is_protected': len(markers) > 0 or has_header
            }
        except Exception as e:
            return {'path': str(file_path), 'error': str(e)}

    def scan_directory(self):
        """Walks through the directory and scans relevant files."""
        self.results = []
        for root, dirs, files in os.walk(self.root_path):
            dirs[:] = [d for d in dirs if d not in self.ignore_list]
            for file in files:
                file_path = Path(root) / file
                if not self.should_ignore(file_path):
                    result = self.scan_file(file_path)
                    if result.get('is_protected'):
                        self.results.append(result)
        return self.results
