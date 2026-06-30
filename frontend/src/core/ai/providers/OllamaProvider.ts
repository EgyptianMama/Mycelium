export class OllamaProvider {
  private baseUrl = 'http://localhost:11434';
  public readonly modelId = 'llama3'; // Default fallback model

  async checkAvailability(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateResponse(prompt: string, systemPrompt: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelId,
        prompt: prompt,
        system: systemPrompt,
        stream: false,
        options: { temperature: 0.1 }
      })
    });
    const data = await res.json();
    return data.response;
  }

  async *streamResponse(prompt: string, systemPrompt: string): AsyncGenerator<string, void, unknown> {
    const res = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelId,
        prompt: prompt,
        system: systemPrompt,
        stream: true,
        options: { temperature: 0.1 }
      })
    });

    if (!res.body) throw new Error('ReadableStream not supported in this browser.');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        const json = JSON.parse(line);
        if (json.response) {
          yield json.response;
        }
      }
    }
  }
}
