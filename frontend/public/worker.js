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

function extractImports(node) {
  const imports = [];
  
  function traverse(n) {
    if (n.type === 'import_statement') {
      const sourceNode = n.childForFieldName('source');
      if (sourceNode) imports.push(sourceNode.text.replace(/['"]/g, ''));
    } else if (n.type === 'call_expression') {
      const funcNode = n.childForFieldName('function');
      if (funcNode && funcNode.text === 'require') {
        const argsNode = n.childForFieldName('arguments');
        if (argsNode && argsNode.namedChildCount > 0) {
          const arg = argsNode.namedChild(0);
          if (arg && arg.type === 'string') {
            imports.push(arg.text.replace(/['"]/g, ''));
          }
        }
      }
    }
    
    for (let i = 0; i < n.namedChildCount; i++) {
      traverse(n.namedChild(i));
    }
  }
  
  traverse(node);
  return imports;
}

async function parseFiles(files) {
  const graph = {
    nodes: [],
    links: [],
  };

  const filePathsSet = new Set(files.map(f => f.path));
  const findExistingPath = (resolvedPath) => {
    if (filePathsSet.has(resolvedPath)) return resolvedPath;
    const exts = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.js', '/index.tsx', '/index.jsx'];
    for (const ext of exts) {
      if (filePathsSet.has(resolvedPath + ext)) return resolvedPath + ext;
    }
    return null;
  };

  for (const file of files) {
    try {
      let tree = null;
      let imports = [];
      if (file.path.endsWith('.ts') || file.path.endsWith('.tsx')) {
        parser.setLanguage(tsLang);
        tree = parser.parse(file.content);
        imports = extractImports(tree.rootNode);
      } else if (file.path.endsWith('.js') || file.path.endsWith('.jsx')) {
        parser.setLanguage(jsLang);
        tree = parser.parse(file.content);
        imports = extractImports(tree.rootNode);
      }

      graph.nodes.push({
        id: file.path,
        label: 'File',
        properties: { 
          name: file.path, 
          parsed: !!tree,
          astNodeCount: tree ? tree.rootNode.descendantCount : 0 
        }
      });
      
      // Build edges based on relative imports
      imports.forEach(imp => {
        let resolved = imp;
        if (imp.startsWith('.')) {
          const baseParts = file.path.split('/');
          baseParts.pop();
          const relParts = imp.split('/');
          for (const part of relParts) {
            if (part === '.') continue;
            if (part === '..') baseParts.pop();
            else baseParts.push(part);
          }
          resolved = baseParts.join('/');
        }
        
        const targetPath = findExistingPath(resolved);
        if (targetPath) {
          graph.links.push({
            source: file.path,
            target: targetPath,
            label: 'IMPORTS'
          });
        }
      });
      
    } catch (e) {
      console.error(`[Worker] Failed to parse ${file.path}`, e);
    }
  }

  return graph;
}

// Handle incoming messages
self.onmessage = async (event) => {
  const { id, type, payload } = event.data;
  
  try {
    if (type === 'INIT') {
      await init();
      self.postMessage({ id, type: 'SUCCESS' });
    } else if (type === 'PARSE') {
      const graph = await parseFiles(payload);
      self.postMessage({ id, type: 'SUCCESS', payload: graph });
    }
  } catch (err) {
    self.postMessage({ id, type: 'ERROR', error: err.message || err.toString() });
  }
};
