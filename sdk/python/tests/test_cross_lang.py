import json
import subprocess
from pathlib import Path
from rcf_core import load_sigma
from rcf_core.normalize_python import normalize_python

def test_cross_lang_parity():
    # 1. Python source
    py_src = """
def calculate(x):
    y = x + 1
    if y > 10:
        return y
    return 0
"""
    # Normalize with Python normalizer
    sigma = load_sigma()
    g_py = normalize_python(py_src, sigma)
    
    # 2. TypeScript source
    ts_src = """
function calculate(x: number): number {
    const y = x + 1;
    if (y > 10) {
        return y;
    }
    return 0;
}
"""
    # Normalize with TypeScript normalizer via test_export.cjs
    project_root = Path(__file__).resolve().parent.parent.parent.parent
    ts_dir = project_root / "sdk" / "typescript"
    
    # Run node test_export.cjs
    cmd = ["node", "test_export.cjs"]
    res = subprocess.run(cmd, input=ts_src, capture_output=True, text=True, cwd=str(ts_dir))
    
    assert res.returncode == 0, f"TypeScript normalizer failed: {res.stderr}"
    ts_pdg_dict = json.loads(res.stdout)
    
    # 3. Compare PDG nodes and edges
    py_labels = sorted(n.label for n in g_py.nodes)
    ts_labels = sorted(n["label"] for n in ts_pdg_dict["nodes"])
    
    print("Python labels:", py_labels)
    print("TypeScript labels:", ts_labels)
    
    print("\n=== PYTHON NODES ===")
    for i, n in enumerate(g_py.nodes):
        print(f"Node {i}: label={n.label}")
    print("\n=== PYTHON EDGES ===")
    for e in g_py.edges:
        print(f"Edge: {e.src} -> {e.dst} ({e.etype})")

    print("\n=== TYPESCRIPT NODES ===")
    for i, n in enumerate(ts_pdg_dict["nodes"]):
        print(f"Node {i}: label={n['label']}")
    print("\n=== TYPESCRIPT EDGES ===")
    for e in ts_pdg_dict["edges"]:
        print(f"Edge: {e['src']} -> {e['dst']} ({e['type']})")

    assert py_labels == ts_labels, f"Node labels mismatch: Python={py_labels}, TS={ts_labels}"
    assert len(g_py.edges) == len(ts_pdg_dict["edges"]), f"Edges count mismatch: Python={len(g_py.edges)}, TS={len(ts_pdg_dict['edges'])}"

    # 4. Reconstruct the TS PDG in Python and compute correlation
    from rcf_core.pdg import PDG as PyPDG
    from rcf_core.correlate import correlate
    import pytest

    g_ts = PyPDG(sigma)
    for n in ts_pdg_dict["nodes"]:
        parts = n["label"].split(".", 1)
        cls = parts[0]
        op = parts[1] if len(parts) > 1 else None
        g_ts.add_node(cls, op)
    for e in ts_pdg_dict["edges"]:
        g_ts.add_edge(e["src"], e["dst"], e["type"])

    # Compute correlation
    corr = correlate(g_py, g_ts)
    print("Cross-language correlation:", corr)
    assert corr == pytest.approx(1.0)

