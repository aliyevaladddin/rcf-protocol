// NOTICE: This file is protected under RCF-PL
// [RCF:PROTECTED]

// @ts-ignore
import Parser from 'tree-sitter';
// @ts-ignore
import TypeScript from 'tree-sitter-typescript';
import { PDG } from './pdg.js';
import { Sigma, loadSigma } from './sigma.js';

// Mapping binary operator text to Σ (cls, op)
const BINOP_MAP: Record<string, [string, string]> = {
  '+': ['ARITH', 'ADD'],
  '-': ['ARITH', 'SUB'],
  '*': ['ARITH', 'MUL'],
  '/': ['ARITH', 'DIV'],
  '%': ['ARITH', 'MOD'],
  '**': ['ARITH', 'POW'],
  '&': ['BIT', 'AND'],
  '|': ['BIT', 'OR'],
  '^': ['BIT', 'XOR'],
  '<<': ['BIT', 'SHL'],
  '>>': ['BIT', 'SHR'],
  '>>>': ['BIT', 'SHR'], // map unsigned right shift to SHR class-wise
};

// Mapping unary operator text to Σ (cls, op)
const UNARYOP_MAP: Record<string, [string, string]> = {
  '-': ['ARITH', 'NEG'],
  '+': ['ARITH', 'NEG'], // map unary plus to NEG class-wise
  '~': ['BIT', 'NOT'],
  '!': ['LOGIC', 'NOT'],
};

// Mapping comparison operator text to Σ (cls, op)
const CMPOP_MAP: Record<string, [string, string]> = {
  '==': ['CMP', 'EQ'],
  '===': ['CMP', 'EQ'],
  '!=': ['CMP', 'NE'],
  '!==': ['CMP', 'NE'],
  '<': ['CMP', 'LT'],
  '<=': ['CMP', 'LE'],
  '>': ['CMP', 'GT'],
  '>=': ['CMP', 'GE'],
  'instanceof': ['CMP', 'IS'],
  'in': ['CMP', 'IN'],
};

// Mapping boolean logical operator text to Σ (cls, op)
const LOGICOP_MAP: Record<string, [string, string]> = {
  '&&': ['LOGIC', 'AND'],
  '||': ['LOGIC', 'OR'],
  '??': ['LOGIC', 'OR'], // map nullish coalescing to OR class-wise
};

export class TypeScriptNormalizer {
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
    parser.setLanguage(TypeScript.typescript);
    const tree = parser.parse(source);
    
    // Walk the root node
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
    if (node.type === 'identifier' || node.type === 'shorthand_property_identifier_pattern') {
      this._params.add(node.text);
      return;
    }
    if (node.type === 'required_parameter' || node.type === 'optional_parameter') {
      const pattern = node.childForFieldName('pattern');
      if (pattern) this.findParamIdentifiers(pattern);
      return;
    }
    if (node.type === 'assignment_pattern') {
      const left = node.childForFieldName('left');
      if (left) this.findParamIdentifiers(left);
      return;
    }
    if (node.type === 'rest_parameter') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i)!;
        if (child.type !== 'type_annotation') {
          this.findParamIdentifiers(child);
        }
      }
      return;
    }
    // Default: walk all named children except type annotations
    for (let i = 0; i < node.namedChildCount; i++) {
      const child = node.namedChild(i)!;
      if (child.type !== 'type_annotation') {
        this.findParamIdentifiers(child);
      }
    }
  }

  private walk(node: Parser.SyntaxNode | null | undefined, guard: number | null): number | null {
    if (!node) {
      return null;
    }
    switch (node.type) {
      // ─── Declarations & Functions ──────────────────────────────────────────
      case 'program':
      case 'statement_block': {
        for (let i = 0; i < node.namedChildCount; i++) {
          this.walk(node.namedChild(i)!, guard);
        }
        return null;
      }

      case 'function_declaration':
      case 'arrow_function':
      case 'function_expression':
      case 'method_definition': {
        // Backup scope
        const oldParams = new Set(this._params);
        const oldAssigned = new Set(this._assigned);

        // Find parameters
        const paramsNode = node.childForFieldName('parameters');
        if (paramsNode) {
          this.findParamIdentifiers(paramsNode);
        }

        const bodyNode = node.childForFieldName('body');
        if (bodyNode) {
          this.walk(bodyNode, guard);
        }

        // Restore scope
        this._params = oldParams;
        this._assigned = oldAssigned;
        return null;
      }

      // ─── Variable Declarations & Assignments ──────────────────────────────
      case 'lexical_declaration':
      case 'variable_declaration': {
        for (let i = 0; i < node.namedChildCount; i++) {
          this.walk(node.namedChild(i)!, guard);
        }
        return null;
      }

      case 'variable_declarator': {
        const nameNode = node.childForFieldName('name');
        const valueNode = node.childForFieldName('value');
        if (nameNode && nameNode.type === 'identifier') {
          this._assigned.add(nameNode.text);
          if (valueNode) {
            const valId = this.walk(valueNode, guard);
            if (valId !== null) {
              const assignId = this.pdg.addNode('ASSIGN', 'BIND');
              this.pdg.addEdge(valId, assignId, 'DATA');
              this.maybeCtrl(guard, assignId);
              return assignId;
            }
          }
        }
        return null;
      }

      case 'assignment_expression': {
        const leftNode = node.childForFieldName('left')!;
        const opNode = node.childForFieldName('operator') || node.child(1);
        const operator = opNode ? opNode.text : '=';
        const rightNode = node.childForFieldName('right')!;

        const valId = this.walk(rightNode, guard);
        if (valId !== null) {
          const isUpdate = operator !== '=';
          const assignOp = isUpdate ? 'UPDATE' : 'BIND';
          const assignId = this.pdg.addNode('ASSIGN', assignOp);
          this.pdg.addEdge(valId, assignId, 'DATA');
          this.maybeCtrl(guard, assignId);

          // If simple identifier on LHS, record assign
          if (leftNode.type === 'identifier') {
            this._assigned.add(leftNode.text);
          } else {
            // Member/Subscript assignment: connect the assignee as well
            const leftId = this.walk(leftNode, guard);
            if (leftId !== null) {
              this.pdg.addEdge(leftId, assignId, 'DATA');
            }
          }
          return assignId;
        }
        return null;
      }

      // ─── Expressions ───────────────────────────────────────────────────────
      case 'number':
        return this.pdg.addNode('CONST', 'NUM');

      case 'string':
      case 'template_string':
        return this.pdg.addNode('CONST', 'STR');

      case 'true':
      case 'false':
        return this.pdg.addNode('CONST', 'BOOL');

      case 'null':
      case 'undefined':
        return this.pdg.addNode('CONST', 'NULL');

      case 'parenthesized_expression': {
        if (node.namedChildCount > 0) {
          return this.walk(node.namedChild(0)!, guard);
        }
        return null;
      }

      case 'as_expression': {
        const valueNode = node.childForFieldName('value');
        if (valueNode) {
          return this.walk(valueNode, guard);
        }
        if (node.namedChildCount > 0) {
          return this.walk(node.namedChild(0)!, guard);
        }
        return null;
      }

      case 'type_assertion': {
        const valueNode = node.childForFieldName('value');
        if (valueNode) {
          return this.walk(valueNode, guard);
        }
        if (node.namedChildCount > 0) {
          return this.walk(node.namedChild(node.namedChildCount - 1)!, guard);
        }
        return null;
      }

      case 'array':
        return this.pdg.addNode('AGG', 'LIST');

      case 'object':
        return this.pdg.addNode('AGG', 'MAP');

      case 'identifier':
        return this.pdg.addNode('REF', this._refOp(node.text));

      case 'member_expression':
        return this.pdg.addNode('REF', 'FIELD');

      case 'subscript_expression':
        return this.pdg.addNode('REF', 'INDEX');

      case 'binary_expression': {
        const left = node.childForFieldName('left')!;
        const opNode = node.childForFieldName('operator') || node.child(1);
        const op = opNode ? opNode.text : '';
        const right = node.childForFieldName('right')!;

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
        const argument = node.childForFieldName('argument')!;

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
        const functionNode = node.childForFieldName('function')!;
        const argumentsNode = node.childForFieldName('arguments')!;

        // Default call type
        let callOp = 'FUNC';
        if (functionNode.type === 'member_expression') {
          callOp = 'METHOD';
        }

        const nodeId = this.pdg.addNode('CALL', callOp);
        this.maybeCtrl(guard, nodeId);

        // Connect function itself
        const funcId = this.walk(functionNode, guard);
        if (funcId !== null) this.pdg.addEdge(funcId, nodeId, 'DATA');

        // Connect arguments
        for (let i = 0; i < argumentsNode.namedChildCount; i++) {
          const arg = argumentsNode.namedChild(i)!;
          const argId = this.walk(arg, guard);
          if (argId !== null) this.pdg.addEdge(argId, nodeId, 'DATA');
        }

        return nodeId;
      }

      case 'new_expression': {
        const constructorNode = node.childForFieldName('constructor')!;
        const argumentsNode = node.childForFieldName('arguments');

        const nodeId = this.pdg.addNode('CALL', 'CONSTRUCT');
        this.maybeCtrl(guard, nodeId);

        const constrId = this.walk(constructorNode, guard);
        if (constrId !== null) this.pdg.addEdge(constrId, nodeId, 'DATA');

        if (argumentsNode) {
          for (let i = 0; i < argumentsNode.namedChildCount; i++) {
            const arg = argumentsNode.namedChild(i)!;
            const argId = this.walk(arg, guard);
            if (argId !== null) this.pdg.addEdge(argId, nodeId, 'DATA');
          }
        }
        return nodeId;
      }

      // ─── Control Flow & Statements ─────────────────────────────────────────
      case 'expression_statement': {
        for (let i = 0; i < node.namedChildCount; i++) {
          this.walk(node.namedChild(i)!, guard);
        }
        return null;
      }

      case 'if_statement': {
        const condition = node.childForFieldName('condition')!;
        const consequence = node.childForFieldName('consequence')!;
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

      case 'for_statement':
      case 'for_in_statement':
      case 'while_statement': {
        const isFor = node.type !== 'while_statement';
        const loopId = this.pdg.addNode('LOOP', isFor ? 'FOR' : 'WHILE');
        this.maybeCtrl(guard, loopId);

        const condition = node.childForFieldName('condition');
        if (condition) {
          const condId = this.walk(condition, guard);
          if (condId !== null) {
            this.pdg.addEdge(condId, loopId, 'DATA');
          }
        }

        const body = node.childForFieldName('body')!;
        this.walk(body, loopId);
        return null;
      }

      case 'return_statement': {
        const retId = this.pdg.addNode('RET', 'RETURN');
        this.maybeCtrl(guard, retId);

        if (node.namedChildCount > 0) {
          const valNode = node.namedChild(0)!;
          const valId = this.walk(valNode, guard);
          if (valId !== null) {
            this.pdg.addEdge(valId, retId, 'DATA');
          }
        }
        return retId;
      }

      default:
        // Record unmapped syntax type if it is a named node (not punctuation)
        if (node.isNamed) {
          this.unmapped.push(node.type);
        }
        // Walk children
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

export function normalizeTypescript(source: string, sigma?: Sigma): PDG {
  const normalizer = new TypeScriptNormalizer(sigma);
  return normalizer.normalize(source);
}
