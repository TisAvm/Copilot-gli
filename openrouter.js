/**
 * OpenRouter Integration for Copilot GLI
 *
 * Provides access to 200+ AI models via OpenRouter API.
 * Users can bring their own API key and use any model:
 * Claude, GPT, Gemini, Llama, Mistral, DeepSeek, etc.
 *
 * https://openrouter.ai
 */

const https = require('https');

class OpenRouterService {
  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
    this.baseUrl = 'openrouter.ai';
    this.defaultModel = process.env.OPENROUTER_DEFAULT_MODEL || 'anthropic/claude-sonnet-4-20250514';
    this.appName = 'Copilot GLI';
    this.enabled = !!this.apiKey;
    this.cachedModels = null;
    this.cacheTime = 0;
  }

  /**
   * Fetch available models from OpenRouter
   */
  async getModels(forceRefresh = false) {
    // Cache for 10 minutes
    if (this.cachedModels && !forceRefresh && Date.now() - this.cacheTime < 600000) {
      return this.cachedModels;
    }

    return new Promise((resolve, reject) => {
      const req = https.get({
        hostname: this.baseUrl,
        path: '/api/v1/models',
        headers: { 'Accept': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const models = (parsed.data || []).map(m => ({
              id: m.id,
              name: m.name || m.id,
              description: m.description || '',
              context: m.context_length || 0,
              pricing: {
                prompt: m.pricing?.prompt || '0',
                completion: m.pricing?.completion || '0',
              },
              provider: m.id.split('/')[0] || 'unknown',
              isFree: parseFloat(m.pricing?.prompt || '0') === 0,
            }));

            // Sort: free first, then by provider
            models.sort((a, b) => {
              if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
              return a.provider.localeCompare(b.provider);
            });

            this.cachedModels = models;
            this.cacheTime = Date.now();
            resolve(models);
          } catch (err) {
            reject(new Error(`Failed to parse models: ${err.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }

  /**
   * Send a chat completion request to OpenRouter
   */
  async chat(messages, options = {}) {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env',
      };
    }

    const model = options.model || this.defaultModel;
    const payload = JSON.stringify({
      model,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      top_p: options.topP ?? 1,
      stream: false,
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: this.baseUrl,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/TisAvm/Copilot-gli',
          'X-Title': this.appName,
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              resolve({
                success: false,
                error: parsed.error.message || JSON.stringify(parsed.error),
              });
              return;
            }

            const choice = parsed.choices?.[0];
            resolve({
              success: true,
              content: choice?.message?.content || '',
              model: parsed.model || model,
              usage: parsed.usage || {},
              id: parsed.id,
              finishReason: choice?.finish_reason,
            });
          } catch (err) {
            resolve({ success: false, error: `Parse error: ${err.message}` });
          }
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message });
      });

      req.setTimeout(60000, () => {
        req.destroy();
        resolve({ success: false, error: 'Request timed out (60s)' });
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Stream a chat completion (returns chunks via callback)
   */
  async chatStream(messages, onChunk, options = {}) {
    if (!this.apiKey) {
      onChunk({ done: true, error: 'OpenRouter API key not configured' });
      return;
    }

    const model = options.model || this.defaultModel;
    const payload = JSON.stringify({
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      max_tokens: options.maxTokens || 4096,
      temperature: options.temperature ?? 0.7,
      stream: true,
    });

    return new Promise((resolve) => {
      const req = https.request({
        hostname: this.baseUrl,
        path: '/api/v1/chat/completions',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://github.com/TisAvm/Copilot-gli',
          'X-Title': this.appName,
          'Content-Length': Buffer.byteLength(payload),
        },
      }, (res) => {
        let buffer = '';

        res.on('data', (chunk) => {
          buffer += chunk.toString();
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data: ')) continue;
            const jsonStr = trimmed.slice(6);
            if (jsonStr === '[DONE]') {
              onChunk({ done: true });
              resolve();
              return;
            }
            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) onChunk({ done: false, content: delta });
            } catch {}
          }
        });

        res.on('end', () => {
          onChunk({ done: true });
          resolve();
        });
      });

      req.on('error', (err) => {
        onChunk({ done: true, error: err.message });
        resolve();
      });

      req.setTimeout(120000, () => {
        req.destroy();
        onChunk({ done: true, error: 'Stream timed out' });
        resolve();
      });

      req.write(payload);
      req.end();
    });
  }

  /**
   * Get popular/curated model list for the UI
   */
  getCuratedModels() {
    return [
      // Anthropic
      { id: 'anthropic/claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'Anthropic', tier: 'standard' },
      { id: 'anthropic/claude-haiku-4-20250414', name: 'Claude Haiku 4', provider: 'Anthropic', tier: 'fast' },
      { id: 'anthropic/claude-opus-4-20250918', name: 'Claude Opus 4', provider: 'Anthropic', tier: 'premium' },
      // OpenAI
      { id: 'openai/gpt-4o', name: 'GPT-4o', provider: 'OpenAI', tier: 'standard' },
      { id: 'openai/gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', tier: 'fast' },
      { id: 'openai/gpt-4.1', name: 'GPT-4.1', provider: 'OpenAI', tier: 'standard' },
      { id: 'openai/o4-mini', name: 'o4-mini', provider: 'OpenAI', tier: 'standard' },
      // Google
      { id: 'google/gemini-2.5-pro-preview', name: 'Gemini 2.5 Pro', provider: 'Google', tier: 'standard' },
      { id: 'google/gemini-2.5-flash-preview', name: 'Gemini 2.5 Flash', provider: 'Google', tier: 'fast' },
      // Meta
      { id: 'meta-llama/llama-4-maverick', name: 'Llama 4 Maverick', provider: 'Meta', tier: 'standard' },
      { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout', provider: 'Meta', tier: 'fast' },
      // DeepSeek
      { id: 'deepseek/deepseek-chat-v3-0324', name: 'DeepSeek V3', provider: 'DeepSeek', tier: 'standard' },
      { id: 'deepseek/deepseek-r1', name: 'DeepSeek R1', provider: 'DeepSeek', tier: 'premium' },
      // Mistral
      { id: 'mistralai/mistral-large-2411', name: 'Mistral Large', provider: 'Mistral', tier: 'standard' },
      { id: 'mistralai/codestral-2501', name: 'Codestral', provider: 'Mistral', tier: 'standard' },
      // Free models
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', provider: 'Meta', tier: 'free' },
      { id: 'google/gemma-3-27b-it:free', name: 'Gemma 3 27B (Free)', provider: 'Google', tier: 'free' },
      { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3 (Free)', provider: 'DeepSeek', tier: 'free' },
      { id: 'qwen/qwen-2.5-72b-instruct:free', name: 'Qwen 2.5 72B (Free)', provider: 'Qwen', tier: 'free' },
    ];
  }

  getInfo() {
    return {
      enabled: this.enabled,
      hasApiKey: !!this.apiKey,
      defaultModel: this.defaultModel,
      cachedModelCount: this.cachedModels?.length || 0,
    };
  }
}

module.exports = OpenRouterService;
