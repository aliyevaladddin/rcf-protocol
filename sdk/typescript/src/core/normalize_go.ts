import Parser from 'tree-sitter';
// @ts-ignore
import Go from 'tree-sitter-go';
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
  '&^': ['BIT', 'XOR'], // clear bit
};

const UNARYOP_MAP: Record<string, [string, string]> = {
  '-': ['ARITH', 'NEG'],
  '+': ['ARITH', 'NEG'],
  '^': ['BIT', 'NOT'],
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

export class GoNormalizer {
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
    parser.setLanguage(Go as any);
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

      case 'function_declaration':
      case 'method_declaration': {
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

      case 'expression_list': {
        let lastId: number | null = null;
        for (let i = 0; i < node.namedChildCount; i++) {
          const valId = this.walk(node.namedChild(i)!, guard);
          if (valId !== null) {
            lastId = valId;
          }
        }
        return lastId;
      }

      case 'var_declaration':
      case 'const_declaration': {
        for (let i = 0; i < node.namedChildCount; i++) {
          this.walk(node.namedChild(i)!, guard);
        }
        return null;
      }

      case 'var_spec':
      case 'const_spec': {
        const nameList = node.childForFieldName('name') || node.child(0);
        const valList = node.childForFieldName('value') || node.child(node.childCount - 1);
        
        if (nameList) {
          // Add names to assigned
          const names: string[] = [];
          if (nameList.type === 'identifier') {
            names.push(nameList.text);
            this._assigned.add(nameList.text);
          } else {
            for (let i = 0; i < nameList.namedChildCount; i++) {
              const nameNode = nameList.namedChild(i)!;
              if (nameNode.type === 'identifier') {
                names.push(nameNode.text);
                this._assigned.add(nameNode.text);
              }
            }
          }

          if (valList && valList.type !== 'type') {
            if (valList.type === 'expression_list') {
              for (let i = 0; i < valList.namedChildCount; i++) {
                const valId = this.walk(valList.namedChild(i)!, guard);
                if (valId !== null) {
                  const assignId = this.pdg.addNode('ASSIGN', 'BIND');
                  this.pdg.addEdge(valId, assignId, 'DATA');
                  this.maybeCtrl(guard, assignId);
                }
              }
            } else {
              const valId = this.walk(valList, guard);
              if (valId !== null) {
                const assignId = this.pdg.addNode('ASSIGN', 'BIND');
                this.pdg.addEdge(valId, assignId, 'DATA');
                this.maybeCtrl(guard, assignId);
              }
            }
          }
        }
        return null;
      }

      case 'short_var_declaration': {
        const left = node.childForFieldName('left') || node.child(0);
        const right = node.childForFieldName('right') || node.child(node.childCount - 1);

        if (left) {
          if (left.type === 'expression_list') {
            for (let i = 0; i < left.namedChildCount; i++) {
              const idNode = left.namedChild(i)!;
              if (idNode.type === 'identifier') {
                this._assigned.add(idNode.text);
              }
            }
          } else if (left.type === 'identifier') {
            this._assigned.add(left.text);
          }
        }

        if (right) {
          if (right.type === 'expression_list') {
            for (let i = 0; i < right.namedChildCount; i++) {
              const valId = this.walk(right.namedChild(i)!, guard);
              if (valId !== null) {
                const assignId = this.pdg.addNode('ASSIGN', 'BIND');
                this.pdg.addEdge(valId, assignId, 'DATA');
                this.maybeCtrl(guard, assignId);
              }
            }
          } else {
            const valId = this.walk(right, guard);
            if (valId !== null) {
              const assignId = this.pdg.addNode('ASSIGN', 'BIND');
              this.pdg.addEdge(valId, assignId, 'DATA');
              this.maybeCtrl(guard, assignId);
            }
          }
        }
        return null;
      }

      case 'assignment_statement': {
        const left = node.childForFieldName('left') || node.child(0);
        const right = node.childForFieldName('right') || node.child(node.childCount - 1);
        const opNode = node.child(1);
        const opText = opNode ? opNode.text : '=';

        if (left && left.type === 'expression_list') {
          for (let i = 0; i < left.namedChildCount; i++) {
            const idNode = left.namedChild(i)!;
            if (idNode.type === 'identifier') {
              this._assigned.add(idNode.text);
            }
          }
        } else if (left && left.type === 'identifier') {
          this._assigned.add(left.text);
        }

        if (right) {
          const assignOp = opText === '=' ? 'BIND' : 'UPDATE';
          if (right.type === 'expression_list') {
            for (let i = 0; i < right.namedChildCount; i++) {
              const valId = this.walk(right.namedChild(i)!, guard);
              if (valId !== null) {
                const assignId = this.pdg.addNode('ASSIGN', assignOp);
                this.pdg.addEdge(valId, assignId, 'DATA');
                this.maybeCtrl(guard, assignId);
              }
            }
          } else {
            const valId = this.walk(right, guard);
            if (valId !== null) {
              const assignId = this.pdg.addNode('ASSIGN', assignOp);
              this.pdg.addEdge(valId, assignId, 'DATA');
              this.maybeCtrl(guard, assignId);
            }
          }
        }
        return null;
      }

      case 'int_literal':
      case 'float_literal':
      case 'imaginary_literal':
      case 'rune_literal':
        return this.pdg.addNode('CONST', 'NUM');

      case 'string_literal':
      case 'raw_string_literal':
        return this.pdg.addNode('CONST', 'STR');

      case 'true':
      case 'false':
        return this.pdg.addNode('CONST', 'BOOL');

      case 'nil':
        return this.pdg.addNode('CONST', 'NULL');

      case 'parenthesized_expression': {
        if (node.namedChildCount > 0) {
          return this.walk(node.namedChild(0)!, guard);
        }
        return null;
      }

      case 'identifier':
        return this.pdg.addNode('REF', this._refOp(node.text));

      case 'selector_expression':
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
        const opNode = node.childForFieldName('operator') || node.child(0);
        const op = opNode ? opNode.text : '';
        const argument = node.childForFieldName('operand') || node.child(1);

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
        if (functionNode && functionNode.type === 'selector_expression') {
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

      case 'if_statement': {
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

      case 'for_statement': {
        const loopId = this.pdg.addNode('LOOP', 'FOR');
        this.maybeCtrl(guard, loopId);

        const condition = node.childForFieldName('condition');
        if (condition) {
          const condId = this.walk(condition, guard);
          if (condId !== null) {
            this.pdg.addEdge(condId, loopId, 'DATA');
          }
        }

        const body = node.childForFieldName('body') || node.child(node.childCount - 1);
        this.walk(body, loopId);
        return null;
      }

      case 'return_statement': {
        const retId = this.pdg.addNode('RET', 'RETURN');
        this.maybeCtrl(guard, retId);

        const valNode = node.child(1);
        if (valNode && valNode.type !== 'type') {
          const valId = this.walk(valNode, guard);
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

export function normalizeGo(source: string, sigma?: Sigma): PDG {
  const normalizer = new GoNormalizer(sigma);
  return normalizer.normalize(source);
}
