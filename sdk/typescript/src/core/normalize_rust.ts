import Parser from 'tree-sitter';
// @ts-ignore
import Rust from 'tree-sitter-rust';
import { PDG } from './pdg.js';
import { Sigma, loadSigma } from './sigma.js';

const BINOP_MAP: Record<string, [string, string]> = {
  '+': ['ARITH', 'ADD'],
  '-': ['ARITH', 'SUB'],
  '*': ['ARITH', 'MUL'],
  '/': ['ARITH', 'DIV'],
  '%': ['ARITH', 'MOD'],
  '&': ['BIT', 'AND'],
  '|': ['BIT', 'OR'],
  '^': ['BIT', 'XOR'],
  '<<': ['BIT', 'SHL'],
  '>>': ['BIT', 'SHR'],
};

const UNARYOP_MAP: Record<string, [string, string]> = {
  '-': ['ARITH', 'NEG'],
  '*': ['ARITH', 'NEG'], // deref maps to NEG class-wise for simplicity
  '!': ['LOGIC', 'NOT'],
};

const CMPOP_MAP: Record<string, [string, string]> = {
  '==': ['CMP', 'EQ'],
  '!=': ['CMP', 'NE'],
  '<': ['CMP', 'LT'],
  '<=': ['CMP', 'LE'],
  '>': ['CMP', 'GT'],
  '>=': ['CMP', 'GE'],
};

const LOGICOP_MAP: Record<string, [string, string]> = {
  '&&': ['LOGIC', 'AND'],
  '||': ['LOGIC', 'OR'],
};

export class RustNormalizer {
  public readonly pdg: PDG;
  public readonly unmapped: string[] = [];
  private _params = new Set<string>();
  private _assigned = new Set<string>();

  constructor(sigma?: Sigma) {
    const s = sigma || loadSigma();
    this.pdg = new PDG(s);
  }

  public normalize(source: string): PDG {
    const parser = new Parser();
    parser.setLanguage(Rust);
    const tree = parser.parse(source);
    this.walk(tree.rootNode, null);
    return this.pdg;
  }

  private _refOp(name: string): string {
    if (this._params.has(name)) {
      return 'PARAM';
    }
    if (this._assigned.has(name)) {
      return 'LOCAL';
    }
    return 'GLOBAL';
  }

  private findParamIdentifiers(node: Parser.SyntaxNode): void {
    if (node.type === 'identifier') {
      this._params.add(node.text);
      return;
    }
    for (let i = 0; i < node.namedChildCount; i++) {
      this.findParamIdentifiers(node.namedChild(i)!);
    }
  }

  private walk(node: Parser.SyntaxNode | null | undefined, guard: number | null): number | null {
    if (!node) {
      return null;
    }

    switch (node.type) {
      case 'source_file':
      case 'block': {
        for (let i = 0; i < node.namedChildCount; i++) {
          this.walk(node.namedChild(i)!, guard);
        }
        return null;
      }

      case 'function_item':
      case 'closure_expression': {
        const oldParams = new Set(this._params);
        const oldAssigned = new Set(this._assigned);

        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) {
          this.findParamIdentifiers(paramsNode);
        }

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.walk(bodyNode, guard);
        }

        this._params = oldParams;
        this._assigned = oldAssigned;
        return null;
      }

      case 'let_declaration': {
        const pattern = node.childForFieldName('pattern');
        const value = node.childForFieldName('value');

        if (pattern && pattern.type === 'identifier') {
          this._assigned.add(pattern.text);
        }

        if (value) {
          const valId = this.walk(value, guard);
          if (valId !== null) {
            const assignId = this.pdg.addNode('ASSIGN', 'BIND');
            this.pdg.addEdge(valId, assignId, 'DATA');
            this.maybeCtrl(guard, assignId);
            return assignId;
          }
        }
        return null;
      }

      case 'assignment_expression': {
        const left = node.childForFieldName('left') || node.child(0);
        const right = node.childForFieldName('right') || node.child(node.childCount - 1);
        const opNode = node.child(1);
        const opText = opNode ? opNode.text : '=';

        if (left && left.type === 'identifier') {
          this._assigned.add(left.text);
        }

        if (right) {
          const valId = this.walk(right, guard);
          if (valId !== null) {
            const assignOp = opText === '=' ? 'BIND' : 'UPDATE';
            const assignId = this.pdg.addNode('ASSIGN', assignOp);
            this.pdg.addEdge(valId, assignId, 'DATA');
            this.maybeCtrl(guard, assignId);
            return assignId;
          }
        }
        return null;
      }

      case 'integer_literal':
      case 'float_literal':
      case 'char_literal':
        return this.pdg.addNode('CONST', 'NUM');

      case 'string_literal':
      case 'raw_string_literal':
        return this.pdg.addNode('CONST', 'STR');

      case 'boolean_literal':
        return this.pdg.addNode('CONST', 'BOOL');

      case 'unit_expression':
        return this.pdg.addNode('CONST', 'NULL');

      case 'parenthesized_expression': {
        if (node.namedChildCount > 0) {
          return this.walk(node.namedChild(0)!, guard);
        }
        return null;
      }

      case 'identifier':
        return this.pdg.addNode('REF', this._refOp(node.text));

      case 'field_expression':
        return this.pdg.addNode('REF', 'FIELD');

      case 'index_expression':
        return this.pdg.addNode('REF', 'INDEX');

      case 'binary_expression': {
        const left = node.childForFieldName('left') || node.child(0);
        const opNode = node.child(1);
        const op = opNode ? opNode.text : '';
        const right = node.childForFieldName('right') || node.child(2);

        let cls = '';
        let sigOp = '';

        if (op in BINOP_MAP) {
          [cls, sigOp] = BINOP_MAP[op];
        } else if (op in CMPOP_MAP) {
          [cls, sigOp] = CMPOP_MAP[op];
        } else if (op in LOGICOP_MAP) {
          [cls, sigOp] = LOGICOP_MAP[op];
        } else {
          this.unmapped.push(`binary:${op}`);
          return this.pdg.addNode('CALL', 'FUNC');
        }

        const nodeId = this.pdg.addNode(cls, sigOp);
        const leftId = this.walk(left, guard);
        const rightId = this.walk(right, guard);

        if (leftId !== null) this.pdg.addEdge(leftId, nodeId, 'DATA');
        if (rightId !== null) this.pdg.addEdge(rightId, nodeId, 'DATA');
        return nodeId;
      }

      case 'unary_expression': {
        const opNode = node.child(0);
        const op = opNode ? opNode.text : '';
        const argument = node.child(1);

        let cls = '';
        let sigOp = '';

        if (op in UNARYOP_MAP) {
          [cls, sigOp] = UNARYOP_MAP[op];
        } else {
          this.unmapped.push(`unary:${op}`);
          return this.pdg.addNode('CALL', 'FUNC');
        }

        const nodeId = this.pdg.addNode(cls, sigOp);
        const argId = this.walk(argument, guard);
        if (argId !== null) this.pdg.addEdge(argId, nodeId, 'DATA');
        return nodeId;
      }

      case 'call_expression': {
        const functionNode = node.childForFieldName('function') || node.child(0);
        const argumentsNode = node.childForFieldName('arguments') || node.child(1);

        let callOp = 'FUNC';
        if (functionNode && functionNode.type === 'field_expression') {
          callOp = 'METHOD';
        }

        const nodeId = this.pdg.addNode('CALL', callOp);
        this.maybeCtrl(guard, nodeId);

        const funcId = this.walk(functionNode, guard);
        if (funcId !== null) this.pdg.addEdge(funcId, nodeId, 'DATA');

        if (argumentsNode) {
          for (let i = 0; i < argumentsNode.namedChildCount; i++) {
            const arg = argumentsNode.namedChild(i)!;
            const argId = this.walk(arg, guard);
            if (argId !== null) this.pdg.addEdge(argId, nodeId, 'DATA');
          }
        }
        return nodeId;
      }

      case 'if_expression': {
        const condition = node.childForFieldName('condition');
        const consequence = node.childForFieldName('consequence');
        const alternative = node.childForFieldName('alternative');

        const testId = this.walk(condition, guard);
        const branchId = this.pdg.addNode('BRANCH', 'IF');
        this.maybeCtrl(guard, branchId);

        if (testId !== null) {
          this.pdg.addEdge(testId, branchId, 'DATA');
        }

        this.walk(consequence, branchId);
        if (alternative) {
          this.walk(alternative, branchId);
        }
        return null;
      }

      case 'for_expression':
      case 'while_expression':
      case 'loop_expression': {
        const loopId = this.pdg.addNode('LOOP', 'FOR');
        this.maybeCtrl(guard, loopId);

        const condition = node.childForFieldName('condition');
        if (condition) {
          const condId = this.walk(condition, guard);
          if (condId !== null) {
            this.pdg.addEdge(condId, loopId, 'DATA');
          }
        }

        const body = node.childForFieldName('body');
        this.walk(body, loopId);
        return null;
      }

      case 'return_expression': {
        const retId = this.pdg.addNode('RET', 'RETURN');
        this.maybeCtrl(guard, retId);

        if (node.namedChildCount > 0) {
          const valId = this.walk(node.namedChild(0)!, guard);
          if (valId !== null) {
            this.pdg.addEdge(valId, retId, 'DATA');
          }
        }
        return retId;
      }

      default:
        if (node.isNamed) {
          this.unmapped.push(node.type);
        }
        for (let i = 0; i < node.namedChildCount; i++) {
          this.walk(node.namedChild(i)!, guard);
        }
        return null;
    }
  }

  private maybeCtrl(guard: number | null, target: number): void {
    if (guard !== null) {
      this.pdg.addEdge(guard, target, 'CTRL');
    }
  }
}

export function normalizeRust(source: string, sigma?: Sigma): PDG {
  const normalizer = new RustNormalizer(sigma);
  return normalizer.normalize(source);
}
