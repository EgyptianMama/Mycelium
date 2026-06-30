import { WebLLMProvider } from './providers/WebLLMProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { useAIStore } from '../../store/aiStore';

class AIEngine {
  private webLLM = new WebLLMProvider();
  private ollama = new OllamaProvider();

  async initialize() {
    const isOllamaAvailable = await this.ollama.checkAvailability();
    if (isOllamaAvailable) {
      console.log('[AIEngine] Ollama is available, using as primary engine.');
      useAIStore.getState().setProvider('ollama');
      useAIStore.getState().setLoaded(true);
      return;
    }

    console.log('[AIEngine] Ollama not available. Falling back to WebLLM.');
    useAIStore.getState().setProvider('webllm');
    await this.webLLM.initialize();
  }

  async generateResponse(prompt: string, systemPrompt: string): Promise<string> {
    const provider = useAIStore.getState().activeProvider;
    
    // If it's a Nexus chat request and we have Ollama (which supports tools), use the Agent
    if (provider === 'ollama' && systemPrompt.includes('Mycelium')) {
      const { nexusAgent } = await import('../agent/NexusAgent');
      return nexusAgent.ask(prompt);
    }
    
    if (provider === 'ollama') {
      return this.ollama.generateResponse(prompt, systemPrompt);
    } else if (provider === 'webllm') {
      return this.webLLM.generateResponse(prompt, systemPrompt);
    }
    throw new Error('No AI provider initialized');
  }

  async *streamResponse(prompt: string, systemPrompt: string): AsyncGenerator<string, void, unknown> {
    const provider = useAIStore.getState().activeProvider;
    if (provider === 'ollama') {
      yield* this.ollama.streamResponse(prompt, systemPrompt);
    } else if (provider === 'webllm') {
      yield* this.webLLM.streamResponse(prompt, systemPrompt);
    } else {
      throw new Error('No AI provider initialized');
    }
  }
}

export const aiEngine = new AIEngine();
