import { GraphService, type FileEntity } from '../graph/GraphService';

class IngestionEngine {
  private worker: Worker | null = null;
  private messageIdCounter = 0;
  public activeGraphService: GraphService | null = null;
  
  private invokeWorker(type: string, payload?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.worker) return reject(new Error('Worker not initialized'));
      
      const id = ++this.messageIdCounter;
      
      const handler = (event: MessageEvent) => {
        if (event.data.id === id) {
          this.worker!.removeEventListener('message', handler);
          if (event.data.type === 'ERROR') {
            reject(new Error(event.data.error));
          } else {
            resolve(event.data.payload);
          }
        }
      };
      
      this.worker.addEventListener('message', handler);
      this.worker.postMessage({ id, type, payload });
    });
  }

  async init() {
    if (this.worker) return;
    
    // Use the classic worker from public directory
    this.worker = new Worker('/worker.js');
    
    this.worker.onerror = (e) => {
      console.error('[IngestionEngine] Worker crashed:', e.message, e.filename, e.lineno);
    };

    // Initialize Tree-sitter inside the worker
    try {
      await this.invokeWorker('INIT');
      console.log('[IngestionEngine] Worker initialized');
    } catch (err) {
      console.error('[IngestionEngine] Failed to init worker:', err);
      throw err;
    }
  }

  async parseRepository(files: { path: string, content: string }[]) {
    if (!this.worker) {
      await this.init();
    }
    
    console.log('[IngestionEngine] Sending files to worker...');
    const fileEntities: FileEntity[] = await this.invokeWorker('PARSE', files);
    console.log('[IngestionEngine] Received entities from worker, building graph...');
    
    const graphService = new GraphService();
    graphService.buildGraph(fileEntities);
    this.activeGraphService = graphService;
    
    return graphService;
  }
}

export const ingestionEngine = new IngestionEngine();
