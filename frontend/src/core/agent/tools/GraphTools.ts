import { DynamicTool } from '@langchain/core/tools';
import { ingestionEngine } from '../../ingestion/IngestionEngine';

export const getGraphStatsTool = new DynamicTool({
  name: 'get_graph_stats',
  description: 'Returns the total number of files, functions, classes, and edges in the codebase.',
  func: async () => {
    try {
      if (!ingestionEngine.activeGraphService) return 'Graph not initialized.';
      return JSON.stringify(ingestionEngine.activeGraphService.getStats());
    } catch (e) {
      return 'Error retrieving stats';
    }
  },
});

export const getGraphNodeTool = new DynamicTool({
  name: 'get_graph_node',
  description: 'Returns metadata for a specific node by its ID (e.g. file::src/App.tsx). Returns undefined if not found.',
  func: async (nodeId: string) => {
    try {
      if (!ingestionEngine.activeGraphService) return 'Graph not initialized.';
      const graph = (ingestionEngine.activeGraphService as any).graph;
      if (graph.hasNode(nodeId)) {
        return JSON.stringify(graph.getNodeAttributes(nodeId));
      }
      return 'Node not found.';
    } catch (e) {
      return 'Error retrieving node';
    }
  },
});

export const getGraphNeighborsTool = new DynamicTool({
  name: 'get_graph_neighbors',
  description: 'Returns the neighbors (connected nodes) for a specific node ID, including the type of connection (e.g. CONTAINS, CALLS, IMPORTS).',
  func: async (nodeId: string) => {
    try {
      if (!ingestionEngine.activeGraphService) return 'Graph not initialized.';
      const graph = (ingestionEngine.activeGraphService as any).graph;
      if (graph.hasNode(nodeId)) {
        const neighbors: any[] = [];
        graph.forEachEdge(nodeId, (_edge: any, attributes: any, _source: string, target: string) => {
          neighbors.push({ target, type: attributes.type });
        });
        return JSON.stringify(neighbors);
      }
      return 'Node not found.';
    } catch (e) {
      return 'Error retrieving neighbors';
    }
  },
});
