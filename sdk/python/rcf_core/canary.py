# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Canary — designed evidence engine (RCF v3 §6).

Implements the designed canary mechanism. A canary is an injected,
functionally-neutral arbitrary choice represented as a query PDG.
We detect canaries in target codebases using subgraph isomorphism.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .pdg import PDG, Node, Edge
from .sigma import Sigma, SigmaError, load_sigma
from .normalize_python import normalize_python
from .corpus import iter_function_units


import re

# Strict path validation pattern allowing only standard path characters and rejecting '..'
_SAFE_PATH_RE = re.compile(r'^[a-zA-Z0-9_\-\.\/\\ ]+$')

def _safe_resolve_registry(raw: Path | str) -> Path:
    """Resolve a registry path and validate it is a .json file.

    Raises ``ValueError`` if the path has an unexpected suffix or contains
    unsafe traversal characters, preventing path traversal into arbitrary files.
    """
    raw_str = str(raw)
    if ".." in raw_str or not _SAFE_PATH_RE.match(raw_str):
        raise ValueError("Invalid registry path: directory traversal or unsafe characters detected.")
    
    p = Path(raw_str).resolve()
    if p.suffix.lower() != ".json":
        raise ValueError(
            f"Registry path must point to a .json file, got: '{p.suffix}'"
        )
    return p


def find_subgraph_isomorphisms(g_c: PDG, g_t: PDG) -> list[dict[int, int]]:
    """
    Find all injective subgraph isomorphism mappings f: V_c -> V_t.
    Returns a list of dicts mapping canary node IDs to target node IDs.
    
    A node in the canary (g_c) matches a target node (g_t) if they share the same
    class, and (if the canary specifies an operator) the same operator.
    Edges must match in direction and type.
    """
    nodes_c = g_c.nodes
    nodes_t = g_t.nodes

    if not nodes_c:
        return []

    # Pre-calculate adjacency lists to speed up edge verification
    adj_c: dict[int, list[tuple[int, str, str]]] = {n.nid: [] for n in nodes_c}
    for e in g_c.edges:
        adj_c[e.src].append((e.dst, e.etype, "OUT"))
        adj_c[e.dst].append((e.src, e.etype, "IN"))

    adj_t: dict[int, list[tuple[int, str, str]]] = {n.nid: [] for n in nodes_t}
    for e in g_t.edges:
        adj_t[e.src].append((e.dst, e.etype, "OUT"))
        adj_t[e.dst].append((e.src, e.etype, "IN"))

    results: list[dict[int, int]] = []

    def backtrack(idx: int, mapping: dict[int, int], used_t: set[int]) -> None:
        if idx == len(nodes_c):
            results.append(mapping.copy())
            return

        u_c = nodes_c[idx]

        for u_t in nodes_t:
            if u_t.nid in used_t:
                continue

            # Class must match.
            if u_c.cls != u_t.cls:
                continue

            # Treat REF.PARAM, REF.LOCAL, REF.GLOBAL as equivalent variable references
            if u_c.cls == "REF" and u_c.op in {"PARAM", "LOCAL", "GLOBAL"}:
                if u_t.op not in {"PARAM", "LOCAL", "GLOBAL"}:
                    continue
            else:
                if u_c.op is not None and u_c.op != u_t.op:
                    continue

            # Check structural consistency with all already-mapped nodes.
            consistent = True
            for neighbor_c, etype, direction in adj_c[u_c.nid]:
                if neighbor_c in mapping:
                    mapped_neighbor_t = mapping[neighbor_c]
                    # Verify edge exists in g_t in the same direction and of the same type.
                    edge_found = False
                    for neighbor_t, t_etype, t_direction in adj_t[u_t.nid]:
                        if neighbor_t == mapped_neighbor_t and t_etype == etype and t_direction == direction:
                            edge_found = True
                            break
                    if not edge_found:
                        consistent = False
                        break

            if consistent:
                mapping[u_c.nid] = u_t.nid
                used_t.add(u_t.nid)
                backtrack(idx + 1, mapping, used_t)
                used_t.remove(u_t.nid)
                del mapping[u_c.nid]

    backtrack(0, {}, set())
    return results


def pdg_from_dict(d: dict[str, Any], sigma: Sigma) -> PDG:
    """Reconstruct a PDG object from its serialized dictionary form."""
    g = PDG(sigma)
    id_map = {}
    for node_data in d["nodes"]:
        old_id = node_data["id"]
        label = node_data["label"]
        if "." in label:
            cls, op = label.split(".", 1)
        else:
            cls, op = label, None
        new_id = g.add_node(cls, op)
        id_map[old_id] = new_id

    for edge_data in d["edges"]:
        src = id_map[edge_data["src"]]
        dst = id_map[edge_data["dst"]]
        etype = edge_data["type"]
        g.add_edge(src, dst, etype)

    return g


@dataclass
class CanaryRecord:
    name: str
    created_at: str
    description: str
    pdg: PDG

    def to_dict(self) -> dict[str, Any]:
        pdg_dict = self.pdg.to_dict()
        return {
            "name": self.name,
            "created_at": self.created_at,
            "description": self.description,
            "sigma_version": pdg_dict["sigma_version"],
            "alphabet_hash": pdg_dict["alphabet_hash"],
            "nodes": pdg_dict["nodes"],
            "edges": pdg_dict["edges"],
        }

    @classmethod
    def from_dict(cls, d: dict[str, Any], sigma: Sigma) -> CanaryRecord:
        pdg = pdg_from_dict(d, sigma)
        return cls(
            name=d["name"],
            created_at=d["created_at"],
            description=d.get("description", ""),
            pdg=pdg,
        )


class CanaryRegistry:
    """Manages the private registry of timestamped designed canaries."""

    def __init__(self, registry_path: Path, sigma: Sigma):
        self.registry_path = _safe_resolve_registry(registry_path)
        self.sigma = sigma
        self.canaries: dict[str, CanaryRecord] = {}
        self.load()

    def load(self) -> None:
        if not self.registry_path.exists():
            self.canaries = {}
            return
        try:
            with open(self.registry_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            records = data.get("canaries", [])
            for r in records:
                # verify alphabet hash match before loading
                if r.get("alphabet_hash") != self.sigma.alphabet_hash:
                    print(
                        "⚠️ Warning: A canary entry was built with a different alphabet hash. Skipping.",
                        file=sys.stderr,
                    )
                    continue
                record = CanaryRecord.from_dict(r, self.sigma)
                self.canaries[record.name] = record
        except (json.JSONDecodeError, KeyError, ValueError) as e:
            raise SigmaError(f"Failed to load canary registry: {e}")

    def save(self) -> None:
        payload = {
            "canaries": [c.to_dict() for c in self.canaries.values()]
        }
        self.registry_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.registry_path, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, sort_keys=True)

    def register(self, name: str, source_code: str, description: str = "") -> None:
        """Parse source code, construct its PDG, and add to the registry."""
        pdg = normalize_python(source_code, self.sigma)
        if not pdg.nodes:
            raise ValueError("Parsed canary source yielded an empty PDG.")
        
        record = CanaryRecord(
            name=name,
            created_at=datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
            description=description,
            pdg=pdg,
        )
        self.canaries[name] = record
        self.save()


def extract_canary_block(file_content: str) -> str:
    """Extract code lines between [RCF:CANARY_START] and [RCF:CANARY_END]."""
    lines = file_content.splitlines()
    block_lines = []
    in_block = False
    for line in lines:
        if "[RCF:CANARY_START]" in line:
            in_block = True
            continue
        if "[RCF:CANARY_END]" in line:
            in_block = False
            break
        if in_block:
            block_lines.append(line)

    if not block_lines:
        return ""

    # Indent block to wrap it cleanly in a function definition
    indented = "\n".join("    " + line for line in block_lines)
    return f"def __canary_dummy():\n{indented}\n"


# ─── CLI ──────────────────────────────────────────────────────────────────────

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="python -m rcf_core.canary",
        description="Designed Canary Engine: register and scan for injected, functionally-neutral canaries.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    # register command
    reg_parser = subparsers.add_parser("register", help="Register a designed canary from source.")
    reg_parser.add_argument("--name", required=True, help="Unique name for the canary.")
    reg_parser.add_argument("--desc", default="", help="Description of the canary.")
    reg_parser.add_argument("--registry", default="rcf_canaries.json", help="Path to canaries registry file.")
    group = reg_parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--file", help="Python file containing [RCF:CANARY_START] / [RCF:CANARY_END] block.")
    group.add_argument("--source", help="Inline Python source code snippet.")

    # scan command
    scan_parser = subparsers.add_parser("scan", help="Scan a directory or file for registered canaries.")
    scan_parser.add_argument("path", help="Path to file or directory to scan.")
    scan_parser.add_argument("--registry", default="rcf_canaries.json", help="Path to canaries registry file.")

    args = parser.parse_args(argv)
    sigma = load_sigma()
    registry_path = Path(args.registry).resolve()

    if args.command == "register":
        registry = CanaryRegistry(registry_path, sigma)
        if args.source:
            source = args.source
            # wrap in function if not already present to ensure normalizer runs correctly
            if not source.strip().startswith("def "):
                indented = "\n".join("    " + line for line in source.splitlines())
                source = f"def __canary_dummy():\n{indented}\n"
        else:
            p = Path(args.file).resolve()
            if not p.is_file():
                print(f"❌ Error: File not found: {p}", file=sys.stderr)
                return 1
            content = p.read_text(encoding="utf-8", errors="ignore")
            source = extract_canary_block(content)
            if not source:
                print(f"❌ Error: No [RCF:CANARY_START] and [RCF:CANARY_END] markers found in {p.name}.", file=sys.stderr)
                return 1

        try:
            registry.register(args.name, source, args.desc)
            print(f"✅ Successfully registered canary '{args.name}' in registry '{args.registry}'.")
            return 0
        except Exception as e:
            print(f"❌ Error registering canary: {e}", file=sys.stderr)
            return 1

    elif args.command == "scan":
        if not registry_path.exists():
            print(f"❌ Error: Registry registry file not found at: {registry_path}", file=sys.stderr)
            return 1
        
        registry = CanaryRegistry(registry_path, sigma)
        if not registry.canaries:
            print("No valid canaries loaded from registry. Nothing to scan.")
            return 0

        target_path = Path(args.path).resolve()
        py_files: list[Path] = []
        if target_path.is_file():
            if target_path.suffix == ".py":
                py_files.append(target_path)
        elif target_path.is_dir():
            for root, _, files in os.walk(target_path):
                for f in files:
                    if f.endswith(".py"):
                        py_files.append(Path(root) / f)

        if not py_files:
            print("No Python files found to scan.")
            return 0

        print(f"Scanning {len(py_files)} file(s) for {len(registry.canaries)} registered canary/canaries...")
        found_any = False

        for fpath in py_files:
            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
            except OSError:
                continue
                
            units = iter_function_units(content)
            for unit_src in units:
                try:
                    target_pdg = normalize_python(unit_src, sigma)
                except Exception:
                    continue

                if not target_pdg.nodes:
                    continue

                # get a friendly label for the target function unit
                lines = unit_src.strip().splitlines()
                fn_label = lines[0].strip() if lines else "unknown_function"

                for canary_name, canary_rec in registry.canaries.items():
                    matches = find_subgraph_isomorphisms(canary_rec.pdg, target_pdg)
                    if matches:
                        found_any = True
                        rel_path = os.path.relpath(fpath, target_path if target_path.is_dir() else target_path.parent)
                        print(f"🚨 CANARY DETECTED: '{canary_name}' found in {rel_path} inside '{fn_label}'!")
                        print(f"  Description: {canary_rec.description}")
                        print(f"  Number of match configurations: {len(matches)}")
                        # Print first mapping configuration as proof
                        proof = matches[0]
                        print("  Sample node mapping (Canary Node ID -> Target Node ID):")
                        for c_id, t_id in sorted(proof.items()):
                            c_node = canary_rec.pdg.node(c_id)
                            t_node = target_pdg.node(t_id)
                            print(f"    Node {c_id} ({c_node.label}) -> Node {t_id} ({t_node.label})")
                        print()

        if not found_any:
            print("Scan complete. No registered canaries detected.")
        return 0

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
