import { CreateMLCEngine, MLCEngine, type InitProgressReport } from '@mlc-ai/web-llm';
import { useAIStore } from '../../../store/aiStore';

export class WebLLMProvider {
  private engine: MLCEngine | null = null;
  // Recommended model, lightweight and capable for code reasoning
  public readonly modelId = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

  async initialize(): Promise<boolean> {
    if (this.engine) return true;

    try {
      const initProgressCallback = (report: InitProgressReport) => {
        useAIStore.getState().setProgress(report.progress, report.text);
      };

      this.engine = await CreateMLCEngine(this.modelId, {
        initProgressCallback,
      });

      useAIStore.getState().setLoaded(true);
      return true;
    } catch (err) {
      console.error('[WebLLMProvider] Failed to initialize:', err);
      return false;
    }
  }

  async generateResponse(prompt: string, systemPrompt: string): Promise<string> {
    if (!this.engine) throw new Error('Engine not initialized');

    const reply = await this.engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
    });

    return reply.choices[0].message.content || '';
  }

  async *streamResponse(prompt: string, systemPrompt: string): AsyncGenerator<string, void, unknown> {
    if (!this.engine) throw new Error('Engine not initialized');

    const stream = await this.engine.chat.completions.create({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        yield content;
      }
    }
  }
}
