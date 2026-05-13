// Ollama Integration Module - Connect to local LLM
import axios from 'axios';
import chalk from 'chalk';

export class OllamaClient {
  constructor(baseUrl = 'http://localhost:11434') {
    this.baseUrl = baseUrl;
    this.model = 'mistral'; // Default model - financial focused
    this.isConnected = false;
  }

  async initialize() {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 5000 });
      this.isConnected = true;
      console.log(chalk.green('✅ Ollama Connected'));
      return true;
    } catch (error) {
      console.log(chalk.yellow('⚠️  Ollama not detected. Setup guide:'));
      console.log('   1. Install: https://ollama.ai/download');
      console.log('   2. Run: ollama serve');
      console.log('   3. Pull model: ollama pull mistral');
      console.log('   4. Or use: ollama pull neural-chat');
      this.isConnected = false;
      return false;
    }
  }

  async setModel(modelName) {
    this.model = modelName;
    console.log(chalk.blue(`📦 Using model: ${modelName}`));
  }

  async getAvailableModels() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`);
      return response.data.models.map(m => m.name);
    } catch (error) {
      console.error('Error fetching models:', error.message);
      return [];
    }
  }

  async chat(systemPrompt, userMessage, options = {}) {
    if (!this.isConnected) {
      throw new Error('Ollama not connected. Run setup first.');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          stream: false,
          temperature: options.temperature || 0.7,
          num_predict: options.maxTokens || 2000
        },
        { timeout: 120000 }
      );

      return response.data.message.content;
    } catch (error) {
      throw new Error(`Chat error: ${error.message}`);
    }
  }

  async streamChat(systemPrompt, userMessage, onChunk, options = {}) {
    if (!this.isConnected) {
      throw new Error('Ollama not connected.');
    }

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/chat`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          stream: true,
          temperature: options.temperature || 0.7
        },
        {
          timeout: 120000,
          responseType: 'stream'
        }
      );

      return new Promise((resolve, reject) => {
        let fullResponse = '';
        response.data.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(l => l);
            for (const line of lines) {
              const json = JSON.parse(line);
              if (json.message?.content) {
                fullResponse += json.message.content;
                onChunk?.(json.message.content);
              }
            }
          } catch (e) {
            // Ignore parse errors
          }
        });

        response.data.on('end', () => resolve(fullResponse));
        response.data.on('error', reject);
      });
    } catch (error) {
      throw new Error(`Stream chat error: ${error.message}`);
    }
  }

  async analyze(text, analysisType = 'general') {
    const prompts = {
      financial: `You are a financial expert. Analyze this financial document and provide key insights:`,
      legal: `You are a legal expert. Review this document for legal compliance:`,
      technical: `You are a technical analyst. Evaluate this document:`,
      general: `Analyze this document and provide comprehensive insights:`
    };

    return this.chat(prompts[analysisType] || prompts.general, text);
  }
}

export default OllamaClient;
