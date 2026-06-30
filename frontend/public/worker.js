importScripts('/tree-sitter.js');

let parser = null;
let tsLang = null;
let jsLang = null;
let isInitialized = false;

async function init() {
  if (isInitialized) return;

  await self.TreeSitter.init({
    locateFile(scriptName) {
      return '/' + scriptName;
    },
  });

  parser = new self.TreeSitter();

  tsLang = await self.TreeSitter.Language.load('/tree-sitter-typescript.wasm');
  jsLang = await self.TreeSitter.Language.load('/tree-sitter-javascript.wasm');

  isInitialized = true;
  console.log('[Worker] Tree-sitter fully initialized');
}

// ─── AST Entity Extractors ──────────────────────────────────────────

/**
 * Extracts import statements from the AST root.
 * Returns: [{ source: string, names: string[] }]
 */
function extractImports(rootNode) {
  const imports = [];

  function visit(node) {
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source');
      const source = sourceNode ? sourceNode.text.replace(/['"]/g, '') : null;
      if (!source) return;

      const names = [];
      // Look for import_clause children
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'import_clause') {
          for (let j = 0; j < child.namedChildCount; j++) {
            const spec = child.namedChild(j);
            if (spec.type === 'identifier') {
              // default import: import Foo from '...'
              names.push(spec.text);
            } else if (spec.type === 'named_imports') {
              for (let k = 0; k < spec.namedChildCount; k++) {
                const importSpec = spec.namedChild(k);
                if (importSpec.type === 'import_specifier') {
                  const nameNode = importSpec.childForFieldName('name');
                  const aliasNode = importSpec.childForFieldName('alias');
                  names.push(aliasNode ? aliasNode.text : (nameNode ? nameNode.text : importSpec.text));
                }
              }
            } else if (spec.type === 'namespace_import') {
              // import * as X from '...'
              const nameNode = spec.namedChild(0);
              if (nameNode) names.push('* as ' + nameNode.text);
            }
          }
        }
      }

      imports.push({ source, names: names.length > 0 ? names : ['*'] });
    } else if (node.type === 'call_expression') {
      // require('...')
      const funcNode = node.childForFieldName('function');
      if (funcNode && funcNode.text === 'require') {
        const argsNode = node.childForFieldName('arguments');
        if (argsNode && argsNode.namedChildCount > 0) {
          const arg = argsNode.namedChild(0);
          if (arg && arg.type === 'string') {
            imports.push({ source: arg.text.replace(/['"]/g, ''), names: ['*'] });
          }
        }
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      // Don't recurse into function/class bodies for top-level imports
      const child = node.namedChild(i);
      if (child.type !== 'function_declaration' && child.type !== 'class_declaration') {
        visit(child);
      }
    }
  }

  visit(rootNode);
  return imports;
}

/**
 * Checks if a node is wrapped in an export_statement.
 */
function isExported(node) {
  return node.parent && (
    node.parent.type === 'export_statement' ||
    node.parent.type === 'export_default_declaration'
  );
}

/**
 * Checks if a node is a default export.
 */
function isDefaultExport(node) {
  return node.parent && node.parent.type === 'export_default_declaration';
}

/**
 * Extracts parameter names from a formal_parameters node.
 */
function extractParams(paramsNode) {
  if (!paramsNode) return [];
  const params = [];
  for (let i = 0; i < paramsNode.namedChildCount; i++) {
    const p = paramsNode.namedChild(i);
    if (p.type === 'required_parameter' || p.type === 'optional_parameter') {
      const pattern = p.childForFieldName('pattern');
      if (pattern) params.push(pattern.text);
      else params.push(p.text.split(':')[0].split('?')[0].trim());
    } else if (p.type === 'identifier') {
      params.push(p.text);
    } else {
      // Destructuring or rest params — use raw text truncated
      params.push(p.text.length > 30 ? p.text.substring(0, 27) + '...' : p.text);
    }
  }
  return params;
}

/**
 * Extracts all function declarations & arrow functions assigned to variables.
 * Returns: [{ name, startLine, endLine, params, isExported, isDefault, isAsync }]
 */
function extractFunctions(rootNode) {
  const functions = [];

  function visit(node, depth) {
    // Only extract top-level and class-level functions (depth <= 1)
    // depth 0 = program body, depth 1 = inside a class/object

    // function foo() {} or export function foo() {}
    if (node.type === 'function_declaration') {
      const nameNode = node.childForFieldName('name');
      const paramsNode = node.childForFieldName('parameters');
      functions.push({
        name: nameNode ? nameNode.text : '<anonymous>',
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        params: extractParams(paramsNode),
        isExported: isExported(node),
        isDefault: isDefaultExport(node),
        isAsync: node.text.startsWith('async'),
      });
    }

    // const foo = () => {} or const foo = function() {}
    if (node.type === 'lexical_declaration' || node.type === 'variable_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        const declarator = node.namedChild(i);
        if (declarator.type === 'variable_declarator') {
          const nameNode = declarator.childForFieldName('name');
          const valueNode = declarator.childForFieldName('value');
          if (valueNode && (valueNode.type === 'arrow_function' || valueNode.type === 'function_expression' || valueNode.type === 'function')) {
            const paramsNode = valueNode.childForFieldName('parameters');
            functions.push({
              name: nameNode ? nameNode.text : '<anonymous>',
              startLine: node.startPosition.row + 1,
              endLine: node.endPosition.row + 1,
              params: extractParams(paramsNode),
              isExported: isExported(node),
              isDefault: isDefaultExport(node),
              isAsync: valueNode.text.startsWith('async'),
            });
          }
        }
      }
    }

    // Recurse, but not too deep (we want top-level + one level for class methods)
    if (depth < 2) {
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        // Skip recursing into function bodies to avoid extracting nested helpers as top-level
        if (child.type !== 'statement_block' && child.type !== 'function_body') {
          visit(child, depth + 1);
        }
      }
    }
  }

  visit(rootNode, 0);
  return functions;
}

/**
 * Extracts class declarations with their methods.
 * Returns: [{ name, startLine, endLine, superClass, methods[], isExported, isDefault }]
 */
function extractClasses(rootNode) {
  const classes = [];

  function visit(node) {
    if (node.type === 'class_declaration' || node.type === 'class') {
      const nameNode = node.childForFieldName('name');
      const heritageNode = node.childForFieldName('heritage') || node.childForFieldName('superclass');

      let superClass = null;
      if (heritageNode) {
        // Try to get the class name from extends clause
        superClass = heritageNode.text.replace(/^extends\s+/, '').trim();
      }
      // Also check for extends via class_heritage
      for (let i = 0; i < node.namedChildCount; i++) {
        const child = node.namedChild(i);
        if (child.type === 'class_heritage') {
          superClass = child.text.replace(/^extends\s+/, '').split(/\s|<|\{/)[0].trim();
        }
      }

      const methods = [];
      const bodyNode = node.childForFieldName('body');
      if (bodyNode) {
        for (let i = 0; i < bodyNode.namedChildCount; i++) {
          const member = bodyNode.namedChild(i);
          if (member.type === 'method_definition' || member.type === 'public_field_definition') {
            const methodName = member.childForFieldName('name');
            const methodParams = member.childForFieldName('parameters');
            if (methodName) {
              methods.push({
                name: methodName.text,
                startLine: member.startPosition.row + 1,
                endLine: member.endPosition.row + 1,
                params: extractParams(methodParams),
                isAsync: member.text.startsWith('async'),
              });
            }
          }
        }
      }

      classes.push({
        name: nameNode ? nameNode.text : '<anonymous>',
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        superClass,
        methods,
        isExported: isExported(node),
        isDefault: isDefaultExport(node),
      });
    }

    // Only search at top-level (don't find nested classes)
    if (node.type === 'program' || node.type === 'export_statement' || node.type === 'export_default_declaration') {
      for (let i = 0; i < node.namedChildCount; i++) {
        visit(node.namedChild(i));
      }
    }
  }

  visit(rootNode);
  return classes;
}

/**
 * Extracts export statements.
 * Returns: [{ name, localName, isDefault }]
 */
function extractExports(rootNode) {
  const exports = [];

  for (let i = 0; i < rootNode.namedChildCount; i++) {
    const node = rootNode.namedChild(i);

    if (node.type === 'export_statement') {
      // export default X
      const isDefault = node.text.includes('export default');

      // Check for declaration inside export
      for (let j = 0; j < node.namedChildCount; j++) {
        const child = node.namedChild(j);

        if (child.type === 'function_declaration' || child.type === 'class_declaration') {
          const nameNode = child.childForFieldName('name');
          exports.push({
            name: isDefault ? 'default' : (nameNode ? nameNode.text : 'unknown'),
            localName: nameNode ? nameNode.text : 'unknown',
            isDefault,
          });
        } else if (child.type === 'lexical_declaration' || child.type === 'variable_declaration') {
          for (let k = 0; k < child.namedChildCount; k++) {
            const decl = child.namedChild(k);
            if (decl.type === 'variable_declarator') {
              const nameNode = decl.childForFieldName('name');
              if (nameNode) {
                exports.push({ name: nameNode.text, localName: nameNode.text, isDefault });
              }
            }
          }
        } else if (child.type === 'export_clause') {
          // export { A, B as C }
          for (let k = 0; k < child.namedChildCount; k++) {
            const spec = child.namedChild(k);
            if (spec.type === 'export_specifier') {
              const nameNode = spec.childForFieldName('name');
              const aliasNode = spec.childForFieldName('alias');
              exports.push({
                name: aliasNode ? aliasNode.text : (nameNode ? nameNode.text : spec.text),
                localName: nameNode ? nameNode.text : spec.text,
                isDefault: false,
              });
            }
          }
        } else if (child.type === 'identifier') {
          // export default SomeIdentifier
          exports.push({ name: 'default', localName: child.text, isDefault: true });
        }
      }
    } else if (node.type === 'export_default_declaration') {
      // TypeScript-style: export default class/function ...
      for (let j = 0; j < node.namedChildCount; j++) {
        const child = node.namedChild(j);
        const nameNode = child.childForFieldName ? child.childForFieldName('name') : null;
        exports.push({
          name: 'default',
          localName: nameNode ? nameNode.text : child.text.substring(0, 30),
          isDefault: true,
        });
      }
    }
  }

  return exports;
}

/**
 * Extracts function call expressions from the entire file.
 * Returns: [{ callee, containingFunction }]
 */
function extractCalls(rootNode, functions) {
  const calls = [];

  // Build a line-range lookup to determine containing function
  function findContainingFunction(line) {
    for (const fn of functions) {
      if (line >= fn.startLine && line <= fn.endLine) {
        return fn.name;
      }
    }
    return '<module>'; // top-level call
  }

  function visit(node) {
    if (node.type === 'call_expression') {
      const funcNode = node.childForFieldName('function');
      if (funcNode) {
        let callee = '';

        if (funcNode.type === 'identifier') {
          callee = funcNode.text;
        } else if (funcNode.type === 'member_expression') {
          // foo.bar() — extract just 'bar' as the method name
          const propNode = funcNode.childForFieldName('property');
          callee = propNode ? propNode.text : funcNode.text;
        } else {
          callee = funcNode.text;
        }

        // Skip very common/noisy calls
        const skipCalls = new Set([
          'console', 'log', 'warn', 'error', 'info', 'debug',
          'require', 'import', 'setTimeout', 'setInterval',
          'clearTimeout', 'clearInterval', 'Promise',
          'parseInt', 'parseFloat', 'JSON', 'stringify', 'parse',
          'toString', 'valueOf', 'hasOwnProperty',
          'push', 'pop', 'shift', 'unshift', 'splice', 'slice',
          'map', 'filter', 'reduce', 'forEach', 'find', 'findIndex',
          'some', 'every', 'includes', 'indexOf', 'join', 'split',
          'keys', 'values', 'entries', 'from', 'assign',
          'addEventListener', 'removeEventListener',
          'querySelector', 'querySelectorAll', 'getElementById',
          'createElement', 'appendChild', 'removeChild',
          'then', 'catch', 'finally',
        ]);

        if (callee && !skipCalls.has(callee) && callee.length < 60) {
          const line = node.startPosition.row + 1;
          calls.push({
            callee,
            containingFunction: findContainingFunction(line),
          });
        }
      }
    }

    for (let i = 0; i < node.namedChildCount; i++) {
      visit(node.namedChild(i));
    }
  }

  visit(rootNode);

  // Deduplicate: same callee from same containing function only once
  const seen = new Set();
  return calls.filter(c => {
    const key = `${c.containingFunction}::${c.callee}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── Main Parse Pipeline ────────────────────────────────────────────

async function parseFiles(files) {
  const result = [];

  for (const file of files) {
    try {
      let tree = null;

      if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
        parser.setLanguage(tsLang);
        tree = parser.parse(file.content);
      } else if (file.path.endsWith('.js') || file.path.endsWith('.jsx')) {
        parser.setLanguage(jsLang);
        tree = parser.parse(file.content);
      }

      if (!tree) {
        // Non-parseable file — still record as a file node with no entities
        result.push({
          path: file.path,
          astNodeCount: 0,
          functions: [],
          classes: [],
          imports: [],
          exports: [],
          calls: [],
        });
        continue;
      }

      const rootNode = tree.rootNode;
      const functions = extractFunctions(rootNode);
      const classes = extractClasses(rootNode);
      const imports = extractImports(rootNode);
      const exports = extractExports(rootNode);
      const calls = extractCalls(rootNode, functions);

      result.push({
        path: file.path,
        astNodeCount: rootNode.descendantCount,
        functions,
        classes,
        imports,
        exports,
        calls,
      });

    } catch (e) {
      console.error(`[Worker] Failed to parse ${file.path}`, e);
      result.push({
        path: file.path,
        astNodeCount: 0,
        functions: [],
        classes: [],
        imports: [],
        exports: [],
        calls: [],
        error: e.message || e.toString(),
      });
    }
  }

  return result;
}

// ─── Message Handler ────────────────────────────────────────────────

self.onmessage = async (event) => {
  const { id, type, payload } = event.data;

  try {
    if (type === 'INIT') {
      await init();
      self.postMessage({ id, type: 'SUCCESS' });
    } else if (type === 'PARSE') {
      const fileEntities = await parseFiles(payload);
      self.postMessage({ id, type: 'SUCCESS', payload: fileEntities });
    }
  } catch (err) {
    self.postMessage({ id, type: 'ERROR', error: err.message || err.toString() });
  }
};
