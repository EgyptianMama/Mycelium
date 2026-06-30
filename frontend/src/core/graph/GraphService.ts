import Graph from 'graphology';

export interface FileEntity {
  path: string;
  astNodeCount: number;
  functions: Array<{ name: string; startLine: number; endLine: number; params: string[]; isExported: boolean; isAsync: boolean; isDefault?: boolean }>;
  classes: Array<{ name: string; startLine: number; endLine: number; superClass: string | null; methods: any[]; isExported: boolean; isDefault?: boolean }>;
  imports: Array<{ source: string; names: string[] }>;
  exports: Array<{ name: string; localName: string; isDefault: boolean }>;
  calls: Array<{ callee: string; containingFunction: string }>;
  error?: string;
}

export class GraphService {
  private graph: Graph;

  constructor() {
    this.graph = new Graph({ multi: true, type: 'directed' });
  }

  /**
   * Build the graphology graph from the parsed file entities returned by the worker.
   */
  public buildGraph(fileEntities: FileEntity[]) {
    this.graph.clear();
    
    // First Pass: Create all nodes (files, functions, classes)
    fileEntities.forEach(file => {
      const fileId = `file::${file.path}`;
      if (!this.graph.hasNode(fileId)) {
        this.graph.addNode(fileId, {
          type: 'file',
          label: file.path.split('/').pop() || file.path,
          path: file.path,
          astNodeCount: file.astNodeCount,
          error: file.error,
        });
      }

      file.functions.forEach(fn => {
        const fnId = `fn::${file.path}::${fn.name}`;
        if (!this.graph.hasNode(fnId)) {
          this.graph.addNode(fnId, {
            type: 'function',
            label: fn.name,
            path: file.path,
            ...fn
          });
        }
      });

      file.classes.forEach(cls => {
        const clsId = `class::${file.path}::${cls.name}`;
        if (!this.graph.hasNode(clsId)) {
          this.graph.addNode(clsId, {
            type: 'class',
            label: cls.name,
            path: file.path,
            ...cls
          });
        }
      });
    });

    // Helper to find the actual resolved path for an import
    const filePaths = new Set(fileEntities.map(f => f.path));
    const resolveImportPath = (sourceFile: string, importPath: string) => {
      let resolved = importPath;
      if (importPath.startsWith('.')) {
        const baseParts = sourceFile.split('/');
        baseParts.pop(); // remove filename
        const relParts = importPath.split('/');
        for (const part of relParts) {
          if (part === '.') continue;
          if (part === '..') baseParts.pop();
          else baseParts.push(part);
        }
        resolved = baseParts.join('/');
      }
      
      if (filePaths.has(resolved)) return resolved;
      const exts = ['.ts', '.tsx', '.js', '.jsx', '/index.ts', '/index.tsx', '/index.js', '/index.jsx'];
      for (const ext of exts) {
        if (filePaths.has(resolved + ext)) return resolved + ext;
      }
      return null;
    };

    // Second Pass: Add Edges
    fileEntities.forEach(file => {
      const fileId = `file::${file.path}`;

      // File -> Function/Class (CONTAINS)
      file.functions.forEach(fn => {
        const fnId = `fn::${file.path}::${fn.name}`;
        this.addEdgeIfValid(fileId, fnId, 'CONTAINS');
      });
      
      file.classes.forEach(cls => {
        const clsId = `class::${file.path}::${cls.name}`;
        this.addEdgeIfValid(fileId, clsId, 'CONTAINS');
      });

      // Imports (File -> File)
      file.imports.forEach(imp => {
        const targetPath = resolveImportPath(file.path, imp.source);
        if (targetPath) {
          const targetFileId = `file::${targetPath}`;
          this.addEdgeIfValid(fileId, targetFileId, 'IMPORTS');
        }
      });

      // Calls (Function -> Function) or (Module -> Function)
      file.calls.forEach(call => {
        const sourceId = call.containingFunction === '<module>' 
          ? fileId 
          : `fn::${file.path}::${call.containingFunction}`;
        
        // Find who we are calling (intra-file first)
        const localFn = file.functions.find(f => f.name === call.callee);
        if (localFn) {
          const targetId = `fn::${file.path}::${localFn.name}`;
          this.addEdgeIfValid(sourceId, targetId, 'CALLS');
        }
      });
    });
    
    console.log(`[GraphService] Graph built: ${this.graph.order} nodes, ${this.graph.size} edges`);
  }

  private addEdgeIfValid(source: string, target: string, type: string) {
    if (this.graph.hasNode(source) && this.graph.hasNode(target)) {
      // Ensure we don't duplicate identical edges between nodes
      let hasEdge = false;
      this.graph.forEachEdge(source, target, (_edge, attr) => {
        if (attr.type === type) hasEdge = true;
      });
      
      if (!hasEdge) {
        this.graph.addEdge(source, target, { type });
      }
    }
  }

  /**
   * Serializes the graph for react-force-graph-3d
   */
  public getForceGraphData() {
    const nodes = this.graph.mapNodes((id, attributes) => ({
      id,
      ...attributes
    }));

    const links = this.graph.mapEdges((id, attributes, source, target) => ({
      id,
      source,
      target,
      label: attributes.type,
      ...attributes
    }));

    return { nodes, links };
  }
  
  public getStats() {
    let files = 0, functions = 0, classes = 0;
    this.graph.forEachNode((_, attr) => {
      if (attr.type === 'file') files++;
      else if (attr.type === 'function') functions++;
      else if (attr.type === 'class') classes++;
    });
    
    return {
      nodes: this.graph.order,
      edges: this.graph.size,
      files,
      functions,
      classes
    };
  }
}
