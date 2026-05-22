// Ollama Integration Module — local LLM with GPU acceleration
// Primary model: qwen2.5:7b (Q4_K_M) per PRD §10.1
// Fallback model: llama3.1:8b
import axios from 'axios';
import chalk from 'chalk';
import 'dotenv/config';

const DEFAULT_MODEL = process.env.OLLAMA_MODEL ?? 'qwen2.5:7b';
const FALLBACK_MODEL = 'llama3.1:8b';

export class OllamaClient {
  constructor(baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = DEFAULT_MODEL;
    this.isConnected = false;
    this.gpuLayers = -1; // -1 = offload all layers to GPU automatically
  }

  async initialize() {
    try {
      const res = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      this.isConnected = true;

      const models = res.data.models?.map(m => m.name) ?? [];
      const hasQwen = models.some(m => m.startsWith('qwen2.5'));
      const hasLlama = models.some(m => m.startsWith('llama3'));

      if (hasQwen) {
        this.model = models.find(m => m.startsWith('qwen2.5'));
        console.log(chalk.green(`✅ Ollama connected — using ${this.model}`));
      } else if (hasLlama) {
        this.model = models.find(m => m.startsWith('llama3'));
        console.log(chalk.yellow(`⚠️  qwen2.5 not found — falling back to ${this.model}`));
        console.log(chalk.blue('   Pull recommended model: ollama pull qwen2.5:7b'));
      } else {
        console.log(chalk.yellow('⚠️  No compatible model found.'));
        console.log(chalk.blue('   Run: ollama pull qwen2.5:7b'));
      }

      return true;
    } catch (error) {
      console.log(chalk.yellow('⚠️  Ollama not running. To set up:'));
      console.log('   1. Install: https://ollama.ai/download');
      console.log('   2. Start:   ollama serve');
      console.log('   3. Pull:    ollama pull qwen2.5:7b');
      this.isConnected = false;
      return false;
    }
  }

  async setModel(modelName) {
    this.model = modelName;
    console.log(chalk.blue(`📦 Model set to: ${modelName}`));
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models?.map(m => m.name) ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Chat with optional JSON mode (grammar-constrained decoding per PRD §10.2)
   * @param {string} systemPrompt
   * @param {string} userMessage
   * @param {object} options  { temperature, maxTokens, jsonMode }
   */
  async chat(systemPrompt, userMessage, options = {}) {
    if (!this.isConnected) throw new Error('Ollama not connected. Run initialize() first.');

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: false,
      options: {
        temperature: options.temperature ?? 0.1,
        num_predict: options.maxTokens ?? 4096,
        num_gpu: this.gpuLayers,       // GPU acceleration
        num_thread: 8,
      }
    };

    // JSON mode: Ollama grammar-constrained output
    if (options.jsonMode) {
      payload.format = 'json';
    }

    try {
      const response = await axios.post(`${this.baseUrl}/api/chat`, payload, { timeout: 180000 });
      return response.data.message.content;
    } catch (error) {
      throw new Error(`Ollama chat error: ${error.message}`);
    }
  }

  /**
   * Streaming chat — yields text chunks via onChunk callback
   */
  async streamChat(systemPrompt, userMessage, onChunk, options = {}) {
    if (!this.isConnected) throw new Error('Ollama not connected.');

    const payload = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      stream: true,
      options: {
        temperature: options.temperature ?? 0.3,
        num_gpu: this.gpuLayers,
        num_thread: 8,
      }
    };

    const response = await axios.post(`${this.baseUrl}/api/chat`, payload, {
      timeout: 300000,
      responseType: 'stream'
    });

    return new Promise((resolve, reject) => {
      let full = '';
      response.data.on('data', (chunk) => {
        const lines = chunk.toString().split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const json = JSON.parse(line);
            if (json.message?.content) {
              full += json.message.content;
              onChunk?.(json.message.content);
            }
          } catch { /* ignore partial chunks */ }
        }
      });
      response.data.on('end', () => resolve(full));
      response.data.on('error', reject);
    });
  }

  /**
   * Extract structured JSON from text using JSON mode.
   * Retries once on validation failure (per PRD §10.2).
   */
  async extractJson(systemPrompt, userMessage) {
    let raw = await this.chat(systemPrompt, userMessage, { jsonMode: true, temperature: 0.0 });
    try {
      return JSON.parse(raw);
    } catch {
      // One retry
      raw = await this.chat(systemPrompt, `Fix this invalid JSON and return only valid JSON:\n${raw}`, {
        jsonMode: true, temperature: 0.0
      });
      return JSON.parse(raw);
    }
  }
}

export default OllamaClient;
