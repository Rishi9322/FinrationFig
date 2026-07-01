import fetch from 'node-fetch';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || '';
let modelName = process.env.OPENROUTER_MODEL_NAME || process.env.VITE_OPENROUTER_MODEL_NAME || 'anthropic/claude-3.5-sonnet';

class OpenRouterClient {
  constructor() {
    this.isConnected = Boolean(OPENROUTER_API_KEY);
    this.model = modelName;
  }

  async initialize() {
    // No heavy initialization required for OpenRouter; verify key by a lightweight call if desired
    this.isConnected = Boolean(OPENROUTER_API_KEY);
    return this.isConnected;
  }

  async chat(systemPrompt, userMessage) {
    if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key missing');

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.2
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OpenRouter error ${res.status}: ${txt}`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }

  async extractJson(systemPrompt, userMessage) {
    // Use OpenRouter response_format json_object to get structured JSON
    if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key missing');

    const body = {
      model: this.model,
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`OpenRouter error ${res.status}: ${txt}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('No content from OpenRouter');
    // content should be a JSON string or object
    if (typeof content === 'object') return content;
    try {
      return JSON.parse(content);
    } catch (err) {
      // Try to extract JSON from fenced block
      const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i);
      const candidate = fenced?.[1] ?? content;
      return JSON.parse(candidate);
    }
  }

  async getAvailableModels() {
    // OpenRouter doesn't expose a public models list endpoint for all users; return configured model
    return [this.model];
  }

  async setModel(name) {
    modelName = name;
    this.model = name;
  }

  async streamChat(systemPrompt, userMessage, onChunk, opts = {}) {
    if (!OPENROUTER_API_KEY) throw new Error('OpenRouter API key missing');

    const body = {
      model: this.model,
      temperature: opts.temperature ?? 0.3,
      stream: true,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    };

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok || !res.body) throw new Error('Streaming request failed');

    const decoder = new TextDecoder();

    // Prefer async iteration when available — it's the idiomatic way to
    // consume a streaming body and makes the sequential nature explicit.
    if (res.body && typeof res.body[Symbol.asyncIterator] === 'function') {
      try {
        for await (const chunk of res.body) {
          const decoded = decoder.decode(chunk);
          try { onChunk(decoded); } catch (err) { /* swallow callback errors */ }
        }
        return;
      } catch (err) {
        // fallthrough to reader-based approach on unexpected stream errors
      }
    }

    // Fallback: use reader when async iterator isn't available.
    // Note: streaming inherently requires sequential reads — each chunk
    // arrives in order and must be processed one after another. This is a
    // valid use of awaiting inside a loop because ordering matters.
    const reader = res.body.getReader();
    let done = false;
    while (!done) {
      const { value, done: rdone } = await reader.read();
      done = rdone;
      if (value) {
        const chunk = decoder.decode(value);
        try { onChunk(chunk); } catch (err) { /* swallow callback errors */ }
      }
    }
  }
}

export default OpenRouterClient;
