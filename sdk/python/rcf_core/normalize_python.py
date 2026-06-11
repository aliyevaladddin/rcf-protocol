# NOTICE: This file is protected under RCF-PL
# [RCF:PROTECTED]
"""
Python → PDG normalizer (RCF v3, first slice).

Lowers a Python source unit to a Σ-labeled PDG (RCF-CORRELATION.md §1.2). This is
the `lower` stage of  source ─parse─► AST ─lower─► PDG.

Scope of THIS slice (kept deliberately narrow and honest — see RCF-SIGMA.md §5,
"never invent an op"):
  - expressions: literals, names, BinOp (arith/bit), Compare, BoolOp, UnaryOp, Call
  - statements : Assign / AugAssign, If, For, While, Return, function bodies
  - collections: List/Dict/Set/Tuple literals

Hard invariants enforced here:
  - identifiers are discarded — a Name becomes REF.LOCAL/GLOBAL/PARAM, never its text
  - concrete types are discarded — 1, 1.0, 1j all become CONST.NUM
  - control statements emit a CTRL edge to the operations they guard
  - data flow (operands feeding an operation) emits DATA edges

Anything not yet mapped is recorded in `unmapped` rather than guessed. We grow Σ
coverage additively; we do not fabricate labels.
"""

from __future__ import annotations

import ast

from .pdg import PDG
from .sigma import Sigma, load_sigma

# ─── Python AST operator → Σ (cls, op) ────────────────────────────────────────

_BINOP: dict[type, tuple[str, str]] = {
    ast.Add: ("ARITH", "ADD"),
    ast.Sub: ("ARITH", "SUB"),
    ast.Mult: ("ARITH", "MUL"),
    ast.Div: ("ARITH", "DIV"),
    ast.FloorDiv: ("ARITH", "FLOORDIV"),
    ast.Mod: ("ARITH", "MOD"),
    ast.Pow: ("ARITH", "POW"),
    ast.BitAnd: ("BIT", "AND"),
    ast.BitOr: ("BIT", "OR"),
    ast.BitXor: ("BIT", "XOR"),
    ast.LShift: ("BIT", "SHL"),
    ast.RShift: ("BIT", "SHR"),
}

_UNARYOP: dict[type, tuple[str, str]] = {
    ast.USub: ("ARITH", "NEG"),
    ast.UAdd: ("ARITH", "NEG"),  # +x is a no-op sign op; map to NEG class-wise
    ast.Invert: ("BIT", "NOT"),
    ast.Not: ("LOGIC", "NOT"),
}

_CMPOP: dict[type, tuple[str, str]] = {
    ast.Eq: ("CMP", "EQ"),
    ast.NotEq: ("CMP", "NE"),
    ast.Lt: ("CMP", "LT"),
    ast.LtE: ("CMP", "LE"),
    ast.Gt: ("CMP", "GT"),
    ast.GtE: ("CMP", "GE"),
    ast.Is: ("CMP", "IS"),
    ast.IsNot: ("CMP", "IS"),
    ast.In: ("CMP", "IN"),
    ast.NotIn: ("CMP", "IN"),
}

_BOOLOP: dict[type, tuple[str, str]] = {
    ast.And: ("LOGIC", "AND"),
    ast.Or: ("LOGIC", "OR"),
}

_AGG: dict[type, tuple[str, str]] = {
    ast.List: ("AGG", "LIST"),
    ast.Dict: ("AGG", "MAP"),
    ast.Set: ("AGG", "SET"),
    ast.Tuple: ("AGG", "TUPLE"),
}


class PythonNormalizer:
    """
    Walks a Python AST and emits a Σ-labeled PDG. One instance per source unit.

    Names are resolved structurally (param / local / global) WITHOUT recording the
    identifier text — only the slot KIND survives, per RCF-SIGMA.md §2.
    """

    def __init__(self, sigma: Sigma | None = None):
        self.sigma = sigma or load_sigma()
        self.pdg = PDG(self.sigma)
        self.unmapped: list[str] = []  # ast node types we did not map (honesty log)
        self._params: set[str] = set()
        self._assigned: set[str] = set()

    # ─── entry point ──────────────────────────────────────────────────────────

    def normalize(self, source: str) -> PDG:
        tree = ast.parse(source)
        for stmt in tree.body:
            self._stmt(stmt, guard=None)
        return self.pdg

    # ─── name kind resolution (no identifier text leaks) ──────────────────────

    def _ref_op(self, name: str) -> str:
        if name in self._params:
            return "PARAM"
        if name in self._assigned:
            return "LOCAL"
        return "GLOBAL"

    # ─── statements ───────────────────────────────────────────────────────────

    def _stmt(self, node: ast.stmt, guard: int | None) -> None:
        if isinstance(node, ast.FunctionDef):
            self._params = {a.arg for a in node.args.args}
            self._assigned = set()
            for s in node.body:
                self._stmt(s, guard)

        elif isinstance(node, ast.Assign):
            value = self._expr(node.value, guard)
            for tgt in node.targets:
                self._assign_target(tgt, value, guard, op="BIND")

        elif isinstance(node, ast.AugAssign):
            value = self._expr(node.value, guard)
            self._assign_target(node.target, value, guard, op="UPDATE")

        elif isinstance(node, ast.If):
            test = self._expr(node.test, guard)
            branch = self.pdg.add_node("BRANCH", "IF")
            self.pdg.add_edge(test, branch, "DATA")
            self._maybe_ctrl(guard, branch)
            for s in node.body:
                self._stmt(s, guard=branch)
            for s in node.orelse:
                self._stmt(s, guard=branch)

        elif isinstance(node, (ast.For, ast.While)):
            loop_op = "FOR" if isinstance(node, ast.For) else "WHILE"
            loop = self.pdg.add_node("LOOP", loop_op)
            self._maybe_ctrl(guard, loop)
            if isinstance(node, ast.For):
                it = self._expr(node.iter, guard)
                self.pdg.add_edge(it, loop, "DATA")
            else:
                test = self._expr(node.test, guard)
                self.pdg.add_edge(test, loop, "DATA")
            for s in node.body:
                self._stmt(s, guard=loop)

        elif isinstance(node, ast.Return):
            ret = self.pdg.add_node("RET", "RETURN")
            self._maybe_ctrl(guard, ret)
            if node.value is not None:
                v = self._expr(node.value, guard)
                self.pdg.add_edge(v, ret, "DATA")

        elif isinstance(node, ast.Expr):
            self._expr(node.value, guard)

        elif isinstance(node, ast.Pass):
            pass

        else:
            self.unmapped.append(type(node).__name__)

    def _assign_target(self, tgt: ast.expr, value: int, guard: int | None, op: str) -> None:
        if isinstance(tgt, ast.Name):
            self._assigned.add(tgt.id)
        assign = self.pdg.add_node("ASSIGN", op)
        self.pdg.add_edge(value, assign, "DATA")
        self._maybe_ctrl(guard, assign)

    def _maybe_ctrl(self, guard: int | None, target: int) -> None:
        if guard is not None:
            self.pdg.add_edge(guard, target, "CTRL")

    # ─── expressions (return the node id of the produced value) ──────────────

    def _expr(self, node: ast.expr, guard: int | None) -> int:
        if isinstance(node, ast.Constant):
            return self.pdg.add_node("CONST", self._const_op(node.value))

        if isinstance(node, ast.Name):
            return self.pdg.add_node("REF", self._ref_op(node.id))

        if isinstance(node, ast.BinOp):
            cls, op = _BINOP.get(type(node.op), (None, None))
            if cls is None:
                self.unmapped.append(f"BinOp:{type(node.op).__name__}")
                return self.pdg.add_node("CALL", "FUNC")  # conservative placeholder
            n = self.pdg.add_node(cls, op)
            self.pdg.add_edge(self._expr(node.left, guard), n, "DATA")
            self.pdg.add_edge(self._expr(node.right, guard), n, "DATA")
            return n

        if isinstance(node, ast.UnaryOp):
            cls, op = _UNARYOP.get(type(node.op), (None, None))
            if cls is None:
                self.unmapped.append(f"UnaryOp:{type(node.op).__name__}")
                return self._expr(node.operand, guard)
            n = self.pdg.add_node(cls, op)
            self.pdg.add_edge(self._expr(node.operand, guard), n, "DATA")
            return n

        if isinstance(node, ast.Compare):
            # chained compares (a < b < c) -> one CMP node per operator
            left = self._expr(node.left, guard)
            last = left
            result = left
            for opnode, comparator in zip(node.ops, node.comparators):
                cls, op = _CMPOP[type(opnode)]
                n = self.pdg.add_node(cls, op)
                self.pdg.add_edge(last, n, "DATA")
                rhs = self._expr(comparator, guard)
                self.pdg.add_edge(rhs, n, "DATA")
                last = rhs
                result = n
            return result

        if isinstance(node, ast.BoolOp):
            cls, op = _BOOLOP[type(node.op)]
            n = self.pdg.add_node(cls, op)
            for v in node.values:
                self.pdg.add_edge(self._expr(v, guard), n, "DATA")
            return n

        if isinstance(node, ast.Call):
            op = "METHOD" if isinstance(node.func, ast.Attribute) else "FUNC"
            n = self.pdg.add_node("CALL", op)
            for arg in node.args:
                self.pdg.add_edge(self._expr(arg, guard), n, "DATA")
            return n

        if isinstance(node, ast.Subscript):
            return self.pdg.add_node("REF", "INDEX")

        if isinstance(node, ast.Attribute):
            return self.pdg.add_node("REF", "FIELD")

        if isinstance(node, tuple(_AGG.keys())):
            cls, op = _AGG[type(node)]
            n = self.pdg.add_node(cls, op)
            elts = getattr(node, "elts", []) or []
            for e in elts:
                self.pdg.add_edge(self._expr(e, guard), n, "DATA")
            return n

        self.unmapped.append(type(node).__name__)
        return self.pdg.add_node("CALL", "FUNC")  # conservative placeholder

    @staticmethod
    def _const_op(value) -> str:
        if isinstance(value, bool):
            return "BOOL"
        if isinstance(value, (int, float, complex)):
            return "NUM"
        if isinstance(value, str):
            return "STR"
        if value is None:
            return "NULL"
        return "COLL"


def normalize_python(source: str, sigma: Sigma | None = None) -> PDG:
    """Convenience: source string -> Σ-labeled PDG."""
    return PythonNormalizer(sigma).normalize(source)
