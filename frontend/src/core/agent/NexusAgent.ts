import { ChatOllama } from '@langchain/ollama';
import { NEXUS_AGENT_PROMPT } from '../ai/prompts/systemPrompts';
import { getGraphStatsTool, getGraphNodeTool, getGraphNeighborsTool } from './tools/GraphTools';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';

export class NexusAgent {
  private llm: any = null;
  private tools = [getGraphStatsTool, getGraphNodeTool, getGraphNeighborsTool];
  private toolsByName = {
    get_graph_stats: getGraphStatsTool,
    get_graph_node: getGraphNodeTool,
    get_graph_neighbors: getGraphNeighborsTool,
  };

  async init() {
    const baseLlm = new ChatOllama({
      model: 'llama3.2:1b',
      temperature: 0,
      baseUrl: 'http://localhost:11434'
    });
    // Bind the tools to ChatOllama
    this.llm = baseLlm.bindTools(this.tools);
  }

  async ask(question: string): Promise<string> {
    if (!this.llm) {
      try {
        await this.init();
      } catch (e) {
        return "Failed to initialize LangChain agent. Please ensure Ollama is running.";
      }
    }
    
    // We maintain a list of messages for the agent session
    const messages: any[] = [
      new SystemMessage(NEXUS_AGENT_PROMPT),
      new HumanMessage(question)
    ];

    // ReAct agent execution loop
    const maxSteps = 5;
    for (let step = 0; step < maxSteps; step++) {
      try {
        const result = await this.llm.invoke(messages);
        messages.push(result);

        // If the model didn't request any tool calls, return the final response
        if (!result.tool_calls || result.tool_calls.length === 0) {
          return result.content as string;
        }

        // Execute all requested tool calls
        for (const toolCall of result.tool_calls) {
          const tool = (this.toolsByName as any)[toolCall.name];
          let toolOutput = '';
          if (tool) {
            console.log(`[NexusAgent] Calling tool ${toolCall.name} with args:`, toolCall.args);
            
            // Robustly extract the string argument expected by the graph tools
            let arg = '';
            if (typeof toolCall.args === 'string') {
              arg = toolCall.args;
            } else if (toolCall.args && typeof toolCall.args === 'object') {
              const keys = Object.keys(toolCall.args);
              if (keys.length > 0) {
                const val = toolCall.args.nodeId || toolCall.args.input || toolCall.args[keys[0]];
                arg = typeof val === 'string' ? val : JSON.stringify(val);
              }
            }

            try {
              toolOutput = await tool.func(arg);
            } catch (err: any) {
              toolOutput = `Error executing tool: ${err.message || err}`;
            }
          } else {
            toolOutput = `Tool ${toolCall.name} not found.`;
          }

          messages.push(new ToolMessage({
            content: toolOutput,
            tool_call_id: toolCall.id,
            name: toolCall.name
          }));
        }

      } catch (e) {
        console.error('[NexusAgent] Error in agent execution loop:', e);
        return "Mycelium Agent failed to process the request. (Make sure Ollama has finished downloading the llama3.2:1b model)";
      }
    }

    // Fallback if execution took too many steps
    const lastMessage = messages[messages.length - 1];
    return lastMessage instanceof AIMessage && lastMessage.content
      ? (lastMessage.content as string)
      : "Agent execution timed out or reached maximum step limit.";
  }
}

export const nexusAgent = new NexusAgent();

