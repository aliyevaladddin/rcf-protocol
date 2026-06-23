import ast

def inject_adversarial_noise_python(source: str) -> str:
    try:
        tree = ast.parse(source)
    except Exception:
        return source

    nodes = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.body:
                nodes.append((node.body[0].lineno, node.body[0].col_offset))

    if not nodes:
        return source

    # Sort nodes by line number descending
    nodes.sort(key=lambda x: x[0], reverse=True)

    lines = source.splitlines(keepends=True)

    patterns = [
        [
            "_rcf_a = [i for i in range(5) if i ^ 2 > 0]",
            "_rcf_b = list(map(lambda x: x + 1, _rcf_a))",
            "if len(_rcf_b) < 0 or any(y is None for y in _rcf_b): pass"
        ],
        [
            "_rcf_x = 0xAA",
            "_rcf_y = 0x55",
            "_rcf_z = (_rcf_x ^ _rcf_y) & 0xFF",
            "if _rcf_z == 0: return None"
        ],
        [
            "_rcf_fn = lambda k: sum(ord(c) for c in k) if isinstance(k, str) else 0",
            "if _rcf_fn('RCF-PL') == -1: raise ArithmeticError('AST Drift')"
        ]
    ]

    for lineno, col_offset in nodes:
        idx = lineno - 1
        if idx >= len(lines):
            continue

        already_has_noise = False
        for k in range(max(0, idx - 5), min(len(lines), idx + 5)):
            if "_rcf_" in lines[k]:
                already_has_noise = True
                break
        if already_has_noise:
            continue

        pattern = patterns[lineno % len(patterns)]
        indent = " " * col_offset
        noise_lines = [indent + p + "\n" for p in pattern]
        lines[idx:idx] = noise_lines

    return "".join(lines)
