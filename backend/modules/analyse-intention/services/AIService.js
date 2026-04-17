/**
 * Service IA minimal pour l'analyse d'intentions via Ollama.
 */
class AIService {
  constructor(options = {}) {
    this.ollamaUrl = (options.ollamaUrl || process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/+$/, '');
    this.model = options.model || process.env.OLLAMA_MODEL || 'mistral:latest';
  }

  async chat(prompt) {
    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.model,
        prompt,
        stream: false
      })
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Ollama HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const payload = await response.json();
    return payload?.response || '';
  }
}

module.exports = AIService;
