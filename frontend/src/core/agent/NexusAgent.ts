import { ChatOllama } from '@langchain/ollama';
import { NEXUS_AGENT_PROMPT } from '../ai/prompts/systemPrompts';

export class NexusAgent {
  private llm: ChatOllama | null = null;

  async init() {
    this.llm = new ChatOllama({
      model: 'llama3.2:1b',
      temperature: 0,
      baseUrl: 'http://localhost:11434'
    });
  }

  async ask(question: string): Promise<string> {
    if (!this.llm) {
      try {
        await this.init();
      } catch (e) {
        return "Failed to initialize LangChain agent. Please ensure Ollama is running.";
      }
    }
    
    try {
      const result = await this.llm!.invoke([
        ["system", NEXUS_AGENT_PROMPT],
        ["human", question]
      ]);
      return result.content as string;
    } catch (e) {
      console.error(e);
      return "Mycelium Agent failed to process the request. (Make sure Ollama has finished downloading the llama3.2:1b model)";
    }
  }
}

export const nexusAgent = new NexusAgent();
