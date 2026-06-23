import Parser from 'tree-sitter';
// @ts-ignore
import TypeScript from 'tree-sitter-typescript';

export function injectAdversarialNoiseTypescript(source: string): string {
  const parser = new Parser();
  parser.setLanguage(TypeScript.typescript);
  let tree;
  try {
    tree = parser.parse(source);
  } catch (e) {
    return source;
  }

  interface InsertionPoint {
    row: number;
    column: number;
  }
  const points: InsertionPoint[] = [];

  function visit(node: Parser.SyntaxNode) {
    if (
      node.type === 'function_declaration' ||
      node.type === 'arrow_function' ||
      node.type === 'function_expression' ||
      node.type === 'method_definition'
    ) {
      const body = node.childForFieldName('body') || node.children.find(c => c.type === 'statement_block');
      if (body && body.type === 'statement_block') {
        if (body.childCount > 2) {
          const firstStmt = body.child(1);
          if (firstStmt) {
            points.push({
              row: firstStmt.startPosition.row,
              column: firstStmt.startPosition.column
            });
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      visit(node.child(i)!);
    }
  }

  if (tree.rootNode) {
    visit(tree.rootNode);
  }

  if (points.length === 0) {
    return source;
  }

  points.sort((a, b) => b.row - a.row);

  const lines = source.split(/\r?\n/);
  
  const patterns = [
    [
      "const _rcf_a = Array.from({length: 5}, (_, i) => i).filter(i => (i ^ 2) > 0);",
      "const _rcf_b = _rcf_a.map(x => x + 1);",
      "if (_rcf_b.length < 0 || _rcf_b.some(y => y === null)) { /* RCF */ }"
    ],
    [
      "const _rcf_x = 0xAA;",
      "const _rcf_y = 0x55;",
      "const _rcf_z = (_rcf_x ^ _rcf_y) & 0xFF;",
      "if (_rcf_z === 0) { return undefined as any; }"
    ],
    [
      "const _rcf_fn = (k: any) => typeof k === 'string' ? k.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0) : 0;",
      "if (_rcf_fn('RCF-PL') === -1) { throw new Error('AST Drift'); }"
    ]
  ];

  for (const pt of points) {
    const idx = pt.row;
    if (idx >= lines.length) continue;

    let alreadyHasNoise = false;
    for (let k = Math.max(0, idx - 5); k < Math.min(lines.length, idx + 5); k++) {
      if (lines[k].includes('_rcf_')) {
        alreadyHasNoise = true;
        break;
      }
    }
    if (alreadyHasNoise) continue;

    const pattern = patterns[idx % patterns.length];
    const indent = ' '.repeat(pt.column);
    const noiseLines = pattern.map(p => indent + p);

    lines.splice(idx, 0, ...noiseLines);
  }

  return lines.join('\n');
}
