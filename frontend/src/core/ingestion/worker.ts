import Parser from 'web-tree-sitter';

let parser: any = null;
let tsLang: any = null;
let jsLang: any = null;
let isInitialized = false;

async function init() {
  if (isInitialized) return;
  
  await Parser.init({
    locateFile(scriptName: string) {
      return '/' + scriptName;
    },
  });
  
  parser = new Parser();
  
  tsLang = await Parser.Language.load('/tree-sitter-typescript.wasm');
  jsLang = await Parser.Language.load('/tree-sitter-javascript.wasm');

  isInitialized = true;
  console.log('[Worker] Tree-sitter fully initialized');
}

async function parseFiles(files: any[]) {
  const graph = {
    nodes: [] as any[],
    edges: [] as any[],
  };

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

      graph.nodes.push({
        id: file.path,
        label: 'File',
        properties: { 
          name: file.path, 
          parsed: !!tree,
          astNodeCount: tree ? tree.rootNode.descendantCount : 0 
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
  } catch (err: any) {
    self.postMessage({ id, type: 'ERROR', error: err.message || err.toString() });
  }
};
